import { describe, expect, it } from 'vitest';
import { associations, type ScoredRun } from './history';
import type { InputKind, Run } from './types';

function scored(
	labels: Run['labels'],
	d: number,
	input: InputKind = 'keyboard',
	flagged = false
): ScoredRun {
	const run = { id: String(Math.random()), labels, input } as unknown as Run;
	return { run, score: { d, pairs: [d, d], fastShare: 0, flagged, errorShare: 0 } };
}

const AB = { targets: ['A', 'B'], attributes: ['Good', 'Bad'] } as Run['labels'];
const CD = { targets: ['C', 'D'], attributes: ['Good', 'Bad'] } as Run['labels'];

describe('associations', () => {
	it('averages counted runs of both inputs per comparison and leaves flagged runs out', () => {
		const a = associations([
			scored(AB, 0.2),
			scored(AB, 0.4, 'touch'),
			scored(AB, 3, 'keyboard', true),
			scored(CD, -0.5)
		]);
		expect(a.map((x) => x.labels)).toEqual([AB, CD]);
		expect(a[0].mean).toBeCloseTo(0.3);
		expect(a[0].n).toBe(2);
		expect(a[0].ci).toBeUndefined();
		expect(a[1]).toEqual({ labels: CD, mean: -0.5, n: 1 });
	});

	it('adds a 95% interval from 3 counted runs', () => {
		const [a] = associations([scored(AB, 0.1), scored(AB, 0.3), scored(AB, 0.5)]);
		expect(a.ci![0]).toBeLessThan(0.3);
		expect(a.ci![1]).toBeGreaterThan(0.3);
	});

	it('leaves out a comparison whose runs were all too fast', () => {
		expect(associations([scored(AB, 1, 'keyboard', true)])).toEqual([]);
	});
});
