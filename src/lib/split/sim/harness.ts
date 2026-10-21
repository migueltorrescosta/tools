/** Truthful-agent simulation of the split engine, for the simulation and performance specs. */
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
import { Prng } from '$lib/prng';
import { roundedBalances } from '../settle';

interface Case {
	entered: number[];
	truth: number[][];
}

/**
 * Entered prices round(100 + 9900 u); true values entered_k · exp(σ g), each
 * person's row rescaled to the entered total.
 */
export function makeCase(n: number, m: number, sigma: number, seed: number): Case {
	const prng = new Prng(seed);
	const rng = () => prng.next();
	const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
	const entered = Array.from({ length: m }, () => Math.round(100 + rng() * 9900));
	const total = entered.reduce((a, b) => a + b, 0);
	const truth = Array.from({ length: n }, () => {
		const r = entered.map((v) => v * Math.exp(sigma * gauss()));
		const s = r.reduce((a, b) => a + b, 0);
		return r.map((v) => (v * total) / s);
	});
	return { entered, truth };
}

/** Surplus of each group for one person: true bundle value minus its transfer. */
function surpluses(
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
function maxEnvy(
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

interface EngineRun {
	/** Round on which picks were a permutation (1-based), or −1 within the horizon. */
	certifiedAt: number;
	cap: number;
	/** True max envy at the outcome by the cap, in fair shares (certified: whole-euro transfers). */
	envyAtCap: number;
	/** Largest envy in euros of a certified outcome at whole-euro transfers (0 if not certified). */
	roundingEnvy: number;
	/** At the outcome by the cap: share of items held by their top valuer. */
	topShare: number;
	/** At the outcome by the cap: true value lost against the best allocation, in fair shares. */
	valueLost: number;
}

/** Start simulation: θ is the claim margin, err the share of claim decisions flipped. */
export interface StartOptions {
	theta: number;
	err: number;
}

/**
 * Simulated Start claims: person i claims item k when their true value is
 * within θ p_k of the item's top value, so the top valuer always claims and
 * near-tied people claim too. A share `err` of the n × m claim decisions are
 * then flipped at random.
 */
function simulateClaims(c: Case, o: StartOptions, seed: number): number[][] {
	const prng = new Prng(0x57a27 + seed);
	return c.entered.map((p, k) => {
		const top = Math.max(...c.truth.map((t) => t[k]));
		const who: number[] = [];
		c.truth.forEach((t, i) => {
			const claims = t[k] >= top - o.theta * p;
			if (claims !== prng.next() < o.err) who.push(i);
		});
		return who;
	});
}

/** Item → person of an outcome where person i takes group take[i]. */
function holders(p: Proposal, take: readonly number[], m: number): number[] {
	const h = Array<number>(m).fill(-1);
	take.forEach((b, i) => p.groups[b].forEach((k) => (h[k] = i)));
	return h;
}

/**
 * propose → truthful picks → stop when certified → recordRound, up to 3 × cap
 * rounds. At the cap, the fallback (owners take their groups) is the outcome
 * if not yet certified.
 */
function runEngine(c: Case, params: SplitParams, claims?: number[][]): EngineRun {
	const n = c.truth.length;
	const m = c.entered.length;
	const share = c.entered.reduce((a, b) => a + b, 0) / n;
	const cap = roundCap(m, n);
	const best = c.entered.reduce((s, _, k) => s + Math.max(...c.truth.map((t) => t[k])), 0);
	const allocation = (h: number[]) => ({
		topShare:
			h.filter((i, k) => c.truth[i][k] === Math.max(...c.truth.map((t) => t[k]))).length / m,
		valueLost: (best - h.reduce((s, i, k) => s + c.truth[i][k], 0)) / share
	});
	let state = initState(c.entered, n, params, claims);
	let atCap = { envy: NaN, topShare: NaN, valueLost: NaN };
	for (let r = 1; r <= 3 * cap; r++) {
		const p = propose(state);
		const picks = c.truth.map((v) => bestResponse(v, p));
		if (isCertified(picks, n)) {
			const t = roundedBalances(p.transfers);
			const e = maxEnvy(c.truth, p, picks, t);
			if (r <= cap) atCap = { envy: e / share, ...allocation(holders(p, picks, m)) };
			return {
				certifiedAt: r,
				cap,
				envyAtCap: atCap.envy,
				roundingEnvy: e,
				topShare: atCap.topShare,
				valueLost: atCap.valueLost
			};
		}
		state = recordRound(state, p, picks);
		if (r === cap) {
			const fb = bestFallback(state).proposal;
			const take = Array<number>(n);
			fb.owners.forEach((i, b) => (take[i] = b));
			atCap = {
				envy: maxEnvy(c.truth, fb, take, fb.transfers) / share,
				...allocation(holders(fb, take, m))
			};
		}
	}
	return {
		certifiedAt: -1,
		cap,
		envyAtCap: atCap.envy,
		roundingEnvy: 0,
		topShare: atCap.topShare,
		valueLost: atCap.valueLost
	};
}

/** Quantile by the lower-index convention of the original harness. */
function quantile(xs: readonly number[], q: number): number {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(q * (s.length - 1))];
}

interface SettingStats {
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
	/** Mean share of items with their top valuer, and mean value lost (fair shares), by the cap. */
	topShare: number;
	valueLost: number;
	/** Mean claimants per item (0 without Start). */
	claimants: number;
}

/** Engine statistics on seeds 1..seeds of one setting, optionally with a simulated Start. */
export function compare(
	n: number,
	m: number,
	sigma: number,
	seeds: number,
	params: SplitParams,
	start?: StartOptions
): SettingStats {
	const runs: EngineRun[] = [];
	let claimants = 0;
	for (let s = 1; s <= seeds; s++) {
		const c = makeCase(n, m, sigma, s);
		const st = start && simulateClaims(c, start, s);
		if (st) claimants += st.reduce((a, who) => a + who.length, 0) / m;
		runs.push(runEngine(c, params, st));
	}
	const rounds = runs.map((r) => (r.certifiedAt < 0 ? Infinity : r.certifiedAt));
	const cap = runs[0].cap;
	const mean = (f: (r: EngineRun) => number) => runs.reduce((a, r) => a + f(r), 0) / seeds;
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
		topShare: mean((r) => r.topShare),
		valueLost: mean((r) => r.valueLost),
		claimants: claimants / seeds
	};
}
