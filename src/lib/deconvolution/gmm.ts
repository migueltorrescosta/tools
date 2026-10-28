/**
 * Extreme Deconvolution in 1D (Bovy, Hogg & Roweis 2011): X is a K-component
 * Gaussian mixture and Y ~ N(0, σ²) with σ known, so Z's components are
 * N(μ_k, s_k² + σ²). EM per K = 1…kMax from k-means++ starts, best by BIC.
 * Large samples are binned like the other grid methods. No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { binData } from './binning';
import type { DistSpec } from './types';

export interface GmmInput {
	data: Float64Array;
	noiseSigma: number;
	kMax?: number;
	seed: number;
	restarts?: number;
	maxIter?: number;
	/** Stop when the log-likelihood gains less than this (default 1e-6·n). */
	tol?: number;
}

export interface GmmComponent {
	weight: number;
	mean: number;
	sd: number;
}

export interface GmmFit {
	k: number;
	components: GmmComponent[];
	logLik: number;
	/** (3k − 1)·ln n − 2ℓ */
	bic: number;
	iterations: number;
}

export interface GmmResult {
	best: GmmFit;
	fits: GmmFit[];
}

export interface GmmState {
	weights: Float64Array;
	means: Float64Array;
	sds: Float64Array;
}

const HALF_LOG_2PI = 0.5 * Math.log(2 * Math.PI);

/** Weighted mean and variance. */
function moments(z: Float64Array, c: Float64Array): { mean: number; variance: number; n: number } {
	let n = 0;
	let s = 0;
	for (let i = 0; i < z.length; i++) {
		n += c[i];
		s += c[i] * z[i];
	}
	const mean = s / n;
	let v = 0;
	for (let i = 0; i < z.length; i++) v += c[i] * (z[i] - mean) ** 2;
	return { mean, variance: v / n, n };
}

/**
 * One EM step with weights c (the Bovy et al. updates for equal, known noise).
 * Returns the log-likelihood at `state` and writes the update into `next`.
 */
function step(
	z: Float64Array,
	c: Float64Array,
	state: GmmState,
	sigma: number,
	floor: number,
	next: GmmState
): number {
	const k = state.weights.length;
	const s2 = state.sds.map((s) => s * s);
	const T = s2.map((v) => v + sigma * sigma);
	const shrink = s2.map((v, j) => v / T[j]);
	const B = s2.map((v, j) => v - v * shrink[j]);
	const logNorm = T.map((t, j) => Math.log(state.weights[j]) - 0.5 * Math.log(t) - HALF_LOG_2PI);
	const R = new Float64Array(k);
	const Rb = new Float64Array(k);
	const Rbb = new Float64Array(k);
	const lr = new Float64Array(k);
	let logLik = 0;
	for (let i = 0; i < z.length; i++) {
		let top = -Infinity;
		for (let j = 0; j < k; j++) {
			lr[j] = logNorm[j] - (0.5 * (z[i] - state.means[j]) ** 2) / T[j];
			top = Math.max(top, lr[j]);
		}
		let total = 0;
		for (let j = 0; j < k; j++) total += lr[j] = Math.exp(lr[j] - top);
		logLik += c[i] * (top + Math.log(total));
		for (let j = 0; j < k; j++) {
			const r = (c[i] * lr[j]) / total;
			const b = state.means[j] + shrink[j] * (z[i] - state.means[j]);
			R[j] += r;
			Rb[j] += r * b;
			Rbb[j] += r * b * b;
		}
	}
	const n = R.reduce((a, b) => a + b, 0);
	for (let j = 0; j < k; j++) {
		if (!(R[j] > 0)) {
			next.weights[j] = state.weights[j];
			next.means[j] = state.means[j];
			next.sds[j] = state.sds[j];
			continue;
		}
		const mu = Rb[j] / R[j];
		// Σ r(μ − b)² = Σ r b² − R μ² at the new μ.
		const v = (Rbb[j] - R[j] * mu * mu) / R[j] + B[j];
		next.weights[j] = R[j] / n;
		next.means[j] = mu;
		next.sds[j] = Math.sqrt(Math.max(v, floor));
	}
	return logLik;
}

