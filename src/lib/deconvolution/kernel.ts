/**
 * Fourier kernel deconvolution (Stefanski & Carroll 1990; Fan 1991).
 * f̂(x) = (1/π)·∫₀^{1/h} Re[e^{−itx}·φ_K(th)·φ̂_Z(t)/φ_Y(t)] dt
 */
import { binData } from './binning';
import { dataWindow } from './grid';
import type { Dist, Grid, GridEstimate } from './types';

export interface KernelInput {
	data: Float64Array;
	y: Dist;
	grid?: Grid;
	bandwidth?: number;
	/** Picks the supersmooth branch of `defaultBandwidth` (normal noise). */
	gaussianNoise?: boolean;
	nT?: number;
}

export interface KernelResult extends GridEstimate {
	bandwidth: number;
	negativeMass: number;
}

/** Kernel φ_K(s) = (1 − s²)³ on [−1, 1], 0 outside. */
function kernelPhi(s: number): number {
	const u = Math.abs(s);
	if (u >= 1) return 0;
	const v = 1 - u * u;
	return v * v * v;
}

/** Characteristic function of the kernel. */
function kernelCf(t: number, h: number): number {
	const s = t * h;
	return kernelPhi(s);
}

/** Empirical characteristic function (1/N)·Σ c_i e^{itz_i} of (binned) data. */
function empiricalCf(z: Float64Array, c: Float64Array, n: number, t: number): [number, number] {
	let re = 0;
	let im = 0;
	for (let i = 0; i < z.length; i++) {
		re += c[i] * Math.cos(t * z[i]);
		im += c[i] * Math.sin(t * z[i]);
	}
	return [re / n, im / n];
}

/**
 * True when φ_Y has a zero on [0, tMax]: between two of n equally spaced t,
 * both its parts change sign (only the real part, for a real φ_Y). A sign
 * change catches zeros between the samples; a small |φ_Y| alone is not a
 * zero, since normal noise's φ_Y decays below any threshold (and underflows).
 */
export function cfHasZeros(y: Dist, tMax: number, n = 2000): boolean {
	if (tMax <= 0) return false;
	let [re0, im0] = y.cf(0);
	for (let i = 1; i <= n; i++) {
		const [re, im] = y.cf((i / n) * tMax);
		// An exact zero on a sample (not the underflow of a decaying φ_Y).
		if (re === 0 && im === 0 && Math.hypot(re0, im0) > 1e-100) return true;
		const realCf = Math.abs(im) < 1e-12 && Math.abs(im0) < 1e-12;
		if (re * re0 < 0 && (realCf || im * im0 < 0)) return true;
		re0 = re;
		im0 = im;
	}
	return false;
}

export function defaultBandwidth(data: Float64Array, y: Dist, gaussianNoise: boolean): number {
	const n = data.length;
	// var(Z)
	let meanZ = 0;
	for (let i = 0; i < n; i++) meanZ += data[i];
	meanZ /= n;
	let varZ = 0;
	for (let i = 0; i < n; i++) {
		const d = data[i] - meanZ;
		varZ += d * d;
	}
	varZ /= n;
	// var(X) = max(var(Z) - var(Y), 0.01 * var(Z))
	const varY = y.variance ?? 0;
	const varX = Math.max(varZ - varY, 0.01 * varZ);
	const sigmaX = Math.sqrt(varX);
	// h_ROT = 1.06 * sigmaX * n^(-1/5)
	const hRot = 1.06 * sigmaX * Math.pow(n, -0.2);
	if (!gaussianNoise) return hRot;
	// supersmooth: max(h_ROT, sigma_Y * sqrt(2 / log n))
	const sigmaY = Math.sqrt(varY);
	const hFan = sigmaY * Math.sqrt(2 / Math.log(n));
	return Math.max(hRot, hFan);
}

/** Trapezoid rule integration. */
function integrateTrapezoid(f: (t: number) => number, a: number, b: number, n: number): number {
	if (n <= 1) return 0;
	const h = (b - a) / (n - 1);
	let sum = 0.5 * (f(a) + f(b));
	for (let i = 1; i < n - 1; i++) {
		sum += f(a + i * h);
	}
	return sum * h;
}

