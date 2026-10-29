/**
 * The model-independent part of a parametric maximum-likelihood fit: starts,
 * a Nelder–Mead search on a coarse fixed grid, a polish on a finer one, 95%
 * intervals from the observed information, and the identifiability checks.
 * `mle.ts` (1D) and `mle2.ts` (2D) describe their models through `Problem`.
 * No DOM or Svelte imports.
 */
import { nelderMead } from '$lib/minimise';
import { Prng } from '$lib/prng';
import { invertSymmetric, symmetricEigen } from './linalg';
import type { Domain, Role } from './types';

export interface ParamEstimate {
	role: Role;
	/** Mixture component index, or null for a simple spec. */
	component: number | null;
	/** e.g. `sigma`, or `weight` for a mixture weight. */
	key: string;
	label: string;
	value: number;
	/** 95% interval; NaN when the information matrix isn't positive definite (and for weights). */
	lower: number;
	upper: number;
	fitted: boolean;
}

export interface Identifiability {
	/** λmax/λmin of the scaled observed information (unit diagonal); Infinity when λmin ≤ 0. */
	conditionNumber: number;
	/** conditionNumber > IDENTIFIABILITY_LIMIT. */
	flat: boolean;
	/** When flat: parameters whose |component| in the eigenvector of λmin is at least 0.2 of the largest, with its sign. */
	direction: { role: Role; component: number | null; key: string; label: string; weight: number }[];
	/**
	 * Fitted parameters that ended at the edge of their range: within 1e-3 of 0 or 1
	 * (±1 for a correlation), or a positive one below 1e-3 of the data's standard
	 * deviation. A flat direction often runs into such an edge, where the curvature
	 * no longer shows it.
	 */
	boundary: { role: Role; component: number | null; key: string; label: string }[];
}

export const IDENTIFIABILITY_LIMIT = 1e6;
/** Objective value for parameters that are invalid or give no finite likelihood. */
export const BAD = 1e300;
const HESSIAN_STEP = 1e-3;

/** One parameter: what it is, how fits move it, and whether it is fitted. */
export interface Slot {
	role: Role;
	component: number | null;
	key: string;
	label: string;
	domain: Domain | 'weight';
	fitted: boolean;
	/**
	 * A flat prior on the free scale in a Bayesian fit, outside the Jeffreys
	 * block: locations, and a uniform's width (1/width on its own scale).
	 */
	flat?: boolean;
}

const sigmoid = (u: number) => 1 / (1 + Math.exp(-u));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A parameter on the fit's unconstrained scale. */
export const toFree = (domain: Domain, v: number): number => {
	if (domain === 'positive') return Math.log(v);
	if (domain === 'unit' || domain === 'unitClosed') {
		const p = clamp(v, 1e-6, 1 - 1e-6);
		return Math.log(p / (1 - p));
	}
	if (domain === 'corr') return Math.atanh(clamp(v, -1 + 1e-6, 1 - 1e-6));
	return v;
};

export const fromFree = (domain: Domain, u: number): number => {
	if (domain === 'positive') return Math.exp(u);
	if (domain === 'unit' || domain === 'unitClosed') return sigmoid(u);
	if (domain === 'corr') return Math.tanh(u);
	return u;
};

/** A model, as the core sees it. `G` is the model's grid type. */
export interface Problem<S, G> {
	/** Every parameter, fitted or not, in a fixed order. */
	slots: Slot[];
	/** The fitted parameters of `s`, on the free scale, in slot order. */
	encode(s: S): number[];
	/** The model with free vector `theta` applied. */
	decode(theta: readonly number[]): S;
	valid(s: S): boolean;
	/** A grid fixed for the whole search (coarse) or for the polish and curvature (final). */
	grid(s: S, final: boolean): G | undefined;
	/** −log-likelihood of `s` on `grid`, or BAD. */
	nll(s: S, grid: G | undefined): number;
	/**
	 * A grid holding nearly all of f_Z under `s`, whatever the data: where a
	 * Bayesian fit measures the information of its Jeffreys prior.
	 */
	infoGrid(s: S): G;
	/** Probability of each cell of `grid` under `s` (each integer's, for a discrete Z). */
	cells(s: S, grid: G): Float64Array;
	/** The value of every slot in `s`. */
	values(s: S): number[];
	/** Starting models (at least one, all valid if possible). */
	starts: S[];
	/** Sample size and spread, for BIC and the edge check. */
	n: number;
	sd: number;
}

export interface CoreResult<S> {
	fit: S;
	params: ParamEstimate[];
	logLik: number;
	/** Number of fitted parameters. */
	k: number;
	n: number;
	/** 2k − 2ℓ */
	aic: number;
	/** k ln n − 2ℓ */
	bic: number;
	identifiability: Identifiability;
}

/** Central-difference Hessian of `f` at `theta`. */
export function hessian(f: (t: number[]) => number, theta: number[]): number[][] {
	const d = theta.length;
	const h = HESSIAN_STEP;
	const f0 = f(theta);
	const at = (i: number, di: number, j: number, dj: number) => {
		const t = [...theta];
		t[i] += di;
		t[j] += dj;
		return f(t);
	};
	const H = Array.from({ length: d }, () => new Array<number>(d).fill(0));
	for (let i = 0; i < d; i++) {
		H[i][i] = (at(i, h, i, 0) - 2 * f0 + at(i, -h, i, 0)) / (h * h);
		for (let j = i + 1; j < d; j++) {
			H[i][j] = H[j][i] =
				(at(i, h, j, h) - at(i, h, j, -h) - at(i, -h, j, h) + at(i, -h, j, -h)) / (4 * h * h);
		}
	}
	return H;
}

