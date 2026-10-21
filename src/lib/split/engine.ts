/**
 * Propose-and-certify split engine (migueltorrescosta/tools#38).
 *
 * Each person i has values v_ik = p_k (1 + μ_k + δ_ik): a shared deviation
 * μ_k ~ N(0, σμ²) per item and a personal one δ_ik ~ N(0, τ²). Each round the
 * engine proposes n groups with envy-free transfers under the posterior; every
 * person picks a group; a pick is a logit choice over bundle surplus. The
 * split is certified the first round the picks form a permutation.
 *
 * All functions are pure and synchronous. Items and people are indices.
 *
 * Fit. The engine works in w-coordinates, w_i = μ + δ_i ∈ R^m. Person i's
 * likelihood depends on w_i only, and the prior on W = (w_1..w_n) has
 * precision Λ0 = (I_n/τ² − c 1 1ᵀ) ⊗ I_m with c = σμ² / (τ² (τ² + n σμ²)).
 * The MAP is found by damped Newton, warm-started from the previous fit; once
 * a step is below 1e-3 the next step reuses the factors (a chord step), and
 * iteration stops below 1e-5. The
 * negative Hessian is P = D − c U Uᵀ with D = blockdiag(E_i), E_i = H_i + I/τ²
 * (H_i the data Hessian of person i, m×m) and U = 1_n ⊗ I_m. By Woodbury,
 * P⁻¹ = D⁻¹ + D⁻¹ U S⁻¹ Uᵀ D⁻¹ with S = I/c − Σ_i E_i⁻¹ (an m×m PD matrix
 * whose condition number is at most 1 + n σμ²/τ²). Each Newton step costs n
 * Cholesky factorisations of m×m and a conjugate-gradient solve with S, whose
 * matvec is 2n triangular solves. After convergence the Laplace approximation
 * N(Ŵ, P⁻¹) is kept as L_i⁻¹ (inverse Cholesky factor of E_i) for every
 * person and the Cholesky factor of S, formed explicitly once per fit.
 *
 * Draws. Writing W − Ŵ = X, the Laplace Gaussian is the hierarchical model
 * x_i | u ~ N(E_i⁻¹ u, E_i⁻¹) with u ~ N(0, S⁻¹), which has exactly the
 * covariance above. So x_i = L_i⁻ᵀ (L_i⁻¹ u + ε_i) with u = L_S⁻ᵀ η. The fit
 * keeps SAMPLES such draws (seeded, so deterministic per state); the owner
 * rule and the fallback's fairness are Monte Carlo over them. The
 * envy SDs σ_ib that drive the transfer LP are exact (block solves).
 *
 * Cost per fit at n people, m items, R rounds: about 2 n m³/6 per Newton
 * factorisation (Hessian blocks cost n m² R / 2), 2 n m³/6 for the inverses
 * and S, and n m² SAMPLES for the draws. At 10 × 500 after 50 rounds that is
 * about 1.7 s in Node on fugaku (draws ≈ 0.5 s, Cholesky ≈ 0.36 s).
 */

import {
	backSolve,
	cholesky,
	dot,
	forwardSolve,
	inverseTranspose,
	solveThenUpper,
	subtractGram,
	upperMul,
	upperTMul
} from './linalg';
import { maximize, type Constraint } from './lp';
import { Prng } from '$lib/prng';

export interface SplitParams {
	/** Prior SD of the shared per-item deviation μ_k. */
	sigmaMu: number;
	/** Prior SD of the personal deviation δ_ik. */
	tau: number;
	/** Logit sharpness: a surplus gap of 1/λ fair shares (T/n) gives odds e. */
	lambda: number;
}

/** Tuned by the truthful-agent simulation (src/lib/split/sim/simulation.spec.ts). */
export const DEFAULT_PARAMS: SplitParams = { sigmaMu: 0.3, tau: 0.4, lambda: 10 };

export interface Proposal {
	/** Item indices per group; exactly n groups, every item in one group. Groups may be empty. */
	groups: number[][];
	/** Per group: what its taker pays (+) or receives (−), in euros, unrounded; sums to 0. */
	transfers: number[];
	/** Per group: the person the model expects to take it (a permutation of 0..n-1). */
	owners: number[];
	/** Robustness margin z of the transfer LP (> 0: envy-free with slack under the posterior). */
	margin: number;
}

