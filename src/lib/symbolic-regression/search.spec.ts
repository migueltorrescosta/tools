import { describe, expect, it } from 'vitest';
import { getConstants, shapeKey } from './expr';
import { runSearch } from './runner';
import { syntheticData } from './synthetic';
import { DEFAULT_SETTINGS, type FrontEntry, type SearchSettings } from './types';

const settings = (o: Partial<SearchSettings> = {}): SearchSettings => ({
	...DEFAULT_SETTINGS,
	populationSize: 100,
	maxComplexity: 15,
	...o
});

const quadratic = syntheticData({ rows: 200, ranges: [[-3, 3]], f: ([x]) => 2.5 * x * x });
const product = syntheticData({
	rows: 200,
	ranges: [
		[-3, 3],
		[-3, 3]
	],
	f: ([a, b]) => a * b + 1
});

// cost = 4 + 0.8·w + 6·1[zone ∈ {2, 3}] over five zones
const zones = ['a', 'b', 'c', 'd', 'e'];
const categorical = syntheticData({
	rows: 300,
	ranges: [
		[0.5, 20],
		[0, 0]
	],
	levels: [null, zones],
	f: ([w, z]) => 4 + 0.8 * w + (z === 2 || z === 3 ? 6 : 0)
});

/** The front entry with one of the given shapes, if any. */
function find(front: FrontEntry[], shapes: string[]): FrontEntry | undefined {
	return front.find((e) => shapes.includes(shapeKey(e.expr)));
}

// Every seed in 1..20 recovers both laws within 60 iterations (see bench.spec.ts).
const ITERATIONS = 100;

describe('runSearch', () => {
	it('is bit-reproducible for a fixed seed and iteration count', () => {
		const run = () => JSON.stringify(runSearch(product, settings({ seed: 3 }), { iterations: 10 }));
		expect(run()).toBe(run());
		expect(run()).not.toBe(
			JSON.stringify(runSearch(product, settings({ seed: 4 }), { iterations: 10 }))
		);
	});

	it('recovers y = 2.5·x²', () => {
		const front = runSearch(quadratic, settings({ seed: 1 }), { iterations: ITERATIONS });
		const hit = find(front, ['mul(c,mul(x0,x0))']);
		expect(hit, JSON.stringify(front.map((e) => shapeKey(e.expr)))).toBeDefined();
		expect(Math.abs(getConstants(hit!.expr)[0] - 2.5)).toBeLessThan(1e-3);
		expect(hit!.trainMse).toBeLessThan(1e-12);
	});

	it('recovers a set indicator on a categorical input', () => {
		const front = runSearch(categorical, settings({ seed: 1 }), { iterations: ITERATIONS });
		const exact = front.find((e) => e.trainMse < 1e-12);
		expect(exact, JSON.stringify(front.map((e) => shapeKey(e.expr)))).toBeDefined();
		expect(shapeKey(exact!.expr)).toMatch(/1\[x1:(12|19)\]/);
	});

	it('recovers y = x1·x2 + 1', () => {
		const front = runSearch(product, settings({ seed: 1 }), { iterations: ITERATIONS });
		const hit = find(front, ['add(mul(x0,x1),c)', 'add(mul(x1,x0),c)']);
		expect(hit, JSON.stringify(front.map((e) => shapeKey(e.expr)))).toBeDefined();
		expect(Math.abs(getConstants(hit!.expr)[0] - 1)).toBeLessThan(1e-3);
		expect(hit!.trainMse).toBeLessThan(1e-12);
	});
});
