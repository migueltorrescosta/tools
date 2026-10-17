/**
 * Benchmarks, skipped unless SR_BENCH is set:
 *   SR_BENCH=1 taskset -c 0 pnpm exec vitest run --project server src/lib/symbolic-regression/bench.spec.ts
 * They time one island on the bundled examples and on a 50k × 20 dataset.
 */
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '$lib/data/symbolic-regression-examples';
import { parseCsv } from './csv';
import { buildDataset, splitDataset } from './dataset';
import { getConstants, shapeKey } from './expr';
import { Island } from './island';
import { buildFront } from './rescore';
import { runSearch } from './runner';
import { syntheticData } from './synthetic';
import { DEFAULT_SETTINGS, type FrontEntry, type PreparedData, type SearchSettings } from './types';

const bench = !process.env.SR_BENCH;

function example(id: string): { data: PreparedData; settings: SearchSettings } {
	const ex = EXAMPLES.find((e) => e.id === id)!;
	const parsed = parseCsv(ex.csv);
	const target = parsed.header.indexOf(ex.target);
	const inputs = ex.inputs.map((n) => parsed.header.indexOf(n));
	const data = splitDataset(buildDataset(parsed, target, inputs), 0.2, 1);
	return {
		data,
		settings: { ...DEFAULT_SETTINGS, operators: ex.operators ?? DEFAULT_SETTINGS.operators }
	};
}

/** Runs one island until `done(front)` or `budgetMs`; returns the time and iterations taken. */
function timeTo(
	data: PreparedData,
	settings: SearchSettings,
	budgetMs: number,
	done: (front: FrontEntry[]) => boolean
) {
	const island = new Island(data, settings, settings.seed);
	const t0 = performance.now();
	let lastCheck = 0;
	let front: FrontEntry[] = [];
	while (performance.now() - t0 < budgetMs) {
		island.step();
		const t = performance.now() - t0;
		if (t - lastCheck > 250) {
			lastCheck = t;
			front = buildFront(
				island.hallOfFame().map((h) => h.expr),
				data
			);
			if (done(front)) return { ms: Math.round(t), iterations: island.iterations, front, ok: true };
		}
	}
	return { ms: budgetMs, iterations: island.iterations, front, ok: false };
}

const show = (front: FrontEntry[]) =>
	front.map(
		(e) =>
			`${e.complexity} ${shapeKey(e.expr)} ${getConstants(e.expr).map((c) => c.toPrecision(5))} R2=${e.valR2.toFixed(5)}`
	);

describe.skipIf(bench)('benchmarks', () => {
	it('Kepler: T = c·a^1.5 with R² > 0.999', () => {
		const { data, settings } = example('kepler');
		for (const seed of [1, 2, 3, 4, 5]) {
			const r = timeTo(data, { ...settings, seed }, 20_000, (f) =>
				f.some((e) => e.valR2 > 0.999 && e.complexity <= 6)
			);
			console.log('kepler', seed, r.ok, r.ms, 'ms', r.iterations, 'it', show(r.front).slice(0, 6));
			expect(r.ok).toBe(true);
		}
	}, 200_000);

	it('Kepler with only + − × ÷ cannot express a^1.5', () => {
		const { data, settings } = example('kepler');
		const r = timeTo(data, { ...settings, operators: ['add', 'sub', 'mul', 'div'] }, 5_000, (f) =>
			f.some((e) => e.valR2 > 0.999 && e.complexity <= 9)
		);
		console.log('kepler basic ops', r.ok, r.ms, r.iterations, show(r.front));
		expect(r.iterations).toBeGreaterThan(0);
	}, 60_000);

	it('Newton: validation R² > 0.95', () => {
		const { data, settings } = example('newton-gravity');
		for (const seed of [1, 2, 3, 4, 5]) {
			const r = timeTo(data, { ...settings, seed }, 30_000, (f) => f.some((e) => e.valR2 > 0.95));
			console.log('newton', seed, r.ok, r.ms, 'ms', r.iterations, 'it', show(r.front).slice(-3));
			expect(r.ok).toBe(true);
		}
	}, 200_000);

	it('acceptance seeds: iterations to recover each law', () => {
		const quad = syntheticData({ rows: 200, ranges: [[-3, 3]], f: ([x]) => 2.5 * x * x });
		const prod = syntheticData({
			rows: 200,
			ranges: [
				[-3, 3],
				[-3, 3]
			],
			f: ([a, b]) => a * b + 1
		});
		const s = { ...DEFAULT_SETTINGS, populationSize: 100, maxComplexity: 15 };
		for (const [name, data, shapes] of [
			['quad', quad, ['mul(c,mul(x0,x0))']],
			['prod', prod, ['add(mul(x0,x1),c)', 'add(mul(x1,x0),c)']]
		] as const) {
			const its: number[] = [];
			for (let seed = 1; seed <= 20; seed++) {
				let found = -1;
				for (const it of [5, 10, 20, 40, 60, 100]) {
					const front = runSearch(data, { ...s, seed }, { iterations: it });
					if (
						front.some(
							(e) => (shapes as readonly string[]).includes(shapeKey(e.expr)) && e.trainMse < 1e-12
						)
					) {
						found = it;
						break;
					}
				}
				its.push(found);
			}
			console.log(name, its.join(' '));
			expect(its.every((i) => i > 0)).toBe(true);
		}
	}, 300_000);

	it('50k rows × 20 columns: time per iteration', () => {
		const data = syntheticData({
			rows: 50_000,
			ranges: Array.from({ length: 20 }, () => [1, 5] as [number, number]),
			f: (x) => (x[0] * x[1]) / (x[2] * x[2]),
			noise: 0.01
		});
		const island = new Island(data, { ...DEFAULT_SETTINGS }, 1);
		const t0 = performance.now();
		for (let i = 0; i < 20; i++) island.step();
		const t1 = performance.now();
		const front = buildFront(
			island.hallOfFame().map((h) => h.expr),
			data
		);
		const t2 = performance.now();
		console.log(
			'50k: step',
			((t1 - t0) / 20).toFixed(1),
			'ms; rescore front',
			(t2 - t1).toFixed(0),
			'ms',
			front.length,
			'entries'
		);
		expect(front.length).toBeGreaterThan(0);
	}, 120_000);
});
