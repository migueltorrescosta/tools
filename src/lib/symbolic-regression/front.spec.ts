import { describe, expect, it } from 'vitest';
import { computeScores, recommendedIndex } from './front';
import type { FrontEntry } from './types';

function entry(complexity: number, valMse: number, score: number): FrontEntry {
	return {
		complexity,
		expr: { kind: 'const', value: 0 },
		trainMse: valMse,
		valMse,
		valR2: 0,
		valRmse: Math.sqrt(valMse),
		score
	};
}

describe('computeScores', () => {
	it('is −Δln(valMse)/Δcomplexity, 0 for the first entry', () => {
		const scores = computeScores([
			{ complexity: 1, valMse: 100 },
			{ complexity: 3, valMse: 1 },
			{ complexity: 4, valMse: 1 }
		]);
		expect(scores[0]).toBe(0);
		expect(scores[1]).toBeCloseTo(Math.log(100) / 2, 12);
		expect(scores[2]).toBe(-0);
	});

	it('stays finite for an exact fit', () => {
		const scores = computeScores([
			{ complexity: 1, valMse: 1 },
			{ complexity: 2, valMse: 0 }
		]);
		expect(Number.isFinite(scores[1])).toBe(true);
		expect(scores[1]).toBeGreaterThan(700);
	});

	it('returns an empty array for an empty front', () => {
		expect(computeScores([])).toEqual([]);
	});
});

describe('recommendedIndex', () => {
	it('is −1 for an empty front', () => {
		expect(recommendedIndex([])).toBe(-1);
	});

	it('picks the only entry of a one-entry front', () => {
		expect(recommendedIndex([entry(1, 5, 0)])).toBe(0);
	});

	it('picks the highest score among entries within 1.5× the minimum loss', () => {
		const front = [entry(1, 10, 0), entry(3, 1.2, 1.1), entry(5, 1.0, 0.09), entry(7, 0.9, 0.05)];
		expect(recommendedIndex(front)).toBe(1);
	});

	it('excludes the highest overall score when its loss is above 1.5× the minimum', () => {
		// Entry 1 has the best score but 2.0 > 1.5 × 1.0, so entry 2 wins.
		const front = [entry(1, 50, 0), entry(3, 2.0, 1.6), entry(5, 1.4, 0.18), entry(9, 1.0, 0.08)];
		expect(recommendedIndex(front)).toBe(2);
	});

	it('includes an entry exactly at 1.5× the minimum', () => {
		const front = [entry(1, 1.5, 0.5), entry(2, 1.0, 0.4)];
		expect(recommendedIndex(front)).toBe(0);
	});

	it('breaks score ties towards the lower complexity', () => {
		const front = [entry(1, 1.2, 0), entry(4, 1.1, 0.3), entry(6, 1.0, 0.3)];
		expect(recommendedIndex(front)).toBe(1);
	});

	it('falls back to the most accurate entry when it alone is within the bound', () => {
		const front = [entry(1, 9, 0), entry(2, 4, 0.8), entry(3, 1, 1.4)];
		expect(recommendedIndex(front)).toBe(2);
	});
});
