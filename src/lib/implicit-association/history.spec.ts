import { describe, expect, it } from 'vitest';
import { associations, sections, type ScoredRun } from './history';
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

describe('sections', () => {
	const assoc = (t: [string, string], a: [string, string], mean: number) => ({
		labels: { targets: t, attributes: a },
		mean,
		n: 1
	});
	const GB: [string, string] = ['Good', 'Bad'];

	it('draws every Good/Bad comparison on one axis, and Male/Female on its own axis', () => {
		const s = sections([
			assoc(['Male', 'Female'], ['Science', 'Arts'], 0.4),
			assoc(['Male', 'Female'], ['Career', 'Family'], 0.3),
			assoc(['Young', 'Old'], GB, 0.5),
			assoc(['Europe', 'US'], GB, -0.2),
			assoc(['White', 'Black'], GB, 0.1)
		]);
		expect(s.map((x) => x.ends)).toEqual([GB, ['Male', 'Female']]);
		expect(s[0].dumbbells.map((d) => d.names[0])).toEqual(['Young', 'Europe', 'White']);
		// On a group axis, the dumbbell runs between the attributes, leaning the same way.
		expect(s[1].dumbbells.map((d) => [d.names, d.lean])).toEqual([
			[['Science', 'Arts'], 0.4],
			[['Career', 'Family'], 0.3]
		]);
	});

	it('puts a lone comparison on its attribute axis', () => {
		const s = sections([assoc(['A', 'B'], GB, 0.2)]);
		expect(s.map((x) => x.ends)).toEqual([GB]);
	});

	it('finds the minimum when greedy picks would not', () => {
		// Two attribute pairs each shared by two group pairs, and one cross link: 2 axes suffice.
		const s = sections([
			assoc(['A', 'B'], ['X1', 'X2'], 0.1),
			assoc(['C', 'D'], ['X1', 'X2'], 0.1),
			assoc(['A', 'B'], ['Y1', 'Y2'], 0.1),
			assoc(['E', 'F'], ['Y1', 'Y2'], 0.1)
		]);
		expect(s).toHaveLength(2);
		expect(s.flatMap((x) => x.dumbbells)).toHaveLength(4);
	});
});
