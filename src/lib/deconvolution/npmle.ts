/**
 * The Kiefer–Wolfowitz NPMLE of X on a grid (Koenker & Mizera 2014): the
 * masses w on fixed support points that maximise the likelihood of the
 * sample under a known noise. A few EM steps with SQUAREM acceleration,
 * then constrained Newton steps (Wang 2007), until the KW optimality
 * condition holds. No DOM or Svelte imports.
 */
import { binData } from './binning';
import { nnls } from './linalg';
import { dataWindow } from './grid';
import type { Dist, Grid, GridEstimate } from './types';

/** `atoms` equally spaced support points over the data's window. */
export function supportGrid(data: Float64Array, atoms = 300): Grid {
	const [lo, hi] = dataWindow(data);
	return { x0: lo, h: (hi - lo) / (atoms - 1), m: atoms };
}

/** Row-major n × m matrix L[i·m + j] = f_Y(z_i − a_j). */
export function likelihoodMatrix(z: Float64Array, y: Dist, grid: Grid): Float64Array {
	const pdf = y.pdf;
	if (pdf === null) throw new Error('The noise must be continuous');
	const { x0, h, m } = grid;
	const L = new Float64Array(z.length * m);
	for (let i = 0; i < z.length; i++)
		for (let j = 0; j < m; j++) L[i * m + j] = pdf(z[i] - (x0 + j * h));
	return L;
}

/** Least mass the extrapolation leaves an atom: EM multiplies masses, so a zero could never come back. */
const FLOOR = 1e-12;

export interface NpmleInput {
	data: Float64Array;
	y: Dist;
	grid?: Grid;
	maxIter?: number;
	/** Stop when max_j D_j ≤ 1 + tol (default 1e-3). */
	tol?: number;
	/** SQUAREM then constrained Newton steps (default true); false runs plain EM. */
	accelerate?: boolean;
}

export interface NpmleResult extends GridEstimate {
	logLik: number;
	iterations: number;
	/** max_j D_j − 1 at the returned masses. */
	gap: number;
	converged: boolean;
}

/** f, D and the log-likelihood at w, writing the EM update w·D into `next`. */
function pass(
	L: Float64Array,
	c: Float64Array,
	N: number,
	w: Float64Array,
	next: Float64Array
): { logLik: number; gap: number } {
	const m = w.length;
	const D = new Float64Array(m);
	let logLik = 0;
	for (let i = 0; i < c.length; i++) {
		const row = i * m;
		let f = 0;
		for (let j = 0; j < m; j++) f += L[row + j] * w[j];
		f = Math.max(f, 1e-300);
		logLik += c[i] * Math.log(f);
		const k = c[i] / (N * f);
		for (let j = 0; j < m; j++) D[j] += k * L[row + j];
	}
	let gap = -Infinity;
	let total = 0;
	for (let j = 0; j < m; j++) {
		gap = Math.max(gap, D[j] - 1);
		total += next[j] = w[j] * D[j];
	}
	for (let j = 0; j < m; j++) next[j] /= total;
	return { logLik, gap };
}

/** Σ c_i log(L_i·w). */
function logLik(L: Float64Array, c: Float64Array, w: Float64Array): number {
	const m = w.length;
	let s = 0;
	for (let i = 0; i < c.length; i++) {
		let f = 0;
		for (let j = 0; j < m; j++) if (w[j] > 0) f += L[i * m + j] * w[j];
		s += c[i] * Math.log(Math.max(f, 1e-300));
	}
	return s;
}

/**
 * One constrained Newton step (Wang 2007, "CNM"): on the current support plus
 * the local peaks of D above 1, maximise the quadratic approximation
 * Σ c_i log s_i ≈ const − ½Σ c_i (s_i − 2)², s_i = L_i·w′/f_i, subject to
 * Σw′ = 1, by non-negative least squares, then backtrack until the likelihood rises.
 */
