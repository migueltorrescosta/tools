import { describe, expect, it } from 'vitest';
import { inputDensity, optimalDecisionPerGroup, qcut } from './groups';

/** Expected values from `pd.qcut(pd.Series(x, dtype=float), q, duplicates="drop", retbins=True)`. */
const CASES: [string, number[], number, number[], number[], string[]][] = [
	[
		'ties',
		[1, 1, 1, 1, 2, 2, 3, 4, 5, 5],
		4,
		[0, 0, 0, 0, 0, 0, 1, 2, 2, 2],
		[1, 2, 3.75, 5],
		['(0.999, 2.0]', '(2.0, 3.75]', '(3.75, 5.0]']
	],
	[
		'duplicate edges',
		[0, 0, 0, 0, 0, 0, 0, 1, 2, 3],
		4,
		[0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
		[0, 0.75, 3],
		['(-0.001, 0.75]', '(0.75, 3.0]']
	],
	[
		'tiny n',
		[3.5, -1.25, 2],
		5,
		[4, 0, 2],
		[-1.25, 0.050000000000000044, 1.35, 2.3000000000000007, 2.9000000000000004, 3.5],
		['(-1.251, 0.05]', '(0.05, 1.35]', '(1.35, 2.3]', '(2.3, 2.9]', '(2.9, 3.5]']
	],
	['one bin', [1, 2, 3], 1, [0, 0, 0], [1, 3], ['(0.999, 3.0]']],
	[
		'integers',
		[10084, 9934, 10000, 9790, 10200, 10084, 9950],
		3,
		[1, 0, 1, 0, 2, 1, 0],
		[9790, 9950, 10084, 10200],
		['(9789.999, 9950.0]', '(9950.0, 10084.0]', '(10084.0, 10200.0]']
	],
	[
		'small values',
		[0.0001234, 0.0002, 0.00031, 0.0004],
		2,
		[0, 0, 1, 1],
		[0.0001234, 0.000255, 0.0004],
		['(-0.000877, 0.000255]', '(0.000255, 0.0004]']
	]
];

describe('qcut', () => {
	it.each(CASES)('matches pandas: %s', (_, x, q, codes, edges, labels) => {
		const g = qcut(Float64Array.from(x), q);
		expect(Array.from(g.codes)).toEqual(codes);
		expect(Array.from(g.edges)).toEqual(edges);
		expect(g.labels).toEqual(labels);
		expect(g.count).toBe(edges.length - 1);
	});

	it('puts a constant column in one group (pandas leaves it unassigned)', () => {
		const g = qcut(Float64Array.from([7, 7]), 3);
		expect(Array.from(g.codes)).toEqual([0, 0]);
		expect(g.count).toBe(1);
	});
});

describe('optimalDecisionPerGroup', () => {
	it('averages each decision per group and skips empty groups', () => {
		// Groups (0.999, 2.5] and (2.5, 5.0]; two decisions.
		const x = Float64Array.from([1, 2, 5, 3]);
		const loss = Float64Array.from([0, 4, 2, 0, 9, 1, 3, 1]);
		const table = optimalDecisionPerGroup(x, loss, 2, 2);
		expect(table.groups.map((g) => g.label)).toEqual(['(0.999, 2.5]', '(2.5, 5.0]']);
		expect(table.groups.map((g) => Array.from(g.meanLoss))).toEqual([
			[1, 2],
			[6, 1]
		]);
		expect(table.groups.map((g) => g.optimal)).toEqual([0, 1]);
		expect(table.groups.map((g) => g.count)).toEqual([2, 2]);
		// Edges 0, 2.5, 5, 7.5, 10 leave the middle groups empty.
		const sparse = optimalDecisionPerGroup(
			Float64Array.from([0, 10]),
			Float64Array.from([1, 2]),
			1,
			4
		);
		expect(sparse.groups.map((g) => [g.group, g.label])).toEqual([
			[0, '(-0.001, 2.5]'],
			[3, '(7.5, 10.0]']
		]);
	});
});

describe('inputDensity', () => {
	it('gives deciles and a normalised density', () => {
		const x = Float64Array.from({ length: 10001 }, (_, i) => i / 10000);
		const d = inputDensity(x);
		expect(d.deciles[0]).toBeCloseTo(0.1, 12);
		expect(d.deciles[8]).toBeCloseTo(0.9, 12);
		expect(d.grid.length).toBe(200);
		let area = 0;
		for (let k = 1; k < 200; k++)
			area += ((d.density[k] + d.density[k - 1]) / 2) * (d.grid[k] - d.grid[k - 1]);
		// The kernel spills past [min, max], so a bit under 1.
		expect(area).toBeGreaterThan(0.9);
		expect(area).toBeLessThan(1);
	});

	it('returns a zero density for a constant column', () => {
		const d = inputDensity(Float64Array.from([2, 2, 2]));
		expect(d.bandwidth).toBe(0);
		expect(Array.from(d.density).every((v) => v === 0)).toBe(true);
	});
});
