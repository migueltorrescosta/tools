import { describe, expect, it } from 'vitest';
import type { WorkerLike } from '$lib/worker-pool';
import { validateParams } from './distributions';
import { createAnalyser, type AnalysisWorker } from './analyser';
import { createAnalysisHost, type FromAnalysis, type ToAnalysis } from './analysis-host';
import { createSimulationHost, type FromWorker, type ToWorker } from './host';
import { csvHeader } from './csv';
import { compileModel, evaluateRow } from './model';
import { presetModel } from './presets';
import type { Model, Scenarios } from './types';
import {
	createSimulationEngine,
	runSpec,
	type EngineEvent,
	type SimulationEngine
} from './worker-engine';

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
	private handle = createAnalysisHost((msg, transfer) => {
		const data = structuredClone(msg, { transfer });
		setTimeout(() => this.onmessage?.({ data } as MessageEvent<FromAnalysis>), 0);
	});

	postMessage(msg: ToAnalysis, options?: StructuredSerializeOptions): void {
		const copy = structuredClone(msg, options);
		setTimeout(() => this.handle(copy), 0);
	}

	terminate(): void {}
}

const engineWith = (workers: number) =>
	createSimulationEngine(() => new FakeWorker(), {
		workers,
		progressMs: 5,
		analyser: createAnalyser(() => new FakeAnalysisWorker())
	});

function compiled(model: Model) {
	const result = compileModel(model, validateParams);
	if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('; '));
	return result.compiled;
}

function next(engine: SimulationEngine, events: EngineEvent[] = []): Promise<EngineEvent> {
	return new Promise((resolve) => {
		const off = engine.subscribe((e) => {
			events.push(e);
			if (e.type !== 'progress') {
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
		const [a, b] = await Promise.all([simulate(model, 60_000, 1), simulate(model, 60_000, 3)]);
		expect(a.n).toBe(60_000);
		expect(a.inputs.map((x) => x.symbol)).toEqual(['R', 'K', 'F', 'Lr', 'p', 'i']);
		expect(a.intermediates.map((x) => x.symbol)).toEqual(['Rev', 'Fuel', 'Delta']);
		expect(a.decisions).toEqual(['0 M€', '250 M€', '500 M€', '750 M€', '1000 M€']);
		expect(b.inputs[3].column).toEqual(a.inputs[3].column);
		expect(b.rewards[4]).toEqual(a.rewards[4]);
		expect(b.optimal).toEqual(a.optimal);
	});

	it('samples only the random inputs; fixed ones get no column', async () => {
		const model = presetModel('distribution-centre');
		const spec = runSpec(model, compiled(model));
		expect(spec.inputs.map((x) => x.family)).toEqual(['binomial', 'exponential', 'uniform']);
		expect(spec.shape.inputs).toEqual(['N', 'P', 'C']);
		const s = await simulate(model, 100, 1);
		expect(s.inputs.map((x) => x.symbol)).toEqual(['N', 'P', 'C']);
		expect(csvHeader(s).slice(0, 4)).toEqual(['N', 'P', 'C', '8 trucks']);
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
		expect(events[0]).toMatchObject({ type: 'progress', stage: 'simulating', done: 0, total: 10 });
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

	it('analyses each run and reanalyses with new tree options', async () => {
		const model = presetModel('distribution-centre');
		const engine = engineWith(2);
		let done = next(engine);
		engine.run(runSpec(model, compiled(model)), 30_000);
		const first = await done;
		if (first.type !== 'done') throw new Error(JSON.stringify(first));
		expect(first.analysis.summary.expectedLoss).toHaveLength(5);
		expect(first.scenarios.optimal.length).toBe(30_000);
		done = next(engine);
		engine.reanalyse({ unit: '€', tree: { maxDepth: 1 } });
		expect(engine.scenarios?.optimal.length).toBe(0); // lent to the analyser
		engine.cancel(); // a reanalysis cannot be cancelled
		const second = await done;
		if (second.type !== 'done') throw new Error(JSON.stringify(second));
		expect(engine.scenarios?.optimal.length).toBe(30_000);
		expect(second.analysis.summary.expectedLoss).toEqual(first.analysis.summary.expectedLoss);
		engine.dispose();
	});
});
