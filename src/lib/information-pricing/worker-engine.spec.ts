import { describe, expect, it } from 'vitest';
import type { WorkerLike } from '$lib/worker-pool';
import { validateParams } from './distributions';
import type { Analysis, PartialAnalysis, TreeResult } from './analysis';
import {
	createAnalyser,
	type Analyser,
	type AnalysisListener,
	type AnalysisResult,
	type AnalysisWorker,
	type TreeWorker
} from './analyser';
import { CHUNK_ROWS } from './simulate';
import {
	createAnalysisHost,
	createTreeHost,
	type FromAnalysis,
	type FromTree,
	type ToAnalysis,
	type ToTree
} from './analysis-host';
import { createSimulationHost, type FromWorker, type ToWorker } from './host';
import { csvHeader } from './csv';
import { compileModel, evaluateRow } from './model';
import { presetModel } from './presets';
import type { Model, Scenarios } from './types';
import {
	createSimulationEngine,
	runSpec,
	PROGRESS_STEPS,
	type EngineEvent,
	type SimulationEngine
} from './worker-engine';

/** Every part is in: the value of information (inputs and intermediates) and the tree. */
const isComplete = (a: PartialAnalysis) =>
	!!a.valueOfInformation && !!a.intermediates.valueOfInformation && !!a.tree;

/** Runs the real host in-process, with structured cloning and async delivery like a worker. */
class FakeWorker implements WorkerLike<ToWorker, FromWorker> {
	onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	dead = false;
	private handle = createSimulationHost((msg) =>
		setTimeout(() => {
			if (!this.dead) this.onmessage?.({ data: structuredClone(msg) } as MessageEvent<FromWorker>);
		}, 0)
	);

	postMessage(msg: ToWorker): void {
		const copy = structuredClone(msg);
		setTimeout(() => !this.dead && this.handle(copy), 0);
	}

	terminate(): void {
		this.dead = true;
	}
}

