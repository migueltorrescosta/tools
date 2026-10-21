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

/**
 * With simulated Start claims (100 seeds): person i claims item k when their
 * true value is within θ p_k of the item's top value (θ = 0.15), so the top
 * valuer always claims; with err = 0.1 a tenth of the claim decisions flip.
 * A claim must weigh clearly less than a round pick: measured as the
 * posterior shift in w_ik − w_jk from the prior, one single claim moves it
 * 0.040 (n = 2) or 0.060 (n = 3) at λ_S = 0.25, against 0.13 / 0.093
 * (n = 2, m = 10 / 20) and 0.17 / 0.12 (n = 3) for the median-priced item
 * after one round in which i takes its group and j does not — at most about
 * half. Within λ_S ≤ 0.25 the strength barely matters, because claims mostly
 * act by breaking the owner rule's near-ties. Pinned: median rounds, share of
 * items with their top valuer at the outcome (`top`, against `without`,
 * measured without Start), the envy-free share and the mean claimants per
 * item, with and without errors.
 */
const START_SETTINGS = [
	// n, m, σ, median, top, envy-free, claimants; top without Start; with err 0.1: top, envy-free, claimants
	{
		n: 2,
		m: 4,
		sigma: 0.1,
		median: 1,
		top: 0.73,
		ef: 0.98,
		claimants: 1.77,
		without: 0.715,
		errTop: 0.723,
		errEf: 0.97,
		errClaimants: 1.6
	},
	{
		n: 2,
		m: 4,
		sigma: 0.5,
		median: 1,
		top: 0.91,
		ef: 1,
		claimants: 1.2,
		without: 0.718,
		errTop: 0.848,
		errEf: 0.99,
		errClaimants: 1.19
	},
	{
		n: 3,
		m: 6,
		sigma: 0.3,
		median: 2,
		top: 0.81,
		ef: 0.99,
		claimants: 1.49,
		without: 0.627,
		errTop: 0.745,
		errEf: 0.99,
		errClaimants: 1.48
	},
	{
		n: 3,
		m: 12,
		sigma: 0.3,
		median: 1,
		top: 0.803,
		ef: 1,
		claimants: 1.46,
		without: 0.5,
		errTop: 0.704,
		errEf: 1,
		errClaimants: 1.45
	},
	{
		n: 4,
		m: 10,
		sigma: 0.5,
		median: 2,
		top: 0.861,
		ef: 1,
		claimants: 1.37,
		without: 0.543,
		errTop: 0.724,
		errEf: 0.97,
		errClaimants: 1.53
	},
	{
		n: 5,
		m: 20,
		sigma: 0.3,
		median: 1,
		top: 0.779,
		ef: 1,
		claimants: 1.57,
		without: 0.412,
		errTop: 0.652,
		errEf: 1,
		errClaimants: 1.73
	},
	{
		n: 2,
		m: 50,
		sigma: 0.3,
		median: 1,
		top: 0.853,
		ef: 1,
		claimants: 1.3,
		without: 0.539,
		errTop: 0.775,
		errEf: 1,
		errClaimants: 1.23
	},
	{
		n: 3,
		m: 50,
		sigma: 0.3,
		median: 1,
		top: 0.806,
		ef: 1,
		claimants: 1.43,
		without: 0.405,
		errTop: 0.716,
		errEf: 1,
		errClaimants: 1.44
	},
	{
		n: 2,
		m: 50,
		sigma: 0.6,
		median: 1,
		top: 0.908,
		ef: 1,
		claimants: 1.18,
		without: 0.539,
		errTop: 0.818,
		errEf: 1,
		errClaimants: 1.14
	}
];
const START_SEEDS = 100;
const START_SLACK = 0.03;

describe('split simulation: with simulated Start claims', () => {
	for (const s of START_SETTINGS) {
		it(`n=${s.n} m=${s.m} σ=${s.sigma}`, () => {
			const r = compare(s.n, s.m, s.sigma, START_SEEDS, DEFAULT_PARAMS, { theta: 0.15, err: 0 });
			expect(r.medianRounds).toBeLessThanOrEqual(s.median);
			expect(r.topShare).toBeGreaterThanOrEqual(s.top - START_SLACK);
			expect(r.topShare).toBeGreaterThan(s.without);
			expect(r.envyFree).toBeGreaterThanOrEqual(s.ef - START_SLACK);
			expect(r.claimants).toBeCloseTo(s.claimants, 1);
			// Wrong claims cost efficiency but not fairness.
			const e = compare(s.n, s.m, s.sigma, START_SEEDS, DEFAULT_PARAMS, { theta: 0.15, err: 0.1 });
			expect(e.topShare).toBeGreaterThanOrEqual(s.errTop - START_SLACK);
			expect(e.envyFree).toBeGreaterThanOrEqual(s.errEf - START_SLACK);
			expect(e.claimants).toBeCloseTo(s.errClaimants, 1);
		}, 120_000);
	}
});
