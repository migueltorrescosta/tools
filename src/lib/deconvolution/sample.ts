/**
 * Simulating Z = X + Y, bootstrap resampling and pointwise bands.
 * No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import type { Dist } from './types';

/** n draws of Z = X + Y from one seed (X and Y from separate streams). */
export function simulate(X: Dist, Y: Dist, n: number, seed: number): Float64Array {
	const px = new Prng(seed);
	const py = new Prng(seed ^ 0x9e3779b9);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) out[i] = X.sampler(px) + Y.sampler(py);
	return out;
}

/** A bootstrap resample: n draws with replacement. */
export function resample(data: Float64Array, prng: Prng): Float64Array {
	const out = new Float64Array(data.length);
	for (let i = 0; i < data.length; i++) out[i] = data[prng.int(data.length)];
	return out;
}

/** The q-quantile (0 ≤ q ≤ 1) of sorted values, linearly interpolated. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
	const n = sorted.length;
	if (n === 0) return NaN;
	const u = q * (n - 1);
	const j = Math.floor(u);
	return j >= n - 1 ? sorted[n - 1] : sorted[j] + (u - j) * (sorted[j + 1] - sorted[j]);
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