interface RoundRecord {
	proposal: Proposal;
	/** picks[i] = group index person i chose. */
	picks: number[];
}

/** Opaque fitted state; the UI never reads its fields. */
export interface SplitState {
	readonly prices: readonly number[];
	readonly n: number;
	readonly params: SplitParams;
	readonly rounds: readonly RoundRecord[];
}

/** Posterior draws kept per fit. */
const SAMPLES = 200;
/** Upper bound on the LP margin z, to keep stage 1 bounded. */
const MAX_MARGIN = 10;
const MAX_NEWTON = 10;
/** Below this Newton step (max |Δw|), the next step reuses the current factors. */
const CHORD_STEP = 1e-3;
/**
 * Owner rule: a person stays a candidate for an item while their posterior
 * mean is within OWNER_SLACK posterior SDs of the best (tuned by simulation).
 */
const OWNER_SLACK = 0.1;

interface Fit {
	/** MAP of W, n×m row-major (row i = w_i). */
	w: Float64Array;
	/** Per person: L_i⁻ᵀ where E_i = L_i L_iᵀ, m×m upper triangular. */
	ut: Float64Array[];
	/** Cholesky factor of S (null when σμ = 0: no coupling). */
	ls: Float64Array | null;
	/** Per person: draws of x_i = w_i − ŵ_i, sample-major SAMPLES×m. */
	draws: Float64Array[];
}

/** A round in array form: item → group, transfers, picks. */
interface Round {
	groupOf: Int32Array;
	t: Float64Array;
	picks: Int32Array;
	/** Items per group, ascending. */
	members: Int32Array[];
}

class FittedState implements SplitState {
	readonly prices: readonly number[];
	readonly n: number;
	readonly params: SplitParams;
	readonly rounds: readonly RoundRecord[];
	/** @internal */
	readonly fit: Fit;
	/** @internal memoised propose() */
	proposal: Proposal | null = null;

	constructor(
		prices: readonly number[],
		n: number,
		params: SplitParams,
		rounds: readonly RoundRecord[],
		fit: Fit
	) {
		this.prices = prices;
		this.n = n;
		this.params = params;
		this.rounds = rounds;
		this.fit = fit;
	}
}

function internal(state: SplitState): FittedState {
	if (!(state instanceof FittedState)) throw new Error('split: state must come from initState');
	return state;
}

export function initState(
	prices: readonly number[],
	n: number,
	params: SplitParams = DEFAULT_PARAMS
): SplitState {
	if (!Number.isInteger(n) || n < 1) throw new Error('split: n must be a positive integer');
	if (prices.length === 0 || prices.some((p) => !(p > 0 && Number.isFinite(p))))
		throw new Error('split: prices must be positive');
	const ps = Object.freeze([...prices]);
	const fit = fitPosterior(ps, n, params, [], new Float64Array(n * ps.length));
	return new FittedState(ps, n, Object.freeze({ ...params }), Object.freeze([]), fit);
}

/** Append a completed round and refit the posterior. */
export function recordRound(
	state: SplitState,
	proposal: Proposal,
	picks: readonly number[]
): SplitState {
	const s = internal(state);
	const { n, prices } = s;
	const m = prices.length;
	checkGroups(proposal.groups, n, m);
	if (proposal.transfers.length !== n) throw new Error('split: need one transfer per group');
	if (picks.length !== n || picks.some((c) => !Number.isInteger(c) || c < 0 || c >= n))
		throw new Error('split: need one pick per person, a group index');
	const record: RoundRecord = {
		proposal: {
			groups: proposal.groups.map((g) => [...g]),
			transfers: [...proposal.transfers],
			owners: [...proposal.owners],
			margin: proposal.margin
		},
		picks: [...picks]
	};
	const rounds = Object.freeze([...s.rounds, record]);
	const fit = fitPosterior(prices, n, s.params, rounds, s.fit.w);
	return new FittedState(prices, n, s.params, rounds, fit);
}

/** True when every person picked a different group. */
export function isCertified(picks: readonly number[], n: number): boolean {
	if (picks.length !== n) return false;
	const seen = new Set<number>();
	for (const c of picks) {
		if (!Number.isInteger(c) || c < 0 || c >= n || seen.has(c)) return false;
		seen.add(c);
	}
	return true;
}

