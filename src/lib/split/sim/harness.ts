/**
 * Truthful-agent simulation of the split engine, shared by the simulation
 * spec and throwaway tuning scripts.
 */
import {
	bestFallback,
	initState,
	isCertified,
	propose,
	recordRound,
	roundCap,
	type Proposal,
	type SplitParams
} from '../engine';
import { seededRng } from '../rng';
import { roundedBalances } from '../settle';
import { runBaseline } from './baseline';
import type { Rng } from '../types';

export interface Case {
	entered: number[];
	truth: number[][];
	/** The case's stream, positioned after drawing prices and values. */
	rng: Rng;
}

/**
 * Entered prices round(100 + 9900 u); true values entered_k · exp(σ g), each
 * person's row rescaled to the entered total.
 */
export function makeCase(n: number, m: number, sigma: number, seed: number): Case {
	const rng = seededRng(seed);
	const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
	const entered = Array.from({ length: m }, () => Math.round(100 + rng() * 9900));
	const total = entered.reduce((a, b) => a + b, 0);
	const truth = Array.from({ length: n }, () => {
		const r = entered.map((v) => v * Math.exp(sigma * gauss()));
		const s = r.reduce((a, b) => a + b, 0);
		return r.map((v) => (v * total) / s);
	});
	return { entered, truth, rng };
}

/** Surplus of each group for one person: true bundle value minus its transfer. */
export function surpluses(
	values: readonly number[],
	p: Proposal,
	transfers: readonly number[] = p.transfers
) {
	return p.groups.map((g, b) => g.reduce((s, k) => s + values[k], 0) - transfers[b]);
}

/** Truthful pick: the group with the highest surplus, ties to the lowest index. */
export function bestResponse(values: readonly number[], p: Proposal): number {
	const s = surpluses(values, p);
	let best = 0;
	for (let b = 1; b < s.length; b++) if (s[b] > s[best]) best = b;
	return best;
}

/** Largest true envy (euros) when person i takes group take[i] at the given transfers. */
export function maxEnvy(
	truth: readonly (readonly number[])[],
	p: Proposal,
	take: readonly number[],
	transfers: readonly number[]
): number {
	let worst = 0;
	truth.forEach((values, i) => {
		const s = surpluses(values, p, transfers);
		for (const v of s) worst = Math.max(worst, v - s[take[i]]);
	});
	return worst;
}

export interface EngineRun {
	/** Round on which picks were a permutation (1-based), or −1 within the horizon. */
	certifiedAt: number;
	cap: number;
	/** True max envy at the outcome by the cap, in fair shares (certified: whole-euro transfers). */
	envyAtCap: number;
	/** Largest envy in euros of a certified outcome at whole-euro transfers (0 if not certified). */
	roundingEnvy: number;
}

export type Picker = (values: readonly number[], p: Proposal, rng: Rng) => number;

/**
 * propose → picks → stop when certified → recordRound, up to `horizon` × cap
 * rounds. At the cap, the fallback's true envy (owners take their groups) is
 * the outcome if not yet certified.
 */
export function runEngine(
	c: Case,
	params: SplitParams,
	horizon = 3,
	pick: Picker = (v, p) => bestResponse(v, p)
): EngineRun {
	const n = c.truth.length;
	const m = c.entered.length;
	const share = c.entered.reduce((a, b) => a + b, 0) / n;
	const cap = roundCap(m, n);
	let state = initState(c.entered, n, params);
	let envyAtCap = NaN;
	for (let r = 1; r <= horizon * cap; r++) {
		const p = propose(state);
		const picks = c.truth.map((v) => pick(v, p, c.rng));
		if (isCertified(picks, n)) {
			const t = roundedBalances(p.transfers);
			const e = maxEnvy(c.truth, p, picks, t);
			return { certifiedAt: r, cap, envyAtCap: r <= cap ? e / share : envyAtCap, roundingEnvy: e };
		}
		state = recordRound(state, p, picks);
		if (r === cap) {
			const fb = bestFallback(state).proposal;
			const take = Array<number>(n);
			fb.owners.forEach((i, b) => (take[i] = b));
			envyAtCap = maxEnvy(c.truth, fb, take, fb.transfers) / share;
		}
	}
	return { certifiedAt: -1, cap, envyAtCap, roundingEnvy: 0 };
}

/** Quantile by the lower-index convention of the original harness. */
export function quantile(xs: readonly number[], q: number): number {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(q * (s.length - 1))];
}

export interface SettingStats {
	n: number;
	m: number;
	sigma: number;
	seeds: number;
	cap: number;
	/** Median and p90 rounds to a certificate (Infinity when not certified within 3 × cap). */
	medianRounds: number;
	p90Rounds: number;
	/** Share certified within the cap, and within 3 × cap. */
	certifiedByCap: number;
	certifiedEver: number;
	/** Share whose outcome by the cap has true max envy < 1% of the fair share. */
	envyFree: number;
	/** Largest envy (euros) of a certified split at whole-euro transfers. */
	worstRoundingEnvy: number;
	baselineMedianRounds: number;
	baselineEnvyFree: number;
}

/** New engine vs the old one on seeds 1..seeds of one setting. */
export function compare(
	n: number,
	m: number,
	sigma: number,
	seeds: number,
	params: SplitParams,
	pick?: Picker
): SettingStats {
	const runs: EngineRun[] = [];
	const base: { rounds: number; envy: number }[] = [];
	for (let s = 1; s <= seeds; s++) {
		const c = makeCase(n, m, sigma, s);
		base.push(runBaseline(c.entered, c.truth, c.rng));
		runs.push(runEngine(makeCase(n, m, sigma, s), params, 3, pick));
	}
	const rounds = runs.map((r) => (r.certifiedAt < 0 ? Infinity : r.certifiedAt));
	const cap = runs[0].cap;
	return {
		n,
		m,
		sigma,
		seeds,
		cap,
		medianRounds: quantile(rounds, 0.5),
		p90Rounds: quantile(rounds, 0.9),
		certifiedByCap: runs.filter((r) => r.certifiedAt > 0 && r.certifiedAt <= cap).length / seeds,
		certifiedEver: runs.filter((r) => r.certifiedAt > 0).length / seeds,
		envyFree: runs.filter((r) => r.envyAtCap < 0.01).length / seeds,
		worstRoundingEnvy: Math.max(...runs.map((r) => r.roundingEnvy)),
		baselineMedianRounds: quantile(
			base.map((b) => b.rounds),
			0.5
		),
		baselineEnvyFree: base.filter((b) => b.envy < 0.01).length / seeds
	};
}
