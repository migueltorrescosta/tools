/**
 * Deconvolution when the noise is symmetric but of unknown shape (Delaigle &
 * Hall 2016). A symmetric Y has a real, positive φ_Y, so Z's phase
 * φ_Z/|φ_Z| is X's. Point masses p on fixed atoms are fitted to match that
 * phase; among good fits the one with least variance is kept, since any
 * symmetric part of X is indistinguishable from noise. Then
 * φ̂_Y = |φ̂_Z|/|φ_p| feeds the kernel estimator of `kernel.ts`. This is the
 * paper's fixed-atom variant, solved by projected gradient on the simplex.
 * No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { moments } from '$lib/stats';
import { binData } from './binning';
import { empiricalCf, invertCf, kernelPhi } from './kernel';
import type { Grid, GridEstimate } from './types';

export interface PhaseInput {
	data: Float64Array;
	grid: Grid;
	seed: number;
	/** Default: the normal-reference rule on Var Z − Var Y. */
	bandwidth?: number;
}

export interface PhaseResult extends GridEstimate {
	negativeMass: number;
	bandwidth: number;
	/** The fitted atoms and masses (X before smoothing). */
	atoms: Float64Array;
	masses: Float64Array;
	/** Y's variance, Var Z − Var(p), and the frequency cut-off t*. */
	varY: number;
	tStar: number;
}

/** Frequencies in the phase fit, and atoms per √n (Delaigle & Hall: 5√n, capped here). */
const FREQUENCIES = 100;
const ATOMS_PER_ROOT_N = 5;
const MAX_ATOMS = 250;
/** Penalty weight on |φ_p| < |φ̂_Z| (an impossible |φ_Y| > 1), as in the authors' code. */
const PENALTY = 500;
/** The least-variance step keeps the fit within this share of the best. */
const SLACK = 0.05;

/** Euclidean projection onto the probability simplex (Duchi et al. 2008). */
function projectSimplex(v: Float64Array): Float64Array {
	const u = Float64Array.from(v).sort().reverse();
	let cum = 0;
	let theta = 0;
	for (let j = 0; j < u.length; j++) {
		cum += u[j];
		const t = (cum - 1) / (j + 1);
		if (u[j] - t > 0) theta = t;
	}
	return v.map((x) => Math.max(0, x - theta));
}

/**
 * Projected gradient with backtracking from p: minimises f over the
 * simplex. `f` returns the value and writes the gradient into `g`.
 */
function minimiseOnSimplex(
	f: (p: Float64Array, g: Float64Array) => number,
	p0: Float64Array,
	maxIter = 3000
): Float64Array {
	let p = p0;
	const g = new Float64Array(p.length);
	const gTry = new Float64Array(p.length);
	let fp = f(p, g);
	let step = 1;
	for (let it = 0; it < maxIter; it++) {
		let next = p;
		let fn = fp;
		for (; step > 1e-14; step /= 2) {
			next = projectSimplex(p.map((v, j) => v - step * g[j]));
			fn = f(next, gTry);
			let decrease = 0;
			for (let j = 0; j < p.length; j++) decrease += g[j] * (p[j] - next[j]);
			if (fn <= fp - 0.5 * decrease) break;
		}
		if (step <= 1e-14) break;
		const gain = fp - fn;
		p = next;
		fp = fn;
		g.set(gTry);
		step *= 2;
		if (gain <= 1e-12 * Math.max(1, Math.abs(fp))) break;
	}
	return p;
}