/** The real analysis host in-process; transfers detach the sender's buffers like a worker. */
class FakeAnalysisWorker implements AnalysisWorker {
	onmessage: ((e: MessageEvent<FromAnalysis>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	dead = false;
	received: ToAnalysis[] = [];
	private handle = createAnalysisHost((msg, transfer) => {
		const data = structuredClone(msg, { transfer });
		setTimeout(() => !this.dead && this.onmessage?.({ data } as MessageEvent<FromAnalysis>), 0);
	});

	postMessage(msg: ToAnalysis, options?: StructuredSerializeOptions): void {
		const copy = structuredClone(msg, options);
		this.received.push(copy);
		setTimeout(() => !this.dead && this.handle(copy), 0);
	}

	terminate(): void {
		this.dead = true;
	}
}

/** The real tree host in-process; messages are copied like a worker's. */
class FakeTreeWorker implements TreeWorker {
	onmessage: ((e: MessageEvent<FromTree>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	dead = false;
	received: ToTree[] = [];
	private handle = createTreeHost((msg) => {
		const data = structuredClone(msg);
		setTimeout(() => !this.dead && this.onmessage?.({ data } as MessageEvent<FromTree>), 0);
	});

	postMessage(msg: ToTree): void {
		const copy = structuredClone(msg);
		this.received.push(copy);
		setTimeout(() => !this.dead && this.handle(copy), 0);
	}

	terminate(): void {
		this.dead = true;
	}
}

/** An engine on in-process workers; `analysers` and `trees` collect the analysis workers made. */
function engineWith(workers: number) {
	const analysers: FakeAnalysisWorker[] = [];
	const trees: FakeTreeWorker[] = [];
	const engine = createSimulationEngine(() => new FakeWorker(), {
		workers,
		progressMs: 5,
		analyser: createAnalyser(
			() => {
				const w = new FakeAnalysisWorker();
				analysers.push(w);
				return w;
			},
			() => {
				const w = new FakeTreeWorker();
				trees.push(w);
				return w;
			}
		)
	});
	return Object.assign(engine, { analysers, trees });
}

function compiled(model: Model) {
	const result = compileModel(model, validateParams);
	if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('; '));
	return result.compiled;
}

function next(engine: SimulationEngine, events: EngineEvent[] = []): Promise<EngineEvent> {
	return new Promise((resolve) => {
		const off = engine.subscribe((e) => {
			events.push(e);
			if (e.type !== 'progress' && e.type !== 'partial') {
				off();
				resolve(e);
			}
		});
	});
}

async function simulate(model: Model, n: number, workers: number): Promise<Scenarios> {
	const engine = engineWith(workers);
	const done = next(engine);
	engine.run(runSpec(model, compiled(model)), n);
	const e = await done;
	engine.dispose();
	if (e.type !== 'done') throw new Error(JSON.stringify(e));
	return e.scenarios;
}

describe('simulation engine', () => {
	it('draws the same scenarios whatever the worker count', async () => {
		const model = presetModel('airline-share-buyback');
		const [a, b] = await Promise.all([simulate(model, 20_000, 1), simulate(model, 20_000, 3)]);
		expect(a.n).toBe(20_000);
		expect(a.inputs.map((x) => x.symbol)).toEqual(['R', 'K', 'F', 'Lr', 'p', 'i']);
		expect(a.intermediates.map((x) => x.symbol)).toEqual(['Rev', 'Fuel', 'Delta']);
		expect(a.decisions).toEqual(['500 M€', '600 M€', '700 M€', '800 M€', '900 M€', '1000 M€']);
		expect(b.inputs[3].column).toEqual(a.inputs[3].column);
		expect(b.rewards[4]).toEqual(a.rewards[4]);
		expect(b.optimal).toEqual(a.optimal);
	}, 10_000);

	it('samples only the random inputs; fixed ones get no column', async () => {
		const model = presetModel('distribution-centre');
		const spec = runSpec(model, compiled(model));
		expect(spec.inputs.map((x) => x.family)).toEqual(['lognormal', 'exponential', 'uniform']);
		expect(spec.shape.inputs).toEqual(['N', 'P', 'C']);
		const s = await simulate(model, 100, 1);
		expect(s.inputs.map((x) => x.symbol)).toEqual(['N', 'P', 'C']);
		expect(csvHeader(s).slice(0, 4)).toEqual(['N', 'P', 'C', '30 trucks']);
	});

	it('matches the reference evaluator row by row', async () => {
		const model = presetModel('airline-share-buyback');
		const c = compiled(model);
		const s = await simulate(model, 1_000, 2);
		for (const i of [0, 1, 517, 999]) {
			const row = evaluateRow(
				c,
				s.inputs.map((x) => x.column[i])
			);
			s.rewards.forEach((r, d) => expect(r[i]).toBeCloseTo(row.rewards[d], 9));
			expect(s.optimal[i]).toBe(Math.max(...s.rewards.map((r) => r[i])));
		}
	});

	it('appends scenarios that continue the same streams', async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(2);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 50_000);
		await done;
		done = next(engine);
		engine.add(30_000);
		const e = await done;
		engine.dispose();
		if (e.type !== 'done') throw new Error('add failed');
		const whole = await simulate(model, 80_000, 1);
		expect(e.scenarios.n).toBe(80_000);
		expect(e.scenarios.inputs[0].column).toEqual(whole.inputs[0].column);
		expect(e.scenarios.rewards[2]).toEqual(whole.rewards[2]);
	});

	it('changes with the seed', async () => {
		const model = presetModel('distribution-centre');
		const a = await simulate(model, 100, 1);
		const b = await simulate({ ...model, seed: model.seed + 1 }, 100, 1);
		expect(b.inputs[1].column).not.toEqual(a.inputs[1].column);
	});

	it('reports progress, and an error for a non-finite reward', async () => {
		const model = presetModel('blank');
		model.decisions.reward = `${model.decisions.symbol} / 0`;
		const engine = engineWith(1);
		const events: EngineEvent[] = [];
		const done = next(engine, events);
		engine.run(runSpec(model, compiled(model)), 10);
		const e = await done;
		expect(events[0]).toMatchObject({ type: 'progress', step: 'Simulating', fraction: 0 });
		expect(e.type).toBe('error');
		expect(engine.running).toBe(false);
	});

	it('keeps the previous scenarios when a run is cancelled', async () => {
		const model = presetModel('blank');
		const engine = engineWith(1);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 100);
		await done;
		const before = engine.scenarios;
		done = next(engine);
		engine.run(runSpec({ ...model, seed: 9 }, compiled(model)), 100_000);
		engine.cancel();
		expect((await done).type).toBe('cancelled');
		expect(engine.scenarios).toBe(before);
		done = next(engine);
		engine.add(50);
		const e = await done;
		expect(e.type === 'done' && e.scenarios.n).toBe(150);
		engine.dispose();
	});

	it('delivers the analysis in parts: main, value of information, then done with everything', async () => {
		const model = presetModel('airline-share-buyback');
		const engine = engineWith(2);
		const events: EngineEvent[] = [];
		const done = next(engine, events);
		engine.run(runSpec(model, compiled(model)), 20_000);
		const last = await done;
		if (last.type !== 'done') throw new Error(JSON.stringify(last));
		const partials = events.flatMap((e) => (e.type === 'partial' ? [e.analysis] : []));
		expect(partials.length).toBeGreaterThanOrEqual(2);
		// The main part comes first; the value of information only later.
		expect(partials[0].summary.expectedLoss).toHaveLength(6);
		expect(partials[0].groups).toHaveLength(6);
		expect(partials[0].profitShare).toHaveLength(6);
		expect(partials[0].intermediates.groups).toHaveLength(3);
		expect(partials[0].distributions).toHaveLength(6);
		expect(partials[0].valueOfInformation).toBeUndefined();
		const voiAt = partials.findIndex((p) => p.valueOfInformation !== undefined);
		expect(voiAt).toBeGreaterThan(0);
		expect(partials[voiAt].intermediates.valueOfInformation?.savings).toHaveLength(3);
		expect(isComplete(partials.at(-1)!)).toBe(true);
		// Partial events come before done, and done carries the whole analysis.
		expect(events.findLastIndex((e) => e.type === 'partial')).toBeLessThan(events.length - 1);
		expect(isComplete(last.analysis)).toBe(true);
		expect('tree' in last.analysis.tree).toBe(true);
		expect(last.analysis.intermediates.densities).toHaveLength(3);
		expect(last.scenarios.optimal.length).toBe(20_000);
		engine.dispose();
	});

	it('reports one monotonic progress fraction across the steps, ending at 1', async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(2);
		const events: EngineEvent[] = [];
		const done = next(engine, events);
		engine.run(runSpec(model, compiled(model)), 30_000);
		expect((await done).type).toBe('done');
		const progress = events.flatMap((e) => (e.type === 'progress' ? [e] : []));
		expect(progress[0]).toMatchObject({ step: 'Simulating', fraction: 0 });
		for (let i = 1; i < progress.length; i++) {
			expect(progress[i].fraction).toBeGreaterThanOrEqual(progress[i - 1].fraction);
			expect(PROGRESS_STEPS.indexOf(progress[i].step)).toBeGreaterThanOrEqual(
				PROGRESS_STEPS.indexOf(progress[i - 1].step)
			);
		}
		expect(progress.at(-1)!.fraction).toBe(1);
		expect(progress.some((p) => p.step === 'Summary and inputs')).toBe(true);
		engine.dispose();
	});

