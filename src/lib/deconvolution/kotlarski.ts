/**
 * Deconvolution from repeated measurements Z_k = X + Y_k (k = 1…m, m ≥ 2) of
 * the same X, with Y_k i.i.d. of unknown distribution and mean 0. Kotlarski's
 * identity (Kotlarski 1967; Li & Vuong 1998) recovers both characteristic
 * functions from the data:
 *   φ_X(t) = exp(∫₀ᵗ E[iZ_j e^{isZ_k}] / E[e^{isZ_k}] ds)  for any j ≠ k,
 *   φ_Y(t) = φ_Z(t) / φ_X(t),
 * estimated with Comte & Kappus's (2015) regularisation and inverted with the
 * kernel of `kernel.ts`. No DOM or Svelte imports.
 */
import { moments } from '$lib/stats';
import { invertCf, kernelPhi } from './kernel';
import type { Grid, GridEstimate } from './types';

export interface KotlarskiInput {
	/** m ≥ 2 columns of readings, one row per subject. */
	readings: Float64Array[];
	/** Grids for X and for Y (Y's centred on 0). */
	gridX: Grid;
	gridY: Grid;
	/** Default: the normal-reference rule on X's variance (see `replicateBandwidth`). */
	bandwidth?: number;
	/** Frequencies on [0, 1/h] (default 512). */
	nT?: number;
}

export interface KotlarskiResult {
	x: GridEstimate & { negativeMass: number };
	y: GridEstimate & { negativeMass: number };
	bandwidth: number;
	/** Var X = Cov(Z_j, Z_k) and Var Y = Var Z − Var X, from the readings. */
	varX: number;
	varY: number;
}

/**
 * Var X and Var Y from the readings: the covariance of two readings of one
 * subject is Var X (averaged over all pairs), and the rest of Var Z is Y's.
 */
export function replicateVariances(readings: Float64Array[]): { varX: number; varY: number } {
	const m = readings.length;
	const n = readings[0].length;
	const means = readings.map((r) => moments(r).mean);
	let cov = 0;
	let pairs = 0;
	for (let j = 0; j < m; j++)
		for (let k = j + 1; k < m; k++) {
			let s = 0;
			for (let i = 0; i < n; i++) s += (readings[j][i] - means[j]) * (readings[k][i] - means[k]);
			cov += s / n;
			pairs++;
		}
	const varZ = readings.reduce((a, r) => a + moments(r).variance, 0) / m;
	const varX = Math.max(cov / pairs, 0.01 * varZ);
	return { varX, varY: Math.max(varZ - varX, 0) };
}

/** The normal-reference bandwidth 1.06·σ_X·N^(−1/5), with N all the readings (as in the kernel method). */
export const replicateBandwidth = (varX: number, readings: number) =>
	1.06 * Math.sqrt(varX) * Math.pow(readings, -0.2);

export function fitKotlarski({
	readings,
	gridX,
	gridY,
	bandwidth,
	nT = 512
}: KotlarskiInput): KotlarskiResult {
	const m = readings.length;
	if (m < 2) throw new Error('Needs at least two readings per row');
	const n = readings[0].length;
	const N = n * m;
	const { varX, varY } = replicateVariances(readings);
	const h = bandwidth ?? replicateBandwidth(varX, N);
	const tMax = 1 / h;
	const dt = tMax / (nT - 1);
	const rootN = Math.sqrt(n);
	// Each subject's sum of readings: Σ_{j≠k} Z_j e^{isZ_k} = Σ_k (S − Z_k) e^{isZ_k}.
	const sums = new Float64Array(n);
	for (const r of readings) for (let i = 0; i < n; i++) sums[i] += r[i];

	const ts = new Float64Array(nT);
	const xRe = new Float64Array(nT);
	const xIm = new Float64Array(nT);
	const yRe = new Float64Array(nT);
	const yIm = new Float64Array(nT);
	// The integrand of the identity at the previous node, and the integral so far (a log φ_X).
	let prevRe = 0;
	let prevIm = 0;
	let logRe = 0;
	let logIm = 0;
	for (let q = 0; q < nT; q++) {
		const t = (ts[q] = q * dt);
		// ψ(t) = E e^{itZ} pooled over all readings; ν(t) = E[i Z_j e^{itZ_k}] over ordered pairs.
		let pr = 0;
		let pi = 0;
		let nr = 0;
		let ni = 0;
		for (const r of readings)
			for (let i = 0; i < n; i++) {
				const c = Math.cos(t * r[i]);
				const s = Math.sin(t * r[i]);
				pr += c;
				pi += s;
				const w = sums[i] - r[i];
				nr += w * c;
				ni += w * s;
			}
		pr /= N;
		pi /= N;
		// i·(nr + i ni) = −ni + i nr
		const vr = -ni / (N * (m - 1));
		const vi = nr / (N * (m - 1));
		// Divide by ψ̃ = ψ / min(1, √n|ψ|): never smaller than 1/√n in modulus.
		const absPsi = Math.hypot(pr, pi);
		const scale = Math.min(1, rootN * absPsi);
		const dr = scale > 0 ? pr / scale : 1 / rootN;
		const di = scale > 0 ? pi / scale : 0;
		const d2 = dr * dr + di * di;
		const ir = (vr * dr + vi * di) / d2;
		const ii = (vi * dr - vr * di) / d2;
		if (q > 0) {
			logRe += 0.5 * dt * (prevRe + ir);
			logIm += 0.5 * dt * (prevIm + ii);
		}
		prevRe = ir;
		prevIm = ii;
		// φ̃_X = φ̂_X / max(1, |φ̂_X|).
		const mag = Math.exp(logRe);
		const clip = Math.max(1, mag);
		const fxr = (mag * Math.cos(logIm)) / clip;
		const fxi = (mag * Math.sin(logIm)) / clip;
		// φ̂_Y = ψ / φ̄_X, with φ̄_X = φ̃_X / min(1, √n|φ̃_X|).
		const absX = Math.hypot(fxr, fxi);
		const sx = Math.min(1, rootN * absX);
		const br = sx > 0 ? fxr / sx : 1 / rootN;
		const bi = sx > 0 ? fxi / sx : 0;
		const b2 = br * br + bi * bi;
		const fyr = (pr * br + pi * bi) / b2;
		const fyi = (pi * br - pr * bi) / b2;
		const k = kernelPhi(t * h) * (q === 0 || q === nT - 1 ? 0.5 : 1) * dt;
		xRe[q] = k * fxr;
		xIm[q] = k * fxi;
		yRe[q] = k * fyr;
		yIm[q] = k * fyi;
	}
	return {
		x: invertCf(ts, xRe, xIm, gridX),
		y: invertCf(ts, yRe, yIm, gridY),
		bandwidth: h,
		varX,
		varY
	};
}