function newtonStep(L: Float64Array, c: Float64Array, N: number, w: Float64Array): Float64Array {
	const m = w.length;
	const n = c.length;
	const f = new Float64Array(n);
	const D = new Float64Array(m);
	for (let i = 0; i < n; i++) {
		let s = 0;
		for (let j = 0; j < m; j++) s += L[i * m + j] * w[j];
		f[i] = Math.max(s, 1e-300);
		const k = c[i] / (N * f[i]);
		for (let j = 0; j < m; j++) D[j] += k * L[i * m + j];
	}
	const S: number[] = [];
	for (let j = 0; j < m; j++) {
		const peak = D[j] > 1 && (j === 0 || D[j] >= D[j - 1]) && (j === m - 1 || D[j] >= D[j + 1]);
		if (w[j] > SUPPORT || peak) S.push(j);
	}
	const k = S.length;
	const G = Array.from({ length: k }, () => new Array<number>(k).fill(0));
	const h = new Array<number>(k).fill(0);
	const row = new Float64Array(k);
	for (let i = 0; i < n; i++) {
		for (let a = 0; a < k; a++) row[a] = L[i * m + S[a]] / f[i];
		for (let a = 0; a < k; a++) {
			h[a] += 2 * c[i] * row[a];
			for (let b = 0; b <= a; b++) G[a][b] += c[i] * row[a] * row[b];
		}
	}
	for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) G[b][a] = G[a][b];
	// Σw′ = 1 as a heavily weighted extra row; without it the quadratic is minimised by w′ = 2w.
	const zeta = 1e4 * N;
	for (let a = 0; a < k; a++) {
		h[a] += zeta;
		for (let b = 0; b < k; b++) G[a][b] += zeta;
	}
	const x = nnls(G, h);
	const total = x.reduce((s, v) => s + v, 0);
	if (!(total > 0)) return w;
	const target = new Float64Array(m);
	S.forEach((j, a) => (target[j] = x[a] / total));
	const base = logLik(L, c, w);
	for (let t = 1; t > 1e-6; t /= 2) {
		const next = w.map((v, j) => v + t * (target[j] - v));
		if (logLik(L, c, next) >= base) return next.map((v) => (v > 1e-14 ? v : 0));
	}
	return w;
}

/** Masses above this count as support in a Newton step. */
const SUPPORT = 1e-9;

/** SQUAREM iterations before the Newton steps take over. */
const WARMUP = 25;

export function fitNpmle({
	data,
	y,
	grid,
	maxIter = 5000,
	tol = 1e-3,
	accelerate = true
}: NpmleInput): NpmleResult {
	const { z, c } = binData(data);
	const g = grid ?? supportGrid(data);
	const L = likelihoodMatrix(z, y, g);
	const N = c.reduce((a, b) => a + b, 0);
	const m = g.m;
	let w: Float64Array = new Float64Array(m).fill(1 / m);
	const w1 = new Float64Array(m);
	const w2 = new Float64Array(m);
	const w3 = new Float64Array(m);
	const wp = new Float64Array(m);

	let iterations = 0;
	let at = pass(L, c, N, w, w1);
	while (at.gap > tol && iterations < maxIter) {
		iterations++;
		if (accelerate && iterations > WARMUP) {
			w = newtonStep(L, c, N, w);
			at = pass(L, c, N, w, w1);
			continue;
		}
		if (!accelerate) {
			w = w1.slice();
			at = pass(L, c, N, w, w1);
			continue;
		}
		// SQUAREM, scheme SqS3 (Varadhan & Roland 2008).
		const p1 = pass(L, c, N, w1, w2);
		let rr = 0;
		let vv = 0;
		for (let j = 0; j < m; j++) {
			const r = w1[j] - w[j];
			const v = w2[j] - 2 * w1[j] + w[j];
			rr += r * r;
			vv += v * v;
		}
		const alpha = vv > 0 ? Math.min(-1, -Math.sqrt(rr / vv)) : -1;
		let total = 0;
		for (let j = 0; j < m; j++) {
			const r = w1[j] - w[j];
			const v = w2[j] - 2 * w1[j] + w[j];
			total += wp[j] = Math.max(FLOOR, w[j] - 2 * alpha * r + alpha * alpha * v);
		}
		for (let j = 0; j < m; j++) wp[j] /= total;
		const pp = pass(L, c, N, wp, w3);
		// Keep the extrapolation only if it beats the plain EM steps.
		w = pp.logLik >= p1.logLik ? w3.slice() : w2.slice();
		at = pass(L, c, N, w, w1);
	}
	return { grid: g, mass: w, logLik: at.logLik, iterations, gap: at.gap, converged: at.gap <= tol };
}