/** Rounds after which the UI offers the best fallback: 2⌈m/n⌉ + 3. */
export function roundCap(m: number, n: number): number {
	return 2 * Math.ceil(m / n) + 3;
}

/**
 * The split the posterior currently believes in. With no rounds it equals LPT
 * grouping on the prices.
 *
 * Items go out by descending price (stable). For each item the candidates are
 * the people whose posterior-mean w_ik is within OWNER_SLACK = 0.1 posterior
 * SDs (of w_jk − w_best,k, from the draws) of the best; among them the item goes to
 * the one whose bundle so far is worth least at entered prices (lowest index
 * on ties). Group b is person b's bundle; transfers come from transfersFor.
 */
export function propose(state: SplitState): Proposal {
	const s = internal(state);
	if (s.proposal) return s.proposal;
	const { n, prices } = s;
	const m = prices.length;
	const { w, draws } = s.fit;
	const order = prices.map((_, k) => k).sort((a, b) => prices[b] - prices[a]);
	const held = new Float64Array(n);
	const groups = Array.from({ length: n }, () => [] as number[]);
	for (const k of order) {
		let best = 0;
		for (let j = 1; j < n; j++) if (w[j * m + k] > w[best * m + k]) best = j;
		const db = draws[best];
		let pick = best;
		for (let j = 0; j < n; j++) {
			if (j !== best) {
				const dj = draws[j];
				let s1 = 0;
				let s2 = 0;
				for (let r = 0; r < SAMPLES; r++) {
					const d = dj[r * m + k] - db[r * m + k];
					s1 += d;
					s2 += d * d;
				}
				const sd = Math.sqrt(Math.max(0, s2 / SAMPLES - (s1 / SAMPLES) ** 2));
				if (w[best * m + k] - w[j * m + k] > OWNER_SLACK * sd) continue;
			}
			if (held[j] < held[pick] || (held[j] === held[pick] && j < pick)) pick = j;
		}
		groups[pick].push(k);
		held[pick] += prices[k];
	}
	const p = transfersFor(
		s,
		groups,
		groups.map((_, b) => b)
	);
	s.proposal = p;
	return p;
}

/**
 * Envy-free transfers for given groups and owners (the swap/adjust step).
 *
 * With V_ib = Σ_{k∈G_b} p_k (1 + ŵ_ik) at the posterior mean and σ_ib the
 * posterior SD of V_i(own) − V_i(b), stage 1 maximises z subject to
 * V_io − t_o ≥ V_ib − t_b + z σ_ib for every person i (owning o) and group
 * b ≠ o, Σ t = 0 and z ≤ 10. Stage 2 keeps z ≥ z* and maximises the smallest
 * owner surplus min_i (V_io − t_o). Returns margin = z*.
 */