export function fitPhase({ data, grid, seed, bandwidth }: PhaseInput): PhaseResult {
	const n = data.length;
	const { z, c } = binData(data);
	const { variance: varZ } = moments(data);
	const cf = (t: number) => empiricalCf(z, c, n, t);

	// t*: the first t where |φ̂_Z| falls to n^(−1/4), beyond which the phase is noise.
	const sd = Math.sqrt(varZ);
	let tStar = 0;
	for (let t = 0.01 / sd; t < 200 / sd; t += 0.01 / sd) {
		const [re, im] = cf(t);
		if (Math.hypot(re, im) <= Math.pow(n, -0.25)) break;
		tStar = t;
	}
	if (!(tStar > 0))
		throw new Error('The data’s characteristic function is too small to read a phase');

	// The fit's frequencies on (0, t*], Epanechnikov-weighted, with φ̂_Z and |ψ̂|^½,
	// ψ̂ = (n²|φ̂_Z|² − n)/(n(n − 1)) the unbiased |φ_Z|².
	const T = FREQUENCIES;
	const ts = Float64Array.from({ length: T }, (_, i) => ((i + 1) / T) * tStar);
	const w = ts.map((t) => 0.75 * (1 - (t / tStar) ** 2) + 1e-3);
	const wr = new Float64Array(T);
	const wi = new Float64Array(T);
	const root = new Float64Array(T);
	ts.forEach((t, i) => {
		[wr[i], wi[i]] = cf(t);
		const abs2 = wr[i] * wr[i] + wi[i] * wi[i];
		root[i] = Math.sqrt(Math.abs((n * n * abs2 - n) / (n * (n - 1))));
	});

	// Fixed atoms: uniform on the data's range, random so their lattice has no period.
	const m = Math.min(MAX_ATOMS, Math.max(10, Math.round(ATOMS_PER_ROOT_N * Math.sqrt(n))));
	const prng = new Prng(seed);
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < n; i++) {
		lo = Math.min(lo, data[i]);
		hi = Math.max(hi, data[i]);
	}
	const atoms = Float64Array.from({ length: m }, () => lo + (hi - lo) * prng.next()).sort();
	const cos = new Float64Array(m * T);
	const sin = new Float64Array(m * T);
	for (let j = 0; j < m; j++)
		for (let i = 0; i < T; i++) {
			cos[j * T + i] = Math.cos(ts[i] * atoms[j]);
			sin[j * T + i] = Math.sin(ts[i] * atoms[j]);
		}

	/**
	 * Σ_t w(t)·|φ̂_Z(t)·|φ_p(t)| − |ψ̂(t)|^½·φ_p(t)|² (zero when φ_p has Z's phase
	 * and modulus |φ_Z|), plus PENALTY·Σ w·max(0, |φ̂_Z| − |φ_p|)², with gradient.
	 */
	const a = new Float64Array(T);
	const b = new Float64Array(T);
	function fit(p: Float64Array, g: Float64Array): number {
		a.fill(0);
		b.fill(0);
		for (let j = 0; j < m; j++) {
			if (p[j] === 0) continue;
			for (let i = 0; i < T; i++) {
				a[i] += p[j] * cos[j * T + i];
				b[i] += p[j] * sin[j * T + i];
			}
		}
		g.fill(0);
		let value = 0;
		for (let i = 0; i < T; i++) {
			const A = Math.max(Math.hypot(a[i], b[i]), 1e-12);
			const rr = wr[i] * A - root[i] * a[i];
			const ri = wi[i] * A - root[i] * b[i];
			const hinge = Math.max(0, Math.hypot(wr[i], wi[i]) - A);
			value += w[i] * (rr * rr + ri * ri + PENALTY * hinge * hinge);
			for (let j = 0; j < m; j++) {
				const cj = cos[j * T + i];
				const sj = sin[j * T + i];
				const dA = (a[i] * cj + b[i] * sj) / A;
				g[j] +=
					2 * w[i] * (rr * (wr[i] * dA - root[i] * cj) + ri * (wi[i] * dA - root[i] * sj)) -
					2 * w[i] * PENALTY * hinge * dA;
			}
		}
		return value;
	}

	// Stage A: the best phase fit. Stage B: least variance within SLACK of it.
	const pA = minimiseOnSimplex(fit, new Float64Array(m).fill(1 / m));
	const scratch = new Float64Array(m);
	const best = fit(pA, scratch);
	const limit = best * (1 + SLACK) + 1e-12;
	const masses = minimiseOnSimplex((p, g) => {
		let mean = 0;
		let second = 0;
		for (let j = 0; j < m; j++) {
			mean += p[j] * atoms[j];
			second += p[j] * atoms[j] * atoms[j];
		}
		const over = fit(p, g) - limit;
		const k = over > 0 ? (2 * 1e4 * over) / Math.max(best, 1e-12) : 0;
		for (let j = 0; j < m; j++) g[j] = k * g[j] + atoms[j] * atoms[j] - 2 * atoms[j] * mean;
		return second - mean * mean + (over > 0 ? (1e4 * over * over) / Math.max(best, 1e-12) : 0);
	}, pA);

	// φ̂_Y = min(1, |φ̂_Z|/|φ_p|) up to t*; past it a Laplace with Y's variance.
	let meanP = 0;
	let varP = 0;
	for (let j = 0; j < m; j++) meanP += masses[j] * atoms[j];
	for (let j = 0; j < m; j++) varP += masses[j] * (atoms[j] - meanP) ** 2;
	const varY = Math.max(varZ - varP, 0);
	const h = bandwidth ?? 1.06 * Math.sqrt(Math.max(varP, 0.01 * varZ)) * Math.pow(n, -0.2);
	const phiP = (t: number) => {
		let re = 0;
		let im = 0;
		for (let j = 0; j < m; j++) {
			re += masses[j] * Math.cos(t * atoms[j]);
			im += masses[j] * Math.sin(t * atoms[j]);
		}
		return Math.hypot(re, im);
	};
	const nT = 512;
	const dt = 1 / h / (nT - 1);
	const kt = new Float64Array(nT);
	const qr = new Float64Array(nT);
	const qi = new Float64Array(nT);
	for (let q = 0; q < nT; q++) {
		const t = (kt[q] = q * dt);
		const k = kernelPhi(t * h) * (q === 0 || q === nT - 1 ? 0.5 : 1) * dt;
		if (k === 0) continue;
		const [zr, zi] = cf(t);
		const phiY =
			t <= tStar
				? Math.min(1, Math.max(Math.hypot(zr, zi) / Math.max(phiP(t), 1e-12), 1e-12))
				: 1 / (1 + (varY * t * t) / 2);
		qr[q] = (k * zr) / phiY;
		qi[q] = (k * zi) / phiY;
	}
	return {
		...invertCf(kt, qr, qi, grid),
		bandwidth: h,
		atoms,
		masses,
		varY,
		tStar
	};
}
