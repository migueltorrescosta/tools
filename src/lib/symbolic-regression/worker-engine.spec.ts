import { describe, expect, it } from 'vitest';
import { createIslandHost, type FromWorker, type ToWorker } from './host';
import { syntheticData } from './synthetic';
import { DEFAULT_SETTINGS, type SearchEvent } from './types';
import { MAX_WORKERS, type WorkerLike } from '$lib/worker-pool';
import { WorkerSearchEngine, islandSeed } from './worker-engine';

/** Runs the real island host in-process, with structured cloning and async delivery like a worker. */
class FakeWorker implements WorkerLike<ToWorker, FromWorker> {
	onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	received: ToWorker['type'][] = [];
	private dead = false;
	private handle = createIslandHost(
		(msg) =>
			setTimeout(() => {
				if (!this.dead)
					this.onmessage?.({ data: structuredClone(msg) } as MessageEvent<FromWorker>);
			}, 0),
		{ sliceMs: 20, reportMs: 50 }
	);

	postMessage(msg: ToWorker): void {
		this.received.push(msg.type);
		const copy = structuredClone(msg);
		setTimeout(() => !this.dead && this.handle(copy), 0);
	}

	terminate(): void {
		this.handle({ type: 'stop' });
		this.dead = true;
	}
}

const data = syntheticData({ rows: 100, ranges: [[-2, 2]], f: ([x]) => 3 * x * x + 1 });
const settings = {
	...DEFAULT_SETTINGS,
	workers: 2,
	timeBudgetSec: 0.5,
	populationSize: 40,
	maxComplexity: 12
};

function nextStop(engine: WorkerSearchEngine, events: SearchEvent[]): Promise<SearchEvent> {
	return new Promise((resolve) => {
		const off = engine.subscribe((e) => {
			events.push(e);
			if (e.type === 'stopped' || e.type === 'error') {
				off();
				resolve(e);
			}
		});
	});
}

describe('islandSeed', () => {
	it('derives distinct island seeds, island 0 using the seed', () => {
		expect(islandSeed(7, 0)).toBe(7);
		const seeds = new Set([0, 1, 2, 3].map((i) => islandSeed(7, i)));
		expect(seeds.size).toBe(4);
	});
});

describe('WorkerSearchEngine', () => {
	it('streams progress, stops on budget, continues, and stops on request', async () => {
		const fakes: FakeWorker[] = [];
		const engine = new WorkerSearchEngine(
			() => {
				const w = new FakeWorker();
				fakes.push(w);
				return w;
			},
			{ progressMs: 50, graceMs: 2000 }
		);

		const events: SearchEvent[] = [];
		let stopped = nextStop(engine, events);
		engine.start(data, settings);
		expect(engine.running).toBe(true);
		expect(fakes).toHaveLength(2);
		const first = await stopped;
		expect(first).toMatchObject({ type: 'stopped', reason: 'budget' });
		expect(engine.running).toBe(false);
		const progress = events.filter((e) => e.type === 'progress');
		expect(progress.length).toBeGreaterThan(3);
		const last = progress.at(-1)!;
		expect(last.type === 'progress' && last.iterations).toBeGreaterThan(0);
		if (first.type !== 'stopped') throw new Error();
		expect(first.front.length).toBeGreaterThan(0);
		expect(first.front.some((e) => e.trainMse < 1e-12)).toBe(true);
		const complexities = first.front.map((e) => e.complexity);
		expect(complexities).toEqual([...complexities].sort((a, b) => a - b));
		// Elites migrate between the two islands.
		expect(fakes.every((f) => f.received.includes('immigrants'))).toBe(true);

		const before = last.type === 'progress' ? last.iterations : 0;
		events.length = 0;
		stopped = nextStop(engine, events);
		engine.continue();
		expect(engine.running).toBe(true);
		await new Promise((r) => setTimeout(r, 200));
		engine.stop();
		const second = await stopped;
		expect(second).toMatchObject({ type: 'stopped', reason: 'user' });
		const after = events.filter((e) => e.type === 'progress').at(-1);
		expect(after && after.type === 'progress' && after.iterations).toBeGreaterThan(before);
		// Continue reuses the same workers and populations.
		expect(fakes).toHaveLength(2);
		expect(fakes[0].received.filter((t) => t === 'init')).toHaveLength(1);

		engine.dispose();
		expect(engine.running).toBe(false);
		engine.continue();
		expect(engine.running).toBe(false);
	}, 20_000);

	it('reports worker errors', async () => {
		const engine = new WorkerSearchEngine(() => {
			const w = new FakeWorker();
			const post = w.postMessage.bind(w);
			w.postMessage = (msg) => {
				if (msg.type === 'run')
					setTimeout(() => w.onerror?.({ message: 'boom' } as ErrorEvent), 10);
				post(msg);
			};
			return w;
		});
		const events: SearchEvent[] = [];
		const done = nextStop(engine, events);
		engine.start(data, { ...settings, workers: 1 });
		expect(await done).toEqual({ type: 'error', message: 'boom' });
		expect(engine.running).toBe(false);
	});

	it('caps the worker count', () => {
		let created = 0;
		const engine = new WorkerSearchEngine(() => {
			created++;
			return new FakeWorker();
		});
		engine.start(data, { ...settings, workers: 10_000 });
		expect(created).toBe(MAX_WORKERS);
		engine.dispose();
	});
});