export function fitKernel(input: KernelInput): KernelResult {
	const { data, y, grid, bandwidth, gaussianNoise = false, nT = 512 } = input;
	const n = data.length;
	const h = bandwidth ?? defaultBandwidth(data, y, gaussianNoise);
	if (cfHasZeros(y, 1 / h)) {
		throw new Error('The noise characteristic function has zeros');
	}

	// Default grid
	let g = grid;
	if (!g) {
		const [lo, hi] = dataWindow(data);
		const m = 300;
		g = { x0: lo, h: (hi - lo) / (m - 1), m };
	}

	const tMax = 1 / h;
	const mass = new Float64Array(g.m);

	// Above 5000 points the empirical cf comes from 2000 bins, like the other grid methods.
	const binned = binData(data);
	// Precompute empirical CF at all t points for efficiency
	const tVals = new Float64Array(nT);
	const cfZRe = new Float64Array(nT);
	const cfZIm = new Float64Array(nT);
	for (let i = 0; i < nT; i++) {
		const t = (i / (nT - 1)) * tMax;
		tVals[i] = t;
		const [re, im] = empiricalCf(binned.z, binned.c, data.length, t);
		cfZRe[i] = re;
		cfZIm[i] = im;
	}

	// Precompute kernel CF and noise CF at all t points
	const kernelCfVals = new Float64Array(nT);
	const yCfRe = new Float64Array(nT);
	const yCfIm = new Float64Array(nT);
	for (let i = 0; i < nT; i++) {
		const t = tVals[i];
		kernelCfVals[i] = kernelCf(t, h);
		const [re, im] = y.cf(t);
		yCfRe[i] = re;
		yCfIm[i] = im;
	}

	// For each grid point x, compute f̂(x)
	for (let j = 0; j < g.m; j++) {
		const x = g.x0 + j * g.h;

		// Integrand: Re[e^{-itx} * φ_K(th) * φ̂_Z(t) / φ_Y(t)]
		const integrand = (t: number, idx: number): number => {
			const kcf = kernelCfVals[idx];
			if (kcf === 0) return 0;
			const zRe = cfZRe[idx];
			const zIm = cfZIm[idx];
			const yRe = yCfRe[idx];
			const yIm = yCfIm[idx];
			const denom = yRe * yRe + yIm * yIm;
			if (denom === 0) return 0;
			// φ̂_Z / φ_Y
			const divRe = (zRe * yRe + zIm * yIm) / denom;
			const divIm = (zIm * yRe - zRe * yIm) / denom;
			// e^{-itx}
			const cos = Math.cos(-t * x);
			const sin = Math.sin(-t * x);
			// Multiply: e^{-itx} * (φ̂_Z / φ_Y)
			const prodRe = cos * divRe - sin * divIm;
			const prodIm = cos * divIm + sin * divRe;
			// Multiply by φ_K(th) and take real part
			return kcf * prodRe;
		};

		// Trapezoid integration
		let integral = 0;
		if (nT > 1) {
			const dt = tMax / (nT - 1);
			integral = 0.5 * (integrand(0, 0) + integrand(tMax, nT - 1));
			for (let i = 1; i < nT - 1; i++) {
				integral += integrand(tVals[i], i);
			}
			integral *= dt;
		}

		mass[j] = integral / Math.PI;
	}

	// Clip negative values; negativeMass is their share of Σ|f̂|.
	let negativeSum = 0;
	let positiveSum = 0;
	for (let j = 0; j < g.m; j++) {
		if (mass[j] < 0) {
			negativeSum -= mass[j];
			mass[j] = 0;
		} else positiveSum += mass[j];
	}
	const total = negativeSum + positiveSum;
	const negativeMass = total > 0 ? negativeSum / total : 0;

	// Renormalise to sum 1
	let sum = 0;
	for (let j = 0; j < g.m; j++) sum += mass[j];
	if (sum > 0) {
		for (let j = 0; j < g.m; j++) mass[j] /= sum;
	}

	return { grid: g, mass, bandwidth: h, negativeMass };
}