/** One EM iteration on unbinned data, exported for checking monotonicity. */
export function emStep(
	data: Float64Array,
	state: GmmState,
	noiseSigma: number
): { newState: GmmState; logLik: number } {
	const c = new Float64Array(data.length).fill(1);
	const { variance } = moments(data, c);
	const newState: GmmState = {
		weights: new Float64Array(state.weights.length),
		means: new Float64Array(state.means.length),
		sds: new Float64Array(state.sds.length)
	};
	const logLik = step(data, c, state, noiseSigma, 1e-6 * variance, newState);
	return { newState, logLik };
}

/** k-means++ seeding of k means on the (weighted) points. */
function seedMeans(z: Float64Array, c: Float64Array, k: number, prng: Prng): Float64Array {
	const means = new Float64Array(k);
	const d2 = new Float64Array(z.length).fill(Infinity);
	const pick = (weights: (i: number) => number) => {
		let total = 0;
		for (let i = 0; i < z.length; i++) total += weights(i);
		let u = prng.next() * total;
		for (let i = 0; i < z.length; i++) if ((u -= weights(i)) <= 0) return z[i];
		return z[z.length - 1];
	};
	means[0] = pick((i) => c[i]);
	for (let j = 1; j < k; j++) {
		for (let i = 0; i < z.length; i++) d2[i] = Math.min(d2[i], (z[i] - means[j - 1]) ** 2);
		means[j] = pick((i) => c[i] * d2[i]);
	}
	return means;
}

export function fitGmm({
	data,
	noiseSigma,
	kMax = 6,
	seed,
	restarts = 3,
	maxIter = 500,
	tol
}: GmmInput): GmmResult {
	const { z, c } = binData(data);
	const { variance, n } = moments(z, c);
	const tolerance = tol ?? 1e-6 * n;
	const floor = 1e-6 * variance;
	const fits: GmmFit[] = [];
	for (let k = 1; k <= kMax; k++) {
		let best: { state: GmmState; logLik: number; iterations: number } | null = null;
		for (let r = 0; r < restarts; r++) {
			const prng = new Prng(seed + r * 1000 + k);
			const s0 = Math.sqrt(Math.max(variance / (k * k) - noiseSigma * noiseSigma, 0.01 * variance));
			let state: GmmState = {
				weights: new Float64Array(k).fill(1 / k),
				means: seedMeans(z, c, k, prng),
				sds: new Float64Array(k).fill(s0)
			};
			let next: GmmState = {
				weights: new Float64Array(k),
				means: new Float64Array(k),
				sds: new Float64Array(k)
			};
			let prev = -Infinity;
			let iterations = 0;
			while (iterations < maxIter) {
				iterations++;
				const ll = step(z, c, state, noiseSigma, floor, next);
				[state, next] = [next, state];
				if (ll - prev < tolerance) break;
				prev = ll;
			}
			// The log-likelihood of the state returned.
			const logLik = step(z, c, state, noiseSigma, floor, next);
			if (!best || logLik > best.logLik) best = { state, logLik, iterations };
		}
		const order = Array.from({ length: k }, (_, j) => j).sort(
			(a, b) => best!.state.means[a] - best!.state.means[b]
		);
		fits.push({
			k,
			components: order.map((j) => ({
				weight: best!.state.weights[j],
				mean: best!.state.means[j],
				sd: best!.state.sds[j]
			})),
			logLik: best!.logLik,
			bic: (3 * k - 1) * Math.log(n) - 2 * best!.logLik,
			iterations: best!.iterations
		});
	}
	const best = fits.reduce((a, b) => (b.bic < a.bic ? b : a));
	return { best, fits };
}

/** A fit as a spec: one normal for k = 1, else a mixture of normals. */
export function gmmSpec(fit: GmmFit): DistSpec {
	if (fit.k === 1) {
		const c = fit.components[0];
		return { family: 'normal', params: [c.mean, c.sd] };
	}
	return {
		family: 'mixture',
		components: fit.components.map((c) => ({
			family: 'normal',
			params: [c.mean, c.sd],
			weight: c.weight
		}))
	};
}
