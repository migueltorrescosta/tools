import { describe, expect, it } from 'vitest';
import { createAncillaHost, taskSeed, type FromWorker, type ToWorker } from './host';
import { applyPreset, defaultSetup, noiseless } from './presets';
import type { Budget, RunEvent, RunSnapshot, SeedResult, Setup } from './types';
import type { WorkerLike } from '$lib/worker-pool';
import { createAncillaEngine } from './worker-engine';

/** Runs the real host in-process, with structured cloning and async delivery like a worker. */
class FakeWorker implements WorkerLike<ToWorker, FromWorker> {
	onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	received: ToWorker[] = [];
	seeds: SeedResult[] = [];
	dead = false;
	private handle = createAncillaHost(
		(msg) => {
			if (msg.type === 'seed') this.seeds.push(msg.result);
			setTimeout(() => {
				if (!this.dead)
					this.onmessage?.({ data: structuredClone(msg) } as MessageEvent<FromWorker>);
			}, 0);
		},
		{ traceMs: 0 }
	);

	postMessage(msg: ToWorker): void {
		this.received.push(msg);
		const copy = structuredClone(msg);
		setTimeout(() => !this.dead && this.handle(copy), 0);
	}

	terminate(): void {
		this.dead = true;
	}
}

function smallSetup(): Setup {
	const n = noiseless();
	n.markov.amplitudeDamping = 1;
	const s = applyPreset(
		{ ...defaultSetup(), noise: { system: n, ancilla: structuredClone(n) } },
		'active'
	);
	return { ...s, pulses: s.pulses.slice(0, 1) };
}

const budget: Budget = { steps: 4, rounds: 1, maxIter: 2, seesawIter: 8, workers: 1, seed: 3 };

function waitFor(
	engine: ReturnType<typeof createAncillaEngine>,
	pred: (e: RunEvent) => boolean,
	events: RunEvent[] = []
): Promise<RunEvent> {
	return new Promise((resolve) => {
		const off = engine.subscribe((e) => {
			events.push(e);
			if (pred(e) || e.type === 'error') {
				off();
				resolve(e);
			}
		});
	});
}

const snap = (e: RunEvent): RunSnapshot | null => (e.type === 'error' ? null : e.snapshot);

describe('taskSeed', () => {
	it('separates runs, roles, seeds and stages', () => {
		const seeds = new Set([
			taskSeed(1, 'setup', 0),
			taskSeed(1, 'setup', 1),
			taskSeed(1, 'companion', 0),
			taskSeed(2, 'setup', 0),
			taskSeed(1, 'setup', 0, 1),
			taskSeed(1, 'mzi', 0)
		]);
		expect(seeds.size).toBe(6);
		expect(taskSeed(1, 'setup', 4)).toBe(taskSeed(1, 'setup', 4));
	});
});

