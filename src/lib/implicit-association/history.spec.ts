import { describe, expect, it } from 'vitest';
import { dotRows, heatMap, type ScoredRun } from './history';
import type { InputKind, Run } from './types';

function scored(
	id: string,
	comparisonId: string,
	d: number,
	input: InputKind = 'keyboard',
	flagged = false
): ScoredRun {
	const run = {
		id,
		comparisonId,
		input,
		date: id,
		labels: {
			targets: ['A', 'B'],
			attributes: comparisonId === 'x' ? ['Good', 'Bad'] : ['Sci', 'Arts']
		}
	} as unknown as Run;
	return { run, score: { d, pairs: [d, d], fastShare: 0, flagged, errorShare: 0 } };
}

describe('dotRows', () => {
	it('splits rows by input and leaves flagged runs out of the mean', () => {
		const rows = dotRows([
			scored('1', 'x', 0.2),
			scored('2', 'x', 0.4),
			scored('3', 'x', 2, 'keyboard', true),
			scored('4', 'x', 0.9, 'touch')
		]);
		expect(rows.map((r) => r.key)).toEqual(['x:touch', 'x:keyboard']);
		expect(rows[1].mean).toBeCloseTo(0.3);
		expect(rows[1].ci).toBeUndefined();
		expect(rows[1].runs).toHaveLength(3);
	});
});

describe('heatMap', () => {
	it('averages unflagged runs per target pair and attribute pair', () => {
		const m = heatMap([
			scored('1', 'x', 0.2),
			scored('2', 'x', 0.4, 'touch'),
			scored('3', 'y', -0.5),
			scored('4', 'y', 3, 'keyboard', true)
		]);
		expect(m.rows).toEqual(['A / B']);
		expect(m.columns).toEqual(['Good / Bad', 'Sci / Arts']);
		expect(m.cells[0][0]!.mean).toBeCloseTo(0.3);
		expect(m.cells[0][1]).toEqual({ mean: -0.5, n: 1 });
	});
});
