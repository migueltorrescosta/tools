/**
 * Scenario generation over a pool of simulation workers. The main thread
 * hands out chunks, collects them in chunk order and assembles `Scenarios`.
 */
import type { WorkerLike as PoolWorker } from '$lib/worker-pool';
import type { Analysis, AnalysisOptions, PartialAnalysis } from './analysis';
import type { Analyser, AnalysisListener, AnalysisStep } from './analyser';
import { kernelSource } from './formula/codegen';
import type { FromWorker, ToWorker } from './host';
import { randomInputs, type CompiledModel } from './model';
import { assemble, chunkPlan, type Chunk, type InputSpec, type ScenarioShape } from './simulate';
import type { Model, Scenarios } from './types';

type WorkerLike = PoolWorker<ToWorker, FromWorker>;

/** What the workers need for a run: built from a compiled model by `runSpec`. */
export interface RunSpec {
	inputs: InputSpec[];
	shape: ScenarioShape;
	source: string;
	seed: number;
	analysis: AnalysisOptions;
}

/** The run for `model`: only random inputs are sampled; fixed ones are inlined in the kernel. */
export function runSpec(model: Model, compiled: CompiledModel): RunSpec {
	return {
		inputs: randomInputs(model).map((x) => ({ family: x.family, params: [...x.params] })),
		shape: {
			inputs: [...compiled.slots.inputs],
			shared: [...compiled.slots.shared],
			decisions: [...compiled.labels]
		},
		source: kernelSource(compiled),
		seed: model.seed,
		analysis: { unit: model.decisions.unit }
	};
}

/** Steps of a job, in order; the progress label names the first one not done. */
export const PROGRESS_STEPS = [
	'Simulating',
	'Summary and inputs',
	'Value of information',
	'Policy tree'
] as const;
export type ProgressStep = (typeof PROGRESS_STEPS)[number];

/**
 * Share of a run's work per step (from a 1M-row profile on 2 cores). The tree
 * runs in parallel with the other analysis steps, so the overall fraction is
 * the completed weight over the job's total weight.
 */
export const STEP_WEIGHTS: Readonly<Record<ProgressStep, number>> = {
	Simulating: 0.15,
	'Summary and inputs': 0.25,
	'Value of information': 0.2,
	'Policy tree': 0.4
};

const ANALYSIS_STEPS: Record<AnalysisStep, ProgressStep> = {
	main: 'Summary and inputs',
	voi: 'Value of information',
	tree: 'Policy tree'
};

export type EngineEvent =
	/** Overall progress of the job, monotonic, 0 at the start and 1 just before `done`. */
	| { type: 'progress'; step: ProgressStep; fraction: number; elapsedMs: number }
	/**
	 * The analysis so far: after the main part, then after each later part. An
	 * Update tree job starts with the previous analysis without its tree.
	 */
	| { type: 'partial'; analysis: PartialAnalysis; elapsedMs: number }
	| { type: 'done'; scenarios: Scenarios; analysis: Analysis; elapsedMs: number }
	| { type: 'cancelled' }
	| { type: 'error'; message: string };

export interface SimulationEngine {
	/** Draw `n` fresh scenarios; the current set is replaced when the run completes. */
	run(spec: RunSpec, n: number): void;
	/** Append `n` scenarios to the current set, continuing the same streams. */
	add(n: number): void;
	/**
	 * Regrow only the policy tree of the current scenarios with new options
	 * (Update tree), on the tree worker's copy; the rest of the analysis stays.
	 */
	reanalyse(options: AnalysisOptions): void;
	/** Abandon the current run, add or tree update; the previous results stay. */
	cancel(): void;
	subscribe(listener: (event: EngineEvent) => void): () => void;
	/** Terminate the workers and drop all state. */
	dispose(): void;
	readonly running: boolean;
	/**
	 * The latest complete scenarios. A run or add analyses a new set and adopts
	 * it on `done`, so these are never lent; still, use them only while not
	 * `running`.
	 */
	readonly scenarios: Scenarios | null;
}

export interface EngineOptions {
	workers: number;
	analyser: Analyser;
	progressMs?: number;
}

const now = () => performance.now();

