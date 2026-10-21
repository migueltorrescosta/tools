import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMS } from '../engine';
import { compare } from './harness';

/**
 * Truthful-agent simulation, 200 seeds per setting (n people, m items, taste
 * spread σ). DEFAULT_PARAMS were picked by a grid search over σμ, τ, λ (and
 * the owner slack) with this harness; the bounds below pin the measured
 * results with a little slack so a regression fails. The old engine's numbers
 * for the same settings are quoted in tools#38 and its PR.
 */
const SETTINGS = [
	// n, m, σ, measured median rounds, certified by cap, envy-free share
	{ n: 2, m: 4, sigma: 0.1, median: 1, byCap: 0.945, envyFree: 0.97 },
	{ n: 2, m: 4, sigma: 0.5, median: 1, byCap: 0.995, envyFree: 0.995 },
	{ n: 3, m: 6, sigma: 0.3, median: 3, byCap: 0.95, envyFree: 0.97 },
	{ n: 3, m: 12, sigma: 0.3, median: 3, byCap: 0.985, envyFree: 0.99 },
	{ n: 4, m: 10, sigma: 0.5, median: 4, byCap: 0.975, envyFree: 0.975 },
	{ n: 5, m: 20, sigma: 0.3, median: 5, byCap: 0.96, envyFree: 0.965 }
];
const SEEDS = 200;
const SLACK = 0.02;

describe('split simulation: propose and certify', () => {
	for (const s of SETTINGS) {
		it(`n=${s.n} m=${s.m} σ=${s.sigma}`, () => {
			const r = compare(s.n, s.m, s.sigma, SEEDS, DEFAULT_PARAMS);
			expect(r.medianRounds).toBeLessThanOrEqual(s.median);
			expect(r.certifiedByCap).toBeGreaterThanOrEqual(s.byCap - SLACK);
			expect(r.envyFree).toBeGreaterThanOrEqual(s.envyFree - SLACK);
			// Certified splits are exactly envy-free; whole-euro rounding moves
			// each transfer by under 1 €, so envy stays under 2 €.
			expect(r.worstRoundingEnvy).toBeLessThan(2);
		}, 60_000);
	}
});
