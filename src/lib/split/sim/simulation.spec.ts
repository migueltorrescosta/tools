import { describe, it, expect } from 'vitest';
import { compare } from './harness';

/**
 * Truthful-agent simulation, 200 seeds per setting (n people, m items, taste
 * spread σ). The model settings in engine.ts were picked by a grid search
 * with this harness; the bounds below pin the measured results with a little
 * slack so a regression fails. The old engine's numbers for the same
 * settings are in tools#38 and its PR.
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
			const r = compare(s.n, s.m, s.sigma, SEEDS);
			expect(r.medianRounds).toBeLessThanOrEqual(s.median);
			expect(r.certifiedByCap).toBeGreaterThanOrEqual(s.byCap - SLACK);
			expect(r.envyFree).toBeGreaterThanOrEqual(s.envyFree - SLACK);
			// Certified splits are exactly envy-free; whole-euro rounding moves
			// each transfer by under 1 €, so envy stays under 2 €.
			expect(r.worstRoundingEnvy).toBeLessThan(2);
		}, 60_000);
	}
});

/**
 * With simulated Start claims (100 seeds), the private "own share" model:
 * each person claims their items by value per entered euro until the claims
 * reach a fair share. λ_S was chosen with this model (PR #39). Pinned: median
 * rounds, share of items with their top valuer at the outcome (against the
 * same seeds without claims) and the envy-free share.
 */
const START_SETTINGS = [
	// n, m, σ, median rounds, top-valuer share, envy-free share; top share without claims
	{ n: 2, m: 10, sigma: 0.3, median: 1, top: 0.754, ef: 1, without: 0.608 },
	{ n: 2, m: 50, sigma: 0.3, median: 1, top: 0.751, ef: 1, without: 0.539 },
	{ n: 3, m: 20, sigma: 0.3, median: 1, top: 0.682, ef: 1, without: 0.465 },
	{ n: 4, m: 20, sigma: 0.3, median: 1, top: 0.66, ef: 1, without: 0.424 },
	{ n: 5, m: 20, sigma: 0.3, median: 2, top: 0.661, ef: 1, without: 0.412 }
];
const START_SEEDS = 100;
const START_SLACK = 0.03;

describe('split simulation: with simulated Start claims', () => {
	for (const s of START_SETTINGS) {
		it(`n=${s.n} m=${s.m} σ=${s.sigma}`, () => {
			const r = compare(s.n, s.m, s.sigma, START_SEEDS, true);
			expect(r.medianRounds).toBeLessThanOrEqual(s.median);
			expect(r.topShare).toBeGreaterThanOrEqual(s.top - START_SLACK);
			expect(r.topShare).toBeGreaterThan(s.without);
			expect(r.envyFree).toBeGreaterThanOrEqual(s.ef - START_SLACK);
			expect(r.worstRoundingEnvy).toBeLessThan(2);
		}, 60_000);
	}
});