export function createSimulationEngine(
	createWorker: () => WorkerLike,
	{ workers: workerCount, analyser, progressMs = 250 }: EngineOptions
): SimulationEngine {
	const listeners = new Set<(event: EngineEvent) => void>();
	let workers: WorkerLike[] = [];
	/** The spec the live workers were initialised with. */
	let spec: RunSpec | null = null;
	/** The spec `scenarios` were drawn with; `add` continues it. */
	let current: RunSpec | null = null;
	let scenarios: Scenarios | null = null;
	/** The analysis of `scenarios`; Update tree replaces only its tree. */
	let analysis: Analysis | null = null;
	/** Chunks drawn so far for the current set; the next add starts here. */
	let nextChunk = 0;
	/** Bumped by every new job, so a late analysis result of an abandoned job is ignored. */
	let token = 0;
	let job: {
		token: number;
		stage: 'simulating' | 'analysing';
		base: Scenarios | null;
		queue: { k: number; rows: number }[];
		chunks: Map<number, Chunk>;
		firstChunk: number;
		chunkCount: number;
		total: number;
		done: number;
		startedAt: number;
		/** Fraction done of each step this job has (a tree update has only the tree). */
		steps: Partial<Record<ProgressStep, number>>;
		/** The last overall fraction emitted, so progress never goes back. */
		fraction: number;
		timer?: ReturnType<typeof setInterval>;
	} | null = null;

	const emit = (event: EngineEvent) => {
		for (const l of [...listeners]) l(event);
	};

	const emitProgress = () => {
		if (!job) return;
		let total = 0;
		let done = 0;
		let step: ProgressStep | null = null;
		for (const s of PROGRESS_STEPS) {
			const f = job.steps[s];
			if (f === undefined) continue;
			total += STEP_WEIGHTS[s];
			done += STEP_WEIGHTS[s] * f;
			if (step === null && f < 1) step = s;
		}
		job.fraction = Math.max(job.fraction, total > 0 ? Math.min(1, done / total) : 1);
		emit({
			type: 'progress',
			step: step ?? 'Policy tree',
			fraction: job.fraction,
			elapsedMs: now() - job.startedAt
		});
	};

	const terminate = () => {
		for (const w of workers) {
			w.onmessage = null;
			w.onerror = null;
			w.terminate();
		}
		workers = [];
	};

	const endJob = () => {
		if (job) clearInterval(job.timer);
		job = null;
	};

	const fail = (message: string) => {
		endJob();
		terminate();
		emit({ type: 'error', message });
	};

	/** Finish the job: progress 1, then `done` with the adopted scenarios and analysis. */
	const finish = (startedAt: number) => {
		if (!job) return;
		for (const s of PROGRESS_STEPS) if (job.steps[s] !== undefined) job.steps[s] = 1;
		emitProgress();
		endJob();
		emit({
			type: 'done',
			scenarios: scenarios!,
			analysis: analysis!,
			elapsedMs: now() - startedAt
		});
	};

	/** Analysis progress and partial results of the job with token `mine`. */
	const listenerFor = (mine: number, startedAt: number): AnalysisListener => ({
		progress(step: AnalysisStep, fraction: number) {
			if (job?.token !== mine) return;
			const s = ANALYSIS_STEPS[step];
			job.steps[s] = Math.max(job.steps[s] ?? 0, fraction);
		},
		partial(partial: PartialAnalysis) {
			if (job?.token !== mine) return;
			emit({ type: 'partial', analysis: partial, elapsedMs: now() - startedAt });
			emitProgress();
		}
	});

	const dispatch = (w: WorkerLike) => {
		const next = job?.queue.shift();
		if (next && spec) w.postMessage({ type: 'chunk', seed: spec.seed, ...next });
	};

	const onMessage = (w: WorkerLike, msg: FromWorker) => {
		if (!workers.includes(w) || !job) return;
		if (msg.type === 'error') return fail(msg.message);
		job.chunks.set(msg.k, msg.chunk);
		job.done += msg.chunk.rewards[0]?.length ?? 0;
		job.steps.Simulating = job.total > 0 ? job.done / job.total : 1;
		if (job.chunks.size < job.chunkCount) return dispatch(w);
		const ordered = Array.from({ length: job.chunkCount }, (_, i) => {
			const c = job!.chunks.get(job!.firstChunk + i);
			if (!c) throw new Error('missing chunk');
			return c;
		});
		const drawn = assemble(spec!.shape, ordered, job.base);
		const chunkEnd = job.firstChunk + job.chunkCount;
		const drawnWith = spec!;
		job.stage = 'analysing';
		job.steps.Simulating = 1;
		emitProgress();
		const mine = job.token;
		const startedAt = job.startedAt;
		analyser.analyse(drawn, drawnWith.analysis, listenerFor(mine, startedAt)).then(
			(result) => {
				if (job?.token !== mine) return;
				current = drawnWith;
				nextChunk = chunkEnd;
				scenarios = result.scenarios;
				analysis = result.analysis;
				finish(startedAt);
			},
			(err: Error) => {
				if (job?.token !== mine) return;
				endJob();
				emit({ type: 'error', message: err.message });
			}
		);
	};

	const spawn = () => {
		terminate();
		if (!spec) return;
		const init: ToWorker = {
			type: 'init',
			inputs: spec.inputs,
			slotCount: spec.shape.inputs.length + spec.shape.shared.length,
			decisions: spec.shape.decisions.length,
			source: spec.source
		};
		for (let i = 0; i < Math.max(1, Math.floor(workerCount) || 1); i++) {
			const w = createWorker();
			w.onmessage = (e) => onMessage(w, e.data);
			w.onerror = (e) => fail(e.message || 'Worker error');
			w.postMessage(init);
			workers.push(w);
		}
	};

	const newJob = (
		stage: 'simulating' | 'analysing',
		steps: Partial<Record<ProgressStep, number>>,
		n: number,
		base: Scenarios | null,
		firstChunk: number
	) => {
		const queue = stage === 'simulating' ? chunkPlan(n, firstChunk) : [];
		job = {
			token: ++token,
			stage,
			base,
			queue,
			chunks: new Map(),
			firstChunk,
			chunkCount: queue.length,
			total: n,
			done: 0,
			startedAt: now(),
			steps,
			fraction: 0,
			timer: setInterval(emitProgress, progressMs)
		};
		emitProgress();
		return job;
	};

	const start = (n: number, base: Scenarios | null, firstChunk: number) => {
		newJob(
			'simulating',
			{
				Simulating: 0,
				'Summary and inputs': 0,
				'Value of information': 0,
				'Policy tree': 0
			},
			n,
			base,
			firstChunk
		);
		// Two chunks in flight per worker, so a worker never idles waiting for the next one.
		for (const w of workers) {
			dispatch(w);
			dispatch(w);
		}
	};

	return {
		run(next, n) {
			this.cancel();
			spec = next;
			spawn();
			start(n, null, 0);
		},
		add(n) {
			if (job || !current || !scenarios) return;
			if (spec !== current || workers.length === 0) {
				spec = current;
				spawn();
			}
			start(n, scenarios, nextChunk);
		},
		reanalyse(options) {
			if (job || !current || !scenarios || !analysis) return;
			const s = scenarios;
			const previous = analysis;
			const { token: mine, startedAt } = newJob('analysing', { 'Policy tree': 0 }, 0, null, 0);
			emit({ type: 'partial', analysis: { ...previous, tree: undefined }, elapsedMs: 0 });
			analyser.retree(s, options, listenerFor(mine, startedAt)).then(
				(tree) => {
					if (job?.token !== mine) return;
					current = { ...current!, analysis: options };
					analysis = { ...previous, tree };
					finish(startedAt);
				},
				(err: Error) => {
					if (job?.token !== mine) return;
					endJob();
					emit({ type: 'error', message: err.message });
				}
			);
		},
		cancel() {
			if (!job) return;
			// Simulation workers are respawned on the next run; the analysers only when they were busy.
			if (job.stage === 'analysing') analyser.cancel();
			endJob();
			terminate();
			emit({ type: 'cancelled' });
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispose() {
			endJob();
			terminate();
			analyser.cancel();
			spec = current = null;
			scenarios = null;
			analysis = null;
			listeners.clear();
		},
		get running() {
			return job !== null;
		},
		get scenarios() {
			return scenarios;
		}
	};
}
