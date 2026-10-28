/**
 * Extreme Deconvolution in 1D (Bovy, Hogg & Roweis 2011).
 * X is a K-component Gaussian mixture, Y ~ N(0, σ²) with σ known,
 * so Z's components are N(μ_k, s_k² + σ²).
 */
import { Prng } from '$lib/prng';
import type { DistSpec } from './types';

export interface GmmInput {
	data: Float64Array;
	noiseSigma: number;
	kMax?: number;
	seed: number;
	restarts?: number;
	maxIter?: number;
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

/** Log-sum-exp for numerical stability. */
function logSumExp(arr: Float64Array): number {
	let max = -Infinity;
	for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
	if (max === -Infinity) return -Infinity;
	let sum = 0;
	for (let i = 0; i < arr.length; i++) sum += Math.exp(arr[i] - max);
	return max + Math.log(sum);
}

/** Log normal density. */
function logNormal(x: number, mu: number, sd: number): number {
	const diff = x - mu;
	return (-0.5 * (diff * diff)) / (sd * sd) - Math.log(sd * Math.sqrt(2 * Math.PI));
}

/** E-step: compute responsibilities r_ik and b_ik, B_k. */
function eStep(
	data: Float64Array,
	state: GmmState,
	noiseSigma: number
): { r: Float64Array; b: Float64Array; B: Float64Array; logLik: number } {
	const n = data.length;
	const k = state.weights.length;
	const r = new Float64Array(n * k);
	const b = new Float64Array(n * k);
	const B = new Float64Array(k);
	let logLik = 0;

	// Precompute T_k = s_k² + σ²
	const T = new Float64Array(k);
	for (let j = 0; j < k; j++) {
		const sj2 = state.sds[j] * state.sds[j];
		T[j] = sj2 + noiseSigma * noiseSigma;
		B[j] = sj2 - (sj2 * sj2) / T[j];
	}

	for (let i = 0; i < n; i++) {
		const z = data[i];
		const logR = new Float64Array(k);
		for (let j = 0; j < k; j++) {
			logR[j] = Math.log(state.weights[j]) + logNormal(z, state.means[j], Math.sqrt(T[j]));
		}
		const lse = logSumExp(logR);
		logLik += lse;
		for (let j = 0; j < k; j++) {
			const rij = Math.exp(logR[j] - lse);
			r[i * k + j] = rij;
			b[i * k + j] = state.means[j] + ((state.sds[j] * state.sds[j]) / T[j]) * (z - state.means[j]);
		}
	}

	return { r, b, B, logLik };
}

/** M-step: update weights, means, variances. */
function mStep(
	data: Float64Array,
	r: Float64Array,
	b: Float64Array,
	B: Float64Array,
	state: GmmState,
	varZ: number
): void {
	const n = data.length;
	const k = state.weights.length;

	for (let j = 0; j < k; j++) {
		let sumR = 0;
		let sumRb = 0;
		let sumRbb = 0;
		for (let i = 0; i < n; i++) {
			const rij = r[i * k + j];
			sumR += rij;
			sumRb += rij * b[i * k + j];
			const diff = state.means[j] - b[i * k + j];
			sumRbb += rij * (diff * diff + B[j]);
		}
		state.weights[j] = sumR / n;
		state.means[j] = sumR > 0 ? sumRb / sumR : state.means[j];
		const newVar = sumR > 0 ? sumRbb / sumR : state.sds[j] * state.sds[j];
		// Floor at 1e-6 * varZ
		state.sds[j] = Math.sqrt(Math.max(newVar, 1e-6 * varZ));
	}
}

/** K-means++ seeding on the data. */
function kmeansPlusPlus(data: Float64Array, k: number, prng: Prng): Float64Array {
	const n = data.length;
	const means = new Float64Array(k);
	const dists = new Float64Array(n);
	// First center chosen uniformly
	means[0] = data[prng.int(n)];
	// Initialize distances to first center
	for (let i = 0; i < n; i++) {
		const d = data[i] - means[0];
		dists[i] = d * d;
	}
	// Subsequent centers
	for (let j = 1; j < k; j++) {
		// Sample proportional to squared distance
		let sum = 0;
		for (let i = 0; i < n; i++) sum += dists[i];
		if (sum === 0) {
			means[j] = data[prng.int(n)];
			for (let i = 0; i < n; i++) dists[i] = 0;
			continue;
		}
		let u = prng.next() * sum;
		let chosen = n - 1;
		for (let i = 0; i < n; i++) {
			u -= dists[i];
			if (u <= 0) {
				chosen = i;
				break;
			}
		}
		means[j] = data[chosen];
		// Update distances
		for (let i = 0; i < n; i++) {
			const d = data[i] - means[j];
			const d2 = d * d;
			if (d2 < dists[i]) dists[i] = d2;
		}
	}
	return means;
}

/** Initialise state for a given k. */
function initialiseState(
	data: Float64Array,
	k: number,
	noiseSigma: number,
	prng: Prng,
	varZ: number
): GmmState {
	const weights = new Float64Array(k);
	const means = kmeansPlusPlus(data, k, prng);
	const sds = new Float64Array(k);
	for (let j = 0; j < k; j++) {
		weights[j] = 1 / k;
		const sj2 = Math.max(varZ / (k * k) - noiseSigma * noiseSigma, 0.01 * varZ);
		sds[j] = Math.sqrt(sj2);
	}
	return { weights, means, sds };
}

/** Sort components by mean. */
function sortByMean(state: GmmState): void {
	const k = state.weights.length;
	const indices = Array.from({ length: k }, (_, i) => i);
	indices.sort((a, b) => state.means[a] - state.means[b]);
	const weights = new Float64Array(k);
	const means = new Float64Array(k);
	const sds = new Float64Array(k);
	for (let i = 0; i < k; i++) {
		weights[i] = state.weights[indices[i]];
		means[i] = state.means[indices[i]];
		sds[i] = state.sds[indices[i]];
	}
	state.weights.set(weights);
	state.means.set(means);
	state.sds.set(sds);
}

/** Run EM for a single k, single restart. Returns final state and log-likelihood history. */
function runEm(
	data: Float64Array,
	k: number,
	noiseSigma: number,
	seed: number,
	maxIter: number,
	tol: number
): { state: GmmState; logLik: number; iterations: number; logLikHistory: number[] } {
	const prng = new Prng(seed);
	// var(Z) computed once
	const n = data.length;
	let meanZ = 0;
	for (let i = 0; i < n; i++) meanZ += data[i];
	meanZ /= n;
	let varZ = 0;
	for (let i = 0; i < n; i++) {
		const d = data[i] - meanZ;
		varZ += d * d;
	}
	varZ /= n;

	const state = initialiseState(data, k, noiseSigma, prng, varZ);
	let prevLogLik = -Infinity;
	const logLikHistory: number[] = [];

	for (let iter = 0; iter < maxIter; iter++) {
		const { r, b, B, logLik } = eStep(data, state, noiseSigma);
		logLikHistory.push(logLik);
		if (logLik - prevLogLik < tol) {
			mStep(data, r, b, B, state, varZ);
			break;
		}
		mStep(data, r, b, B, state, varZ);
		prevLogLik = logLik;
	}

	const { logLik: finalLogLik } = eStep(data, state, noiseSigma);
	sortByMean(state);
	return { state, logLik: finalLogLik, iterations: logLikHistory.length, logLikHistory };
}

/** One EM iteration, exported for testing monotonicity. */
export function emStep(
	data: Float64Array,
	state: GmmState,
	noiseSigma: number
): { newState: GmmState; logLik: number; r: Float64Array } {
	const { r, b, B, logLik } = eStep(data, state, noiseSigma);
	const newState: GmmState = {
		weights: new Float64Array(state.weights),
		means: new Float64Array(state.means),
		sds: new Float64Array(state.sds)
	};
	// Compute varZ for flooring
	let meanZ = 0;
	for (let i = 0; i < data.length; i++) meanZ += data[i];
	meanZ /= data.length;
	let varZ = 0;
	for (let i = 0; i < data.length; i++) {
		const d = data[i] - meanZ;
		varZ += d * d;
	}
	varZ /= data.length;
	mStep(data, r, b, B, newState, varZ);
	return { newState, logLik, r };
}

/** BIC = (3k − 1)·ln n − 2ℓ */
function computeBic(logLik: number, k: number, n: number): number {
	return (3 * k - 1) * Math.log(n) - 2 * logLik;
}

export function fitGmm(input: GmmInput): GmmResult {
	const { data, noiseSigma, kMax = 6, seed, restarts = 3, maxIter = 500, tol } = input;
	const n = data.length;
	const tolerance = tol ?? 1e-8 * n;

	const fits: GmmFit[] = [];
	let bestFit: GmmFit | null = null;

	for (let k = 1; k <= kMax; k++) {
		let bestLogLik = -Infinity;
		let bestState: GmmState | null = null;
		let bestIterations = 0;

		for (let r = 0; r < restarts; r++) {
			const { state, logLik, iterations } = runEm(
				data,
				k,
				noiseSigma,
				seed + r * 1000 + k,
				maxIter,
				tolerance
			);
			if (logLik > bestLogLik) {
				bestLogLik = logLik;
				bestState = state;
				bestIterations = iterations;
			}
		}

		if (bestState) {
			const components: GmmComponent[] = [];
			for (let j = 0; j < k; j++) {
				components.push({
					weight: bestState.weights[j],
					mean: bestState.means[j],
					sd: bestState.sds[j]
				});
			}
			const bic = computeBic(bestLogLik, k, n);
			const fit: GmmFit = { k, components, logLik: bestLogLik, bic, iterations: bestIterations };
			fits.push(fit);
			if (!bestFit || bic < bestFit.bic) {
				bestFit = fit;
			}
		}
	}

	return { best: bestFit!, fits };
}

/** Convert a GmmFit to a DistSpec (mixture of normals, or single normal if k=1). */
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