describe('createAncillaEngine', () => {
	it('computes the MZI first, interleaves setup and companion seeds, and finalises the best', async () => {
		const fakes: FakeWorker[] = [];
		const engine = createAncillaEngine(
			() => {
				const w = new FakeWorker();
				fakes.push(w);
				return w;
			},
			{ progressMs: 20 }
		);
		const done = waitFor(engine, (e) => {
			const s = snap(e);
			return !!s?.metrics && s.seedsDone.companion >= 2 && s.best.setup?.qfiFine != null;
		});
		engine.start(smallSetup(), budget);
		const last = snap(await done) as RunSnapshot;
		engine.stop();
		expect(fakes.length).toBe(1);
		const tasks = fakes[0].received.filter((m) => m.type !== 'init');
		expect(tasks[0].type).toBe('mzi');
		const seeds = tasks.flatMap((m) => (m.type === 'seed' ? [`${m.role}${m.seed}`] : []));
		expect(seeds.slice(0, 4)).toEqual(['setup0', 'companion0', 'setup1', 'companion1']);
		expect(tasks.some((m) => m.type === 'finalise')).toBe(true);
		expect(last.mzi?.qfiOpt).toBeGreaterThan(0);
		expect(last.metrics?.Rint).not.toBeNull();
		expect(last.best.setup?.readouts?.best).toBeGreaterThan(0);
		expect(last.traces.some((t) => t.done && t.points.length > 0)).toBe(true);
		engine.dispose();
	}, 60_000);

	it('stops at once and continues with the next seeds, keeping the bests', async () => {
		const fakes: FakeWorker[] = [];
		const engine = createAncillaEngine(
			() => {
				const w = new FakeWorker();
				fakes.push(w);
				return w;
			},
			{ progressMs: 20 }
		);
		const setup = { ...smallSetup(), coupling: Array(9).fill(false) };
		const first = waitFor(engine, (e) => (snap(e)?.seedsDone.setup ?? 0) >= 2);
		engine.start(setup, { ...budget, workers: 2 });
		await first;
		const events: RunEvent[] = [];
		engine.subscribe((e) => events.push(e));
		const t0 = performance.now();
		engine.stop();
		expect(performance.now() - t0).toBeLessThan(1000);
		const stopped = events.find((e) => e.type === 'stopped');
		expect(stopped).toBeDefined();
		const before = snap(stopped as RunEvent) as RunSnapshot;
		expect(fakes.every((f) => f.dead)).toBe(true);
		await new Promise((r) => setTimeout(r, 100));
		expect(events.length).toBe(1);

		const more = waitFor(
			engine,
			(e) => (snap(e)?.seedsDone.setup ?? 0) >= before.seedsDone.setup + 2
		);
		engine.continue();
		const after = snap(await more) as RunSnapshot;
		engine.stop();
		expect(after.best.setup?.qfi).toBeGreaterThanOrEqual(before.best.setup?.qfi ?? Infinity);
		const issued = fakes
			.flatMap((f) => f.received)
			.flatMap((m) => (m.type === 'seed' ? [m.seed] : []));
		// every seed index up to the highest one issued, none skipped
		const max = Math.max(...issued);
		for (let k = 0; k <= max; k++) expect(issued).toContain(k);
		expect(after.traces.every((t) => t.role === 'setup')).toBe(true);
		engine.dispose();
	}, 60_000);

	it('reproduces a single-worker run with a fixed seed count', async () => {
		const run = async () => {
			const fakes: FakeWorker[] = [];
			const engine = createAncillaEngine(
				() => {
					const w = new FakeWorker();
					fakes.push(w);
					return w;
				},
				{ progressMs: 20 }
			);
			const done = waitFor(engine, (e) => (snap(e)?.seedsDone.setup ?? 0) >= 3);
			engine.start(smallSetup(), budget);
			await done;
			engine.dispose();
			return fakes[0].seeds.filter((s) => s.role === 'setup').slice(0, 3);
		};
		const a = await run();
		const b = await run();
		expect(a.length).toBe(3);
		expect(b).toEqual(a);
		expect(a.map((s) => s.seed)).toEqual([0, 1, 2]);
		expect(new Set(a.map((s) => s.qfi)).size).toBeGreaterThan(1);
	}, 60_000);

	it('reports invalid setups and worker failures as errors', async () => {
		const engine = createAncillaEngine(() => new FakeWorker());
		const events: RunEvent[] = [];
		engine.subscribe((e) => events.push(e));
		engine.start({ ...smallSetup(), nS: 0 }, budget);
		expect(events[0]?.type).toBe('error');

		const broken = createAncillaEngine(() => {
			const w = new FakeWorker();
			w.postMessage = (msg) => {
				if (msg.type !== 'init')
					setTimeout(() =>
						w.onmessage?.({ data: { type: 'error', message: 'boom' } } as MessageEvent<FromWorker>)
					);
			};
			return w;
		});
		const err = waitFor(broken, () => false);
		broken.start(smallSetup(), budget);
		expect(await err).toEqual({ type: 'error', message: 'boom' });
	});
});
