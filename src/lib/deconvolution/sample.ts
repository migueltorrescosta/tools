/**
 * Simulating Z = X + Y, bootstrap resampling and pointwise bands.
 * No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { quantileSorted } from '$lib/stats';
import type { Dist2 } from './dist2';
import type { Dist } from './types';

/** n draws of Z = X + Y from one seed (X and Y from separate streams). */
export function simulate(X: Dist, Y: Dist, n: number, seed: number): Float64Array {
	const px = new Prng(seed);
	const py = new Prng(seed ^ 0x9e3779b9);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) out[i] = X.sampler(px) + Y.sampler(py);
	return out;
}

/** n draws of Z = X + Y in 2D from one seed (X and Y from separate streams). */
export function simulate2(
	X: Dist2,
	Y: Dist2,
	n: number,
	seed: number
): { xs: Float64Array; ys: Float64Array } {
	const px = new Prng(seed);
	const py = new Prng(seed ^ 0x9e3779b9);
	const xs = new Float64Array(n);
	const ys = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const [a, b] = X.sampler(px);
		const [c, d] = Y.sampler(py);
		xs[i] = a + c;
		ys[i] = b + d;
	}
	return { xs, ys };
}

/** n subjects with m readings each, Z_k = X + Y_k: one X per subject, a fresh Y per reading. */
export function simulateReplicates(
	X: Dist,
	Y: Dist,
	n: number,
	m: number,
	seed: number
): Float64Array[] {
	const px = new Prng(seed);
	const py = new Prng(seed ^ 0x9e3779b9);
	const out = Array.from({ length: m }, () => new Float64Array(n));
	for (let i = 0; i < n; i++) {
		const x = X.sampler(px);
		for (let k = 0; k < m; k++) out[k][i] = x + Y.sampler(py);
	}
	return out;
}

/**
 * n draws of Z = X + Y with per-point normal errors: each point's σ_i is
 * uniform on [lo, hi], and Y_i ~ N(0, σ_i²).
 */
export function simulatePerPoint(
	X: Dist,
	[lo, hi]: [number, number],
	n: number,
	seed: number
): { z: Float64Array; sigma: Float64Array } {
	const px = new Prng(seed);
	const py = new Prng(seed ^ 0x9e3779b9);
	const z = new Float64Array(n);
	const sigma = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		sigma[i] = lo + (hi - lo) * py.next();
		z[i] = X.sampler(px) + sigma[i] * py.normal();
	}
	return { z, sigma };
}

/** A bootstrap resample: n draws with replacement. */
export function resample(data: Float64Array, prng: Prng): Float64Array {
	const out = new Float64Array(data.length);
	for (let i = 0; i < data.length; i++) out[i] = data[prng.int(data.length)];
	return out;
}

/** Pointwise lower and upper quantiles across replicate vectors of equal length. */
export function bands(
	replicates: readonly Float64Array[],
	lower = 0.05,
	upper = 0.95
): { lower: Float64Array; upper: Float64Array } {
	const m = replicates[0]?.length ?? 0;
	const lo = new Float64Array(m);
	const hi = new Float64Array(m);
	const column = new Float64Array(replicates.length);
	for (let j = 0; j < m; j++) {
		for (let b = 0; b < replicates.length; b++) column[b] = replicates[b][j];
		column.sort();
		lo[j] = quantileSorted(column, lower);
		hi[j] = quantileSorted(column, upper);
	}
	return { lower: lo, upper: hi };
}

/** Histogram of a sample as densities over `bins` equal-width bins on [lo, hi]. */
export function histogram(
	data: ArrayLike<number>,
	lo: number,
	hi: number,
	bins: number
): { edges: Float64Array; density: Float64Array } {
	const edges = Float64Array.from({ length: bins + 1 }, (_, i) => lo + ((hi - lo) * i) / bins);
	const counts = new Float64Array(bins);
	const w = (hi - lo) / bins;
	for (let i = 0; i < data.length; i++) {
		const b = Math.floor((data[i] - lo) / w);
		if (b >= 0 && b < bins) counts[b]++;
		else if (data[i] === hi) counts[bins - 1]++;
	}
	const density = counts.map((c) => c / (data.length * w));
	return { edges, density };
}