	it("reruns only the tree on Update tree, on the tree worker's copy", async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(2);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 30_000);
		const first = await done;
		if (first.type !== 'done' || !('tree' in first.analysis.tree)) throw new Error('no tree');
		const [analysis] = engine.analysers;
		const [tree] = engine.trees;
		const analysed = analysis.received.length;
		expect(tree.received).toHaveLength(1);
		const events: EngineEvent[] = [];
		done = next(engine, events);
		engine.reanalyse({ unit: '€', tree: { maxDepth: 1 } });
		expect(engine.scenarios?.optimal.length).toBe(30_000); // never lent
		const second = await done;
		if (second.type !== 'done' || !('tree' in second.analysis.tree)) throw new Error('no tree');
		// The analysis worker heard nothing; the tree worker regrew on its kept copy.
		expect(analysis.received).toHaveLength(analysed);
		expect(engine.analysers).toHaveLength(1);
		expect(tree.received).toHaveLength(2);
		expect(tree.received[1].data).toBeUndefined();
		expect(second.analysis.tree.tree.nodes.length).toBeLessThan(
			first.analysis.tree.tree.nodes.length
		);
		expect(second.analysis.tree.tree.nodes.every((n) => n.depth <= 1)).toBe(true);
		// The rest is the previous analysis; the first partial shows it without a tree.
		expect(second.analysis.summary).toBe(first.analysis.summary);
		expect(second.analysis.valueOfInformation).toBe(first.analysis.valueOfInformation);
		const partial = events.find((e) => e.type === 'partial');
		expect(partial?.type === 'partial' && partial.analysis.tree).toBeUndefined();
		const progress = events.flatMap((e) => (e.type === 'progress' ? [e] : []));
		expect(progress.every((p) => p.step === 'Policy tree')).toBe(true);
		expect(progress.at(-1)!.fraction).toBe(1);
		engine.dispose();
	});

	it('cancels during the analysis, keeping the previous results, and terminates both analysers', async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(1);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 5_000);
		const first = await done;
		if (first.type !== 'done') throw new Error(JSON.stringify(first));
		const before = engine.scenarios;
		const cancelled = new Promise<EngineEvent>((resolve) => {
			const off = engine.subscribe((e) => {
				if (e.type === 'partial') engine.cancel();
				if (e.type !== 'progress' && e.type !== 'partial') {
					off();
					resolve(e);
				}
			});
		});
		engine.run(runSpec({ ...model, seed: 5 }, compiled(model)), 20_000);
		expect((await cancelled).type).toBe('cancelled');
		expect(engine.running).toBe(false);
		expect(engine.scenarios).toBe(before);
		expect(engine.analysers[0].dead && engine.trees[0].dead).toBe(true);
		// Update tree copies the scenarios to a fresh tree worker.
		done = next(engine);
		engine.reanalyse({ unit: '€', tree: { maxDepth: 1 } });
		const e = await done;
		if (e.type !== 'done') throw new Error(JSON.stringify(e));
		expect(engine.trees).toHaveLength(2);
		expect(engine.trees[1].received[0].data?.n).toBe(5_000);
		expect(e.scenarios).toBe(before);
		expect(e.analysis.summary).toBe(first.analysis.summary);
		engine.dispose();
	});

	it('cancels an Update tree, keeping the previous analysis', async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(1);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 5_000);
		expect((await done).type).toBe('done');
		done = next(engine);
		engine.reanalyse({ unit: '€', tree: { maxDepth: 1 } });
		engine.cancel();
		expect((await done).type).toBe('cancelled');
		done = next(engine);
		engine.add(1_000);
		const e = await done;
		expect(e.type === 'done' && e.scenarios.n).toBe(6_000);
		engine.dispose();
	});
});