export function transfersFor(
	state: SplitState,
	groups: readonly (readonly number[])[],
	owners: readonly number[]
): Proposal {
	const s = internal(state);
	const { n, prices } = s;
	const m = prices.length;
	checkGroups(groups, n, m);
	if (!isCertified(owners, n)) throw new Error('split: owners must be a permutation of 0..n-1');
	const total = prices.reduce((a, b) => a + b, 0);
	const share = total / n;
	const groupOf = groupIndex(groups, m);
	const { mean, sd } = groupMoments(s.fit, prices, n, groupOf);
	const ownGroup = Array<number>(n);
	owners.forEach((i, b) => (ownGroup[i] = b));

	// Variables: t⁺ (n), t⁻ (n), z⁺, z⁻, u⁺, u⁻ — all in fair shares.
	const nv = 2 * n + 4;
	const tCoef = (row: number[], b: number, f: number) => {
		row[b] += f;
		row[n + b] -= f;
	};
	const rows: Constraint[] = [];
	for (let i = 0; i < n; i++) {
		const o = ownGroup[i];
		for (let b = 0; b < n; b++) {
			if (b === o) continue;
			const row = Array<number>(nv).fill(0);
			tCoef(row, o, 1);
			tCoef(row, b, -1);
			const sig = sd[i * n * n + o * n + b] / share;
			row[2 * n] = sig;
			row[2 * n + 1] = -sig;
			rows.push({ coeffs: row, op: '<=', rhs: (mean[i * n + o] - mean[i * n + b]) / share });
		}
	}
	const sum = Array<number>(nv).fill(0);
	for (let b = 0; b < n; b++) tCoef(sum, b, 1);
	rows.push({ coeffs: sum, op: '=', rhs: 0 });
	const zRow = Array<number>(nv).fill(0);
	zRow[2 * n] = 1;
	zRow[2 * n + 1] = -1;
	rows.push({ coeffs: zRow, op: '<=', rhs: MAX_MARGIN });

	const c1 = Array<number>(nv).fill(0);
	c1[2 * n] = 1;
	c1[2 * n + 1] = -1;
	const r1 = maximize(c1, rows);
	if (r1.status !== 'optimal') throw new Error(`split: transfer LP ${r1.status}`);
	const zStar = r1.value;

	rows.push({ coeffs: zRow, op: '>=', rhs: zStar - 1e-9 * Math.max(1, Math.abs(zStar)) });
	for (let i = 0; i < n; i++) {
		const row = Array<number>(nv).fill(0);
		tCoef(row, ownGroup[i], 1);
		row[2 * n + 2] = 1;
		row[2 * n + 3] = -1;
		rows.push({ coeffs: row, op: '<=', rhs: mean[i * n + ownGroup[i]] / share });
	}
	const c2 = Array<number>(nv).fill(0);
	c2[2 * n + 2] = 1;
	c2[2 * n + 3] = -1;
	const r2 = maximize(c2, rows);
	const x = r2.status === 'optimal' ? r2.x : r1.x;
	const t = Array.from({ length: n }, (_, b) => (x[b] - x[n + b]) * share);
	const avg = t.reduce((a, v) => a + v, 0) / n;
	return {
		groups: groups.map((g) => [...g]),
		transfers: t.map((v) => v - avg),
		owners: [...owners],
		margin: zStar
	};
}

export interface Fallback {
	proposal: Proposal;
	/** Posterior probability that the proposal is envy-free when each group goes to its owner. */
	pFair: number;
	/** Posterior mean of the largest envy, as a fraction of the fair share T/n. */
	residualEnvy: number;
}

/**
 * Among the current and past proposals, the one most likely to be envy-free.
 * Probabilities and expected envy are Monte Carlo over the fit's posterior
 * draws; ties go to the lower expected envy, then the later proposal.
 */
export function bestFallback(state: SplitState): Fallback {
	const s = internal(state);
	const candidates = [...s.rounds.map((r) => r.proposal), propose(s)];
	let best: Fallback | null = null;
	for (const proposal of candidates) {
		const f = { proposal, ...envyStats(s, proposal) };
		if (
			!best ||
			f.pFair > best.pFair ||
			(f.pFair === best.pFair && f.residualEnvy <= best.residualEnvy)
		)
			best = f;
	}
	return best!;
}

/** Posterior P(envy-free) and mean largest envy (fair shares) of a proposal under its owners. */
function envyStats(s: FittedState, proposal: Proposal): { pFair: number; residualEnvy: number } {
	const { n, prices } = s;
	const m = prices.length;
	const { w, draws } = s.fit;
	const share = prices.reduce((a, b) => a + b, 0) / n;
	const groupOf = groupIndex(proposal.groups, m);
	const ownGroup = Array<number>(n);
	proposal.owners.forEach((i, b) => (ownGroup[i] = b));
	const worst = new Float64Array(SAMPLES);
	const z = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const d = draws[i];
		const o = ownGroup[i];
		for (let r = 0; r < SAMPLES; r++) {
			z.fill(0);
			const dr = r * m;
			for (let k = 0; k < m; k++) z[groupOf[k]] += prices[k] * (1 + w[i * m + k] + d[dr + k]);
			const own = z[o] - proposal.transfers[o];
			for (let b = 0; b < n; b++) {
				const e = z[b] - proposal.transfers[b] - own;
				if (e > worst[r]) worst[r] = e;
			}
		}
	}
	let fair = 0;
	let sum = 0;
	for (let r = 0; r < SAMPLES; r++) {
		if (worst[r] <= 1e-9 * share) fair++;
		sum += worst[r];
	}
	return { pFair: fair / SAMPLES, residualEnvy: sum / SAMPLES / share };
}

