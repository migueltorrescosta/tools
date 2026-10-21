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
 * With a simulated Start (100 seeds): the group places item k on its top
 * valuer when that value beats the second-highest by more than θ p_k (θ =
 * 0.15), else leaves it contested; with err = 0.1 a tenth of placements go to
 * a wrong person. params.lambdaStart was picked by a grid over {2, 5, 10, 20}
 * (stronger Start was better on every measure, wrong placements included; 10
 * keeps a Start pair no stronger than a round pick). Pinned: median rounds,
 * share of items with their top valuer at the outcome (`top`, against `topWithout`
 * measured without Start) and the envy-free share, with and without errors.
 */
const START_SETTINGS = [
	// n, m, σ, median, top, envy-free; topWithout; with err 0.1: top, envy-free
	{
		n: 2,
		m: 4,
		sigma: 0.1,
		median: 1,
		top: 0.752,
		ef: 0.99,
		without: 0.715,
		errTop: 0.748,
		errEf: 0.99
	},
	{
		n: 2,
		m: 4,
		sigma: 0.5,
		median: 1,
		top: 0.907,
		ef: 1,
		without: 0.718,
		errTop: 0.828,
		errEf: 0.97
	},
	{
		n: 3,
		m: 6,
		sigma: 0.3,
		median: 2,
		top: 0.81,
		ef: 0.97,
		without: 0.627,
		errTop: 0.748,
		errEf: 0.97
	},
	{ n: 3, m: 12, sigma: 0.3, median: 1, top: 0.744, ef: 1, without: 0.5, errTop: 0.687, errEf: 1 },
	{
		n: 4,
		m: 10,
		sigma: 0.5,
		median: 3,
		top: 0.817,
		ef: 0.99,
		without: 0.543,
		errTop: 0.745,
		errEf: 0.97
	},
	{
		n: 5,
		m: 20,
		sigma: 0.3,
		median: 2,
		top: 0.705,
		ef: 1,
		without: 0.412,
		errTop: 0.657,
		errEf: 0.99
	},
	{
		n: 2,
		m: 50,
		sigma: 0.3,
		median: 1,
		top: 0.694,
		ef: 1,
		without: 0.539,
		errTop: 0.647,
		errEf: 1
	},
	{
		n: 3,
		m: 50,
		sigma: 0.3,
		median: 1,
		top: 0.675,
		ef: 1,
		without: 0.405,
		errTop: 0.627,
		errEf: 1
	},
	{ n: 2, m: 50, sigma: 0.6, median: 1, top: 0.732, ef: 1, without: 0.539, errTop: 0.692, errEf: 1 }
];
const START_SEEDS = 100;
const START_SLACK = 0.03;

describe('split simulation: with a simulated Start', () => {
	for (const s of START_SETTINGS) {
		it(`n=${s.n} m=${s.m} σ=${s.sigma}`, () => {
			const r = compare(s.n, s.m, s.sigma, START_SEEDS, DEFAULT_PARAMS, { theta: 0.15, err: 0 });
			expect(r.medianRounds).toBeLessThanOrEqual(s.median);
			expect(r.topShare).toBeGreaterThanOrEqual(s.top - START_SLACK);
			expect(r.topShare).toBeGreaterThan(s.without);
			expect(r.envyFree).toBeGreaterThanOrEqual(s.ef - START_SLACK);
			// Wrong placements cost efficiency but not fairness.
			const e = compare(s.n, s.m, s.sigma, START_SEEDS, DEFAULT_PARAMS, { theta: 0.15, err: 0.1 });
			expect(e.topShare).toBeGreaterThanOrEqual(s.errTop - START_SLACK);
			expect(e.envyFree).toBeGreaterThanOrEqual(s.errEf - START_SLACK);
		}, 120_000);
	}
});