/** An analyser whose calls stay pending until the test settles them. */
function manualAnalyser() {
	const calls: {
		scenarios: Scenarios;
		listener: AnalysisListener;
		resolve: (r: AnalysisResult) => void;
		reject: (e: Error) => void;
	}[] = [];
	let cancels = 0;
	const analyser: Analyser = {
		analyse: (scenarios, _options, listener) =>
			new Promise<AnalysisResult>((resolve, reject) => {
				calls.push({ scenarios, listener: listener!, resolve, reject });
			}),
		retree: () => new Promise<TreeResult>(() => {}),
		cancel: () => void cancels++,
		dispose: () => {}
	};
	return { analyser, calls, cancels: () => cancels };
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('stale results and failures', () => {
	const model = presetModel('blank');
	const spec = (seed: number) => runSpec({ ...model, seed }, compiled(model));
	const engineOn = (analyser: Analyser, createWorker = () => new FakeWorker()) =>
		createSimulationEngine(createWorker, { workers: 1, progressMs: 5, analyser });
	const sentinel = {} as Analysis;

	// Kills the token guards in listenerFor, analyse().then and failedAnalysis.
	it('ignores progress, partials, results and errors of a cancelled analysis', async () => {
		const m = manualAnalyser();
		const engine = engineOn(m.analyser);
		const events: EngineEvent[] = [];
		engine.subscribe((e) => events.push(e));

		engine.run(spec(1), 100);
		await tick();
		expect(m.calls).toHaveLength(1);
		engine.cancel();
		expect(m.cancels()).toBe(1);
		engine.run(spec(2), 200);
		await tick();
		expect(m.calls).toHaveLength(2);
		const old = m.calls[0]!;
		const current = m.calls[1]!;

		events.length = 0;
		old.listener.progress?.('main', 0.9);
		old.listener.partial?.({} as PartialAnalysis);
		old.resolve({ scenarios: old.scenarios, analysis: sentinel });
		await tick();
		expect(engine.scenarios).toBeNull();
		expect(events.filter((e) => e.type === 'partial' || e.type === 'done')).toEqual([]);
		// The only progress is the timer's, still on the new job: nothing of 'main' counted.
		for (const e of events) if (e.type === 'progress') expect(e.fraction).toBeCloseTo(0.15, 12);

		old.reject(new Error('old failure'));
		await tick();
		expect(events.some((e) => e.type === 'error')).toBe(false);
		expect(engine.running).toBe(true);

		current.resolve({ scenarios: current.scenarios, analysis: sentinel });
		await tick();
		const done = events.find((e) => e.type === 'done');
		expect(done?.type === 'done' && done.scenarios.n).toBe(200);
		expect(engine.running).toBe(false);
		engine.dispose();
	});

	// Kills Math.max -> Math.min on step fractions and the progress arithmetic.
	it('keeps the highest fraction of a step and weights the steps', async () => {
		const m = manualAnalyser();
		const engine = engineOn(m.analyser);
		const events: EngineEvent[] = [];
		engine.subscribe((e) => events.push(e));
		engine.run(spec(1), 100);
		await tick();
		const call = m.calls[0]!;
		const last = () => events.filter((e) => e.type === 'progress').at(-1);

		// Weights 0.15, 0.25, 0.2, 0.4: Simulating is done, nothing else yet.
		expect(last()?.fraction).toBeCloseTo(0.15, 12);
		call.listener.progress?.('main', 0.8);
		call.listener.progress?.('main', 0.3);
		call.listener.partial?.({} as PartialAnalysis);
		expect(last()).toMatchObject({ step: 'Summary and inputs' });
		expect(last()?.fraction).toBeCloseTo(0.15 + 0.25 * 0.8, 12);
		await tick();
		expect(last()?.fraction).toBeCloseTo(0.35, 12);

		call.listener.progress?.('voi', 0.5);
		call.listener.partial?.({} as PartialAnalysis);
		expect(last()?.fraction).toBeCloseTo(0.35 + 0.2 * 0.5, 12);
		for (let i = 1; i < events.length; i++) {
			const [a, b] = [events[i - 1], events[i]];
			if (a.type === 'progress' && b.type === 'progress') {
				expect(b.fraction).toBeGreaterThanOrEqual(a.fraction);
			}
		}
		engine.cancel();
		engine.dispose();
	});

	// Kills the done / total arithmetic of the simulating fraction.
	it('reports the simulating fraction as the share of rows drawn', async () => {
		const m = manualAnalyser();
		const engine = engineOn(m.analyser);
		const fractions: number[] = [];
		engine.subscribe((e) => e.type === 'progress' && fractions.push(e.fraction));
		engine.run(spec(1), 2 * CHUNK_ROWS);
		await tick(100);
		expect(m.calls).toHaveLength(1);
		// Two equal chunks: 0, half and all of the Simulating weight (0.15).
		expect(fractions[0]).toBe(0);
		expect(fractions.at(-1)).toBeCloseTo(0.15, 12);
		const known = [0, 0.075, 0.15];
		expect(fractions.every((f) => known.some((k) => Math.abs(f - k) < 1e-12))).toBe(true);
		engine.cancel();
		engine.dispose();
	});

	// Kills the worker-error paths (onerror with and without a message, and an error message).
	describe.each([
		[
			'an onerror with a message',
			(w: FakeWorker) => w.onerror?.({ message: 'boom' } as ErrorEvent),
			'boom'
		],
		[
			'an onerror without a message',
			(w: FakeWorker) => w.onerror?.({} as ErrorEvent),
			'Worker error'
		],
		[
			'an error message',
			(w: FakeWorker) =>
				w.onmessage?.({ data: { type: 'error', message: 'bad' } } as MessageEvent<FromWorker>),
			'bad'
		]
	] as const)('on %s', (_, trigger, message) => {
		it('emits one error, stops, and the next run works', async () => {
			let worker!: FakeWorker;
			const engine = engineOn(manualAnalyser().analyser, () => (worker = new FakeWorker()));
			const events: EngineEvent[] = [];
			engine.subscribe((e) => events.push(e));
			engine.run(spec(1), 100);
			trigger(worker);
			expect(events.filter((e) => e.type === 'error')).toEqual([{ type: 'error', message }]);
			expect(engine.running).toBe(false);

			const real = engineWith(1);
			const done = next(real);
			real.run(spec(1), 50);
			expect((await done).type).toBe('done');
			real.dispose();
			engine.dispose();
		});
	});
});