function checkGroups(groups: readonly (readonly number[])[], n: number, m: number): void {
	if (groups.length !== n) throw new Error('split: need exactly n groups');
	const seen = new Uint8Array(m);
	let count = 0;
	for (const g of groups)
		for (const k of g) {
			if (!Number.isInteger(k) || k < 0 || k >= m || seen[k])
				throw new Error('split: groups must partition the items');
			seen[k] = 1;
			count++;
		}
	if (count !== m) throw new Error('split: groups must partition the items');
}

function groupIndex(groups: readonly (readonly number[])[], m: number): Int32Array {
	const g = new Int32Array(m);
	groups.forEach((items, b) => items.forEach((k) => (g[k] = b)));
	return g;
}

/**
 * Posterior mean V_ib (n×n) and exact SDs of V_i(o) − V_i(b) for every person
 * i and group pair (o, b), as sd[i n² + o n + b]. For a = g_o − g_b (g_b the
 * prices on group b), Var(aᵀ w_i) = ‖L_i⁻¹ a‖² + ‖L_S⁻¹ E_i⁻¹ a‖²; both are
 * linear in g_b, so each person needs n solves.
 */
function groupMoments(
	fit: Fit,
	prices: readonly number[],
	n: number,
	groupOf: Int32Array
): { mean: Float64Array; sd: Float64Array } {
	const m = prices.length;
	const mean = new Float64Array(n * n);
	const sd = new Float64Array(n * n * n);
	const y = Array.from({ length: n }, () => new Float64Array(m));
	const z = Array.from({ length: n }, () => new Float64Array(m));
	const g = new Float64Array(m);
	for (let i = 0; i < n; i++) {
		for (let k = 0; k < m; k++) mean[i * n + groupOf[k]] += prices[k] * (1 + fit.w[i * m + k]);
		const ui = fit.ut[i];
		for (let b = 0; b < n; b++) {
			g.fill(0);
			for (let k = 0; k < m; k++) if (groupOf[k] === b) g[k] = prices[k];
			upperTMul(ui, m, g, y[b]);
			if (fit.ls) {
				upperMul(ui, m, y[b], z[b]);
				forwardSolve(fit.ls, m, z[b]);
			}
		}
		for (let o = 0; o < n; o++)
			for (let b = 0; b < n; b++) {
				let v = 0;
				const yo = y[o];
				const yb = y[b];
				const zo = z[o];
				const zb = z[b];
				for (let k = 0; k < m; k++) {
					const d1 = yo[k] - yb[k];
					const d2 = zo[k] - zb[k];
					v += d1 * d1 + d2 * d2;
				}
				sd[i * n * n + o * n + b] = Math.sqrt(v);
			}
	}
	return { mean, sd };
}

function toRounds(rounds: readonly RoundRecord[], m: number): Round[] {
	return rounds.map((r) => ({
		groupOf: groupIndex(r.proposal.groups, m),
		members: r.proposal.groups.map((g) => Int32Array.from(g).sort()),
		t: Float64Array.from(r.proposal.transfers),
		picks: Int32Array.from(r.picks)
	}));
}

/**
 * Log posterior (up to a constant), its gradient, and per-person choice
 * probabilities Q_i[k r] = π_{i r b_r(k)} for the Hessian.
 */
function evaluate(
	w: Float64Array,
	prices: readonly number[],
	n: number,
	rounds: readonly Round[],
	beta: number,
	invTau2: number,
	c: number,
	grad: Float64Array | null,
	q: Float64Array[] | null
): number {
	const m = prices.length;
	const R = rounds.length;
	let lp = 0;
	const s = new Float64Array(n);
	const pi = new Float64Array(n);
	const sumW = new Float64Array(m);
	for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) sumW[k] += w[i * m + k];
	for (let i = 0; i < n; i++) {
		const off = i * m;
		for (let r = 0; r < R; r++) {
			const { groupOf, t, picks } = rounds[r];
			for (let b = 0; b < n; b++) s[b] = -t[b];
			for (let k = 0; k < m; k++) s[groupOf[k]] += prices[k] * (1 + w[off + k]);
			let mx = -Infinity;
			for (let b = 0; b < n; b++) if (beta * s[b] > mx) mx = beta * s[b];
			let z = 0;
			for (let b = 0; b < n; b++) {
				pi[b] = Math.exp(beta * s[b] - mx);
				z += pi[b];
			}
			for (let b = 0; b < n; b++) pi[b] /= z;
			const ch = picks[i];
			lp += beta * s[ch] - mx - Math.log(z);
			if (grad) {
				for (let k = 0; k < m; k++) {
					const b = groupOf[k];
					grad[off + k] += beta * prices[k] * ((b === ch ? 1 : 0) - pi[b]);
				}
			}
			if (q) {
				const qi = q[i];
				for (let k = 0; k < m; k++) qi[k * R + r] = pi[groupOf[k]];
			}
		}
		for (let k = 0; k < m; k++) {
			const wk = w[off + k];
			lp -= 0.5 * invTau2 * wk * wk;
			if (grad) grad[off + k] += -invTau2 * wk + c * sumW[k];
		}
	}
	for (let k = 0; k < m; k++) lp += 0.5 * c * sumW[k] * sumW[k];
	return lp;
}

