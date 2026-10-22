/**
 * Scenario generation over a pool of simulation workers. The main thread
 * hands out chunks, collects them in chunk order and assembles `Scenarios`.
 */
import type { WorkerLike as PoolWorker } from '$lib/worker-pool';
import type { Analysis, AnalysisOptions } from './analysis';
import { AnalysisError, type Analyser } from './analyser';
import { kernelSource } from './formula/codegen';
import type { FromWorker, ToWorker } from './host';
import type { CompiledModel } from './model';
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

export function runSpec(model: Model, compiled: CompiledModel): RunSpec {
	return {
		inputs: model.inputs.map((x) => ({ family: x.family, params: [...x.params] })),
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

export type EngineEvent =
	| {
			type: 'progress';
			stage: 'simulating' | 'analysing';
			done: number;
			total: number;
			elapsedMs: number;
	  }
	| { type: 'done'; scenarios: Scenarios; analysis: Analysis; elapsedMs: number }
	| { type: 'cancelled' }
	| { type: 'error'; message: string };

export interface SimulationEngine {
	/** Draw `n` fresh scenarios; the current set is replaced when the run completes. */
	run(spec: RunSpec, n: number): void;
	/** Append `n` scenarios to the current set, continuing the same streams. */
	add(n: number): void;
	/** Rerun the analysis of the current scenarios with new options (e.g. tree settings). */
	reanalyse(options: AnalysisOptions): void;
	/** Abandon the current run, add or analysis; the previous results stay. */
	cancel(): void;
	subscribe(listener: (event: EngineEvent) => void): () => void;
	/** Terminate the workers and drop all state. */
	dispose(): void;
	readonly running: boolean;
	/** The latest scenarios; their columns are detached while an analysis runs. */
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
		timer?: ReturnType<typeof setInterval>;
		/** True while the current scenarios are lent to the analyser (a reanalysis): not cancellable. */
		lent?: boolean;
	} | null = null;

	const emit = (event: EngineEvent) => {
		for (const l of [...listeners]) l(event);
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

	const dispatch = (w: WorkerLike) => {
		const next = job?.queue.shift();
		if (next && spec) w.postMessage({ type: 'chunk', seed: spec.seed, ...next });
	};

	const onMessage = (w: WorkerLike, msg: FromWorker) => {
		if (!workers.includes(w) || !job) return;
		if (msg.type === 'error') return fail(msg.message);
		job.chunks.set(msg.k, msg.chunk);
		job.done += msg.chunk.rewards[0]?.length ?? 0;
		if (job.chunks.size < job.chunkCount) return dispatch(w);
		const ordered = Array.from({ length: job.chunkCount }, (_, i) => {
			const c = job!.chunks.get(job!.firstChunk + i);
			if (!c) throw new Error('missing chunk');
			return c;
		});
		const drawn = assemble(spec!.shape, ordered, job.base);
		const chunkEnd = job.firstChunk + job.chunkCount;
		const drawnWith = spec!;
		analyseJob(drawn, drawnWith.analysis, () => {
			current = drawnWith;
			nextChunk = chunkEnd;
		});
	};

	/** Lend `s` to the analyser; on success adopt it as the current set and emit `done`. */
	const analyseJob = (s: Scenarios, options: AnalysisOptions, adopt: () => void) => {
		if (!job) return;
		job.stage = 'analysing';
		const mine = job.token;
		const lent = job.lent;
		const startedAt = job.startedAt;
		emit({
			type: 'progress',
			stage: 'analysing',
			done: job.total,
			total: job.total,
			elapsedMs: now() - startedAt
		});
		analyser.analyse(s, options).then(
			(result) => {
				if (lent) scenarios = result.scenarios;
				if (job?.token !== mine) return;
				adopt();
				scenarios = result.scenarios;
				endJob();
				emit({ type: 'done', scenarios, analysis: result.analysis, elapsedMs: now() - startedAt });
			},
			(err: Error) => {
				if (lent && err instanceof AnalysisError) scenarios = err.scenarios;
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

	const start = (n: number, base: Scenarios | null, firstChunk: number) => {
		const queue = chunkPlan(n, firstChunk);
		const startedAt = now();
		job = {
			token: ++token,
			stage: 'simulating',
			base,
			queue,
			chunks: new Map(),
			firstChunk,
			chunkCount: queue.length,
			total: n,
			done: 0,
			startedAt,
			timer: setInterval(() => {
				if (job)
					emit({
						type: 'progress',
						stage: job.stage,
						done: job.done,
						total: job.total,
						elapsedMs: now() - startedAt
					});
			}, progressMs)
		};
		emit({ type: 'progress', stage: 'simulating', done: 0, total: n, elapsedMs: 0 });
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
			if (job || !current || !scenarios) return;
			current = { ...current, analysis: options };
			const s = scenarios;
			job = {
				token: ++token,
				stage: 'analysing',
				base: s,
				queue: [],
				chunks: new Map(),
				firstChunk: nextChunk,
				chunkCount: 0,
				total: s.n,
				done: s.n,
				startedAt: now(),
				lent: true
			};
			analyseJob(s, options, () => {});
		},
		cancel() {
			if (!job || job.lent) return;
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
			spec = current = null;
			scenarios = null;
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