/**
 * Nelder–Mead, restarted from its own result with a fresh simplex until a
 * restart gains less than 1e-6 (at most 5 times): a simplex collapses in the
 * long narrow valleys a signal–noise trade-off makes, and a restart regrows it.
 */
function minimise(f: (t: number[]) => number, start: number[], dim: number) {
	let r = nelderMead(f, start, { maxIter: 400 * dim });
	for (let k = 0; k < 5; k++) {
		const next = nelderMead(f, r.x, { maxIter: 400 * dim });
		const gain = r.f - next.f;
		if (next.f < r.f) r = next;
		if (!(gain > 1e-6 * Math.max(1, Math.abs(r.f)))) break;
	}
	return r;
}

/**
 * Fits `p` from its starts plus random perturbations of the first (`starts`
 * in all), keeps the best, polishes it on the final grid and measures it.
 */
export function fitCore<S, G>(p: Problem<S, G>, seed: number, starts: number): CoreResult<S> {
	const free = p.slots.filter((s) => s.fitted);
	const prng = new Prng(seed);
	const candidates = p.starts.map((s) => p.encode(s));
	const base = candidates[0];
	while (candidates.length < starts) candidates.push(base.map((v) => v + 0.5 * prng.normal()));

	// Search on one fixed, coarser grid so the objective is smooth in θ.
	const startModel = p.decode(base);
	const searchGrid = p.valid(startModel) ? p.grid(startModel, false) : undefined;
	const search = (t: number[]) => p.nll(p.decode(t), searchGrid);
	let best = { x: base, f: Infinity };
	for (const start of candidates.slice(0, Math.max(1, starts))) {
		if (free.length === 0) {
			best = { x: start, f: search(start) };
			break;
		}
		const r = minimise(search, start, free.length);
		if (r.f < best.f) best = { x: r.x, f: r.f };
	}

	// Polish on the final grid at the optimum, then measure the curvature there.
	const at = p.decode(best.x);
	const finalGrid = p.valid(at) ? p.grid(at, true) : undefined;
	const final = (t: number[]) => p.nll(p.decode(t), finalGrid);
	let theta = best.x;
	if (free.length) {
		// It starts at the optimum, so a short run suffices on the costlier final grid.
		const r = nelderMead(final, theta, { maxIter: 60 * free.length });
		if (r.f <= final(theta)) theta = r.x;
	}
	const fit = p.decode(theta);
	const nll = final(theta);
	const logLik = nll >= BAD ? -Infinity : -nll;

	const H = free.length ? hessian(final, theta) : [];
	const cov = free.length ? invertSymmetric(H) : null;
	// Collinearity on the scaled information H_ij/√(H_ii·H_jj), so the units and
	// transforms of the parameters don't decide which one looks flat.
	const scale = H.map((row, i) => (row[i] > 0 ? 1 / Math.sqrt(row[i]) : 0));
	const scaled = H.map((row, i) => row.map((v, j) => v * scale[i] * scale[j]));
	const { values, vectors } = symmetricEigen(scale.every((v) => v > 0) ? scaled : H);
	const lmin = values[0];
	const lmax = values[values.length - 1];
	const conditionNumber = free.length === 0 ? 1 : lmin > 0 ? lmax / lmin : Infinity;
	const flat = conditionNumber > IDENTIFIABILITY_LIMIT;
	const direction = flat
		? free
				.map((s, i) => ({
					role: s.role,
					component: s.component,
					key: s.key,
					label: s.label,
					weight: vectors[0][i]
				}))
				.filter(
					(d, _, all) => Math.abs(d.weight) >= 0.2 * Math.max(...all.map((a) => Math.abs(a.weight)))
				)
		: [];

	const fitted = p.values(fit);
	let k = 0;
	const params: ParamEstimate[] = p.slots.map((s, i) => {
		let lower = NaN;
		let upper = NaN;
		if (s.fitted) {
			const j = k++;
			if (cov && s.domain !== 'weight' && cov[j][j] > 0) {
				const sd = Math.sqrt(cov[j][j]);
				lower = fromFree(s.domain, theta[j] - 1.96 * sd);
				upper = fromFree(s.domain, theta[j] + 1.96 * sd);
			}
		}
		const { role, component, key, label } = s;
		return { role, component, key, label, value: fitted[i], lower, upper, fitted: s.fitted };
	});

	const boundary = params
		.filter((q, i) => {
			const s = p.slots[i];
			if (!q.fitted || s.domain === 'weight') return false;
			if (s.domain === 'unit' || s.domain === 'unitClosed')
				return q.value < 1e-3 || q.value > 1 - 1e-3;
			if (s.domain === 'corr') return Math.abs(q.value) > 1 - 1e-3;
			return s.domain === 'positive' && q.value < 1e-3 * p.sd;
		})
		.map(({ role, component, key, label }) => ({ role, component, key, label }));

	const kFree = free.length;
	return {
		fit,
		params,
		logLik,
		k: kFree,
		n: p.n,
		aic: 2 * kFree - 2 * logLik,
		bic: kFree * Math.log(p.n) - 2 * logLik,
		identifiability: { conditionNumber, flat, direction, boundary }
	};
}