/**
 * E_i = H_i + I/τ² (lower triangle) from the choice probabilities:
 * H_i[k][l] = β² p_k p_l Σ_r (π_{r b(k)} [b_r(k) = b_r(l)] − π_{r b(k)} π_{r b(l)}).
 * The second sum is Q Qᵀ (dot products of rows of Q); the first only touches
 * item pairs that share a group.
 */
function blockPrecision(
	qi: Float64Array,
	rounds: readonly Round[],
	prices: readonly number[],
	beta: number,
	invTau2: number,
	out: Float64Array
): void {
	const m = prices.length;
	const R = rounds.length;
	for (let k = 0; k < m; k++) {
		const rk = k * m;
		for (let l = 0; l <= k; l++) out[rk + l] = -dot(qi, k * R, qi, l * R, R);
	}
	for (let r = 0; r < R; r++)
		for (const items of rounds[r].members) {
			if (items.length === 0) continue;
			const pi = qi[items[0] * R + r];
			for (let a = 0; a < items.length; a++) {
				const ra = items[a] * m;
				for (let b = 0; b <= a; b++) out[ra + items[b]] += pi;
			}
		}
	const b2 = beta * beta;
	for (let k = 0; k < m; k++) {
		const rk = k * m;
		const pk = b2 * prices[k];
		for (let l = 0; l <= k; l++) out[rk + l] *= pk * prices[l];
		out[rk + k] += invTau2;
	}
}

/** Solve S x = r by conjugate gradients, S v = v/c − Σ_i E_i⁻¹ v. */
function solveS(chol: Float64Array[], m: number, c: number, r: Float64Array): Float64Array {
	const x = new Float64Array(m);
	const res = Float64Array.from(r);
	const dir = Float64Array.from(r);
	const sd = new Float64Array(m);
	const tmp = new Float64Array(m);
	let rr = dot(res, 0, res, 0, m);
	const stop = 1e-24 * rr;
	for (let it = 0; it < 4 * m + 20 && rr > stop; it++) {
		for (let k = 0; k < m; k++) sd[k] = dir[k] / c;
		for (const l of chol) {
			tmp.set(dir);
			forwardSolve(l, m, tmp);
			backSolve(l, m, tmp);
			for (let k = 0; k < m; k++) sd[k] -= tmp[k];
		}
		const alpha = rr / dot(dir, 0, sd, 0, m);
		for (let k = 0; k < m; k++) {
			x[k] += alpha * dir[k];
			res[k] -= alpha * sd[k];
		}
		const rr2 = dot(res, 0, res, 0, m);
		const beta = rr2 / rr;
		rr = rr2;
		for (let k = 0; k < m; k++) dir[k] = res[k] + beta * dir[k];
	}
	return x;
}

