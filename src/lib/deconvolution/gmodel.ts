/**
 * Efron's g-modeling (Efron 2016; Narasimhan & Efron 2020, deconvolveR): X on
 * a grid as an exponential family g_j ∝ exp(Q_j·α) with Q a natural-spline
 * basis, fitted by maximising ℓ(α) − c0·‖α‖. No DOM or Svelte imports.
 */
import { bfgs } from '$lib/minimise';
import { binData } from './binning';
import { gridLogLik, likelihoodMatrix, supportGrid } from './npmle';
import { gridPoints } from './grid';
import type { Dist, Grid, GridEstimate } from './types';

export interface GmodelInput {
	data: Float64Array;
	y: Dist;
	grid?: Grid;
	/** Spline degrees of freedom (default 5). */
	df?: number;
	/** Penalty on ‖α‖ (default 1). */
	c0?: number;
}

export interface GmodelResult extends GridEstimate {
	alpha: number[];
	logLik: number;
	/** c0·‖α‖ at the optimum. */
	penalty: number;
	converged: boolean;
}

/** Smooths ‖α‖ at 0, where it has no gradient. */
const NORM_EPS = 1e-10;

/**
 * `df` columns spanning the natural cubic splines on the points (less the
 * constant): boundary knots at the ends, df − 1 interior knots at equally
 * spaced quantiles; truncated-power basis (ESL eqs. 5.4–5.5), then centred and
 * orthonormalised, as deconvolveR does, so the penalty doesn't depend on the basis.
 */
export function splineBasis(points: Float64Array, df: number): Float64Array[] {
	const n = points.length;
	const sorted = Float64Array.from(points).sort();
	const K = df + 1;
	const knots = Array.from({ length: K }, (_, k) => {
		const u = (k / (K - 1)) * (n - 1);
		const j = Math.floor(u);
		return j >= n - 1 ? sorted[n - 1] : sorted[j] + (u - j) * (sorted[j + 1] - sorted[j]);
	});
	const cube = (v: number) => (v > 0 ? v * v * v : 0);
	const last = knots[K - 1];
	const d = (k: number, x: number) => (cube(x - knots[k]) - cube(x - last)) / (last - knots[k]);
	const raw: Float64Array[] = [points.map((x) => x)];
	for (let k = 0; k < K - 2; k++) raw.push(points.map((x) => d(k, x) - d(K - 2, x)));

	// Centre, then modified Gram–Schmidt.
	const out: Float64Array[] = [];
	for (const col of raw) {
		const mean = col.reduce((s, v) => s + v, 0) / n;
		const v = col.map((x) => x - mean);
		for (const q of out) {
			let dot = 0;
			for (let i = 0; i < n; i++) dot += v[i] * q[i];
			for (let i = 0; i < n; i++) v[i] -= dot * q[i];
		}
		const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
		out.push(v.map((x) => x / norm));
	}
	return out;
}

/** g(α) on the grid: softmax of Q·α. */
function weights(Q: Float64Array[], alpha: readonly number[], m: number): Float64Array {
	const e = new Float64Array(m);
	let top = -Infinity;
	for (let j = 0; j < m; j++) {
		let s = 0;
		for (let k = 0; k < Q.length; k++) s += Q[k][j] * alpha[k];
		e[j] = s;
		top = Math.max(top, s);
	}
	let total = 0;
	for (let j = 0; j < m; j++) total += e[j] = Math.exp(e[j] - top);
	for (let j = 0; j < m; j++) e[j] /= total;
	return e;
}

/**
 * The penalised negative log-likelihood −ℓ(α) + c0·‖α‖ and its gradient,
 * for a likelihood matrix L (n × m) and counts c.
 */
export function gmodelObjective(L: Float64Array, c: Float64Array, Q: Float64Array[], c0: number) {
	const m = Q[0].length;
	const n = c.length;
	const value = (alpha: number[]) => {
		const g = weights(Q, alpha, m);
		const ll = gridLogLik(L, c, g);
		const norm = Math.sqrt(alpha.reduce((s, a) => s + a * a, 0) + NORM_EPS);
		return { ll, g, f: -ll + c0 * norm, norm };
	};
	const gradient = (alpha: number[]) => {
		const g = weights(Q, alpha, m);
		// u_j = Σ_i c_i L_ij g_j / f_i, so ∂ℓ/∂α_k = Σ_j u_j (Q_kj − Q̄_k) with Q̄_k = Σ_j g_j Q_kj.
		const u = new Float64Array(m);
		for (let i = 0; i < n; i++) {
			let f = 0;
			for (let j = 0; j < m; j++) f += L[i * m + j] * g[j];
			const k = c[i] / Math.max(f, 1e-300);
			for (let j = 0; j < m; j++) u[j] += k * L[i * m + j] * g[j];
		}
		const norm = Math.sqrt(alpha.reduce((s, a) => s + a * a, 0) + NORM_EPS);
		const U = u.reduce((s, v) => s + v, 0);
		return Q.map((q, k) => {
			let qbar = 0;
			let uq = 0;
			for (let j = 0; j < m; j++) {
				qbar += g[j] * q[j];
				uq += u[j] * q[j];
			}
			return -(uq - U * qbar) + (c0 * alpha[k]) / norm;
		});
	};
	return { value, gradient };
}

export function fitGmodel({ data, y, grid, df = 5, c0 = 1 }: GmodelInput): GmodelResult {
	const { z, c } = binData(data);
	const g = grid ?? supportGrid(data);
	const L = likelihoodMatrix(z, y, g);
	const Q = splineBasis(gridPoints(g), df);
	const obj = gmodelObjective(L, c, Q, c0);
	const r = bfgs((a) => obj.value(a).f, obj.gradient, new Array(Q.length).fill(0), {
		maxIter: 500,
		gtol: 1e-6 * c.reduce((s, v) => s + v, 0)
	});
	const at = obj.value(r.x);
	return {
		grid: g,
		mass: at.g,
		alpha: r.x,
		logLik: at.ll,
		penalty: c0 * Math.sqrt(r.x.reduce((s, a) => s + a * a, 0)),
		converged: r.converged
	};
}