function fitPosterior(
	prices: readonly number[],
	n: number,
	params: SplitParams,
	records: readonly RoundRecord[],
	warm: Float64Array
): Fit {
	const m = prices.length;
	const total = prices.reduce((a, b) => a + b, 0);
	const beta = (params.lambda * n) / total;
	const tau2 = params.tau * params.tau;
	const mu2 = params.sigmaMu * params.sigmaMu;
	const invTau2 = 1 / tau2;
	const c = mu2 / (tau2 * (tau2 + n * mu2));
	const rounds = toRounds(records, m);
	const R = rounds.length;

	const w = Float64Array.from(warm);
	const chol = Array.from({ length: n }, () => new Float64Array(m * m));
	const q = Array.from({ length: n }, () => new Float64Array(m * R));
	const grad = new Float64Array(n * m);
	const trial = new Float64Array(n * m);
	const tmp = new Float64Array(m);
	let refactor = true;
	for (let it = 0; it < MAX_NEWTON; it++) {
		grad.fill(0);
		const lp = evaluate(w, prices, n, rounds, beta, invTau2, c, grad, q);
		if (refactor) {
			for (let i = 0; i < n; i++) blockPrecision(q[i], rounds, prices, beta, invTau2, chol[i]);
			for (let i = 0; i < n; i++) {
				if (!cholesky(chol[i], m)) throw new Error('split: posterior precision not positive');
			}
		}
		// Newton step Δ = P⁻¹ g = D⁻¹ g + D⁻¹ U S⁻¹ Uᵀ D⁻¹ g.
		const step = Float64Array.from(grad);
		const sum = new Float64Array(m);
		for (let i = 0; i < n; i++) {
			forwardSolve(chol[i], m, step, i * m);
			backSolve(chol[i], m, step, i * m);
			for (let k = 0; k < m; k++) sum[k] += step[i * m + k];
		}
		if (c > 0) {
			const u = solveS(chol, m, c, sum);
			for (let i = 0; i < n; i++) {
				tmp.set(u);
				forwardSolve(chol[i], m, tmp);
				backSolve(chol[i], m, tmp);
				for (let k = 0; k < m; k++) step[i * m + k] += tmp[k];
			}
		}
		const slope = dot(grad, 0, step, 0, step.length);
		let maxStep = 0;
		for (let j = 0; j < step.length; j++) maxStep = Math.max(maxStep, Math.abs(step[j]));
		if (maxStep < 1e-7 || !(slope > 0)) break;
		let alpha = 1;
		for (let ls = 0; ls < 40; ls++, alpha /= 2) {
			for (let j = 0; j < w.length; j++) trial[j] = w[j] + alpha * step[j];
			const next = evaluate(trial, prices, n, rounds, beta, invTau2, c, null, null);
			if (next >= lp + 1e-4 * alpha * slope) break;
		}
		w.set(trial);
		// A full Newton step this small leaves an error of order its square.
		if (alpha * maxStep < 1e-5) break;
		// After a small step the Hessian barely moves: reuse its factors (a chord step).
		refactor = alpha * maxStep >= CHORD_STEP;
	}
	// Laplace: chol holds E_i at the last refactored iterate, within 1e-3 (max |Δw|) of Ŵ.
	const ut = chol.map((l) => inverseTranspose(l, m));
	let ls: Float64Array | null = null;
	if (c > 0) {
		ls = new Float64Array(m * m);
		for (let k = 0; k < m; k++) ls[k * m + k] = 1 / c;
		for (const u of ut) subtractGram(ls, u, m);
		if (!cholesky(ls, m)) throw new Error('split: Schur complement not positive');
	}
	return { w, ut, ls, draws: drawSamples(chol, ut, ls, m, R) };
}

/**
 * SAMPLES draws of x_i = L_i⁻ᵀ (L_i⁻¹ u + ε_i) with u = L_S⁻ᵀ η, sample-major
 * SAMPLES×m per person. Seeded by the round count, so a state's draws are
 * reproducible.
 */
function drawSamples(
	chol: readonly Float64Array[],
	ut: readonly Float64Array[],
	ls: Float64Array | null,
	m: number,
	seed: number
): Float64Array[] {
	const rng = new Prng(0x5eed0000 + seed);
	const fillGaussian = (out: Float64Array) => {
		for (let i = 0; i < out.length; i++) out[i] = rng.normal();
	};
	const u = new Float64Array(m * SAMPLES);
	if (ls) {
		fillGaussian(u);
		for (let r = 0; r < SAMPLES; r++) backSolve(ls, m, u, r * m);
	}
	const y = new Float64Array(m * SAMPLES);
	const eps = new Float64Array(m * SAMPLES);
	return chol.map((l, j) => {
		y.set(u);
		fillGaussian(eps);
		const x = new Float64Array(m * SAMPLES);
		solveThenUpper(l, ut[j], m, y, eps, x, SAMPLES);
		return x;
	});
}
