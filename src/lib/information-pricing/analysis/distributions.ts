/**
 * Loss distribution per decision: box-plot statistics with percentile
 * whiskers (matplotlib's `boxplot_stats`) and a histogram
 * (`np.histogram`), plus the expected loss for the dashed line.
 */

import { linspace, pairwiseSum, quantileSorted, sortedCopy } from './numeric';

export interface BoxStats {
	q1: number;
	median: number;
	q3: number;
	/** Lowest loss at or above the lower whisker percentile (q1 if that is larger). */
	whiskerLow: number;
	/** Highest loss at or below the upper whisker percentile (q3 if that is smaller). */
	whiskerHigh: number;
	/** The expected loss. */
	mean: number;
	min: number;
	max: number;
	/** Rows beyond each whisker (drawn as fliers by matplotlib). */
	fliersLow: number;
	fliersHigh: number;
}

export interface Histogram {
	/** `bins + 1` evenly spaced edges from min to max (±0.5 when constant). */
	edges: Float64Array;
	counts: Uint32Array;
}

export interface LossDistribution {
	decision: number;
	expectedLoss: number;
	box: BoxStats;
	histogram: Histogram;
}

function upperBound(sorted: Float64Array, x: number): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (sorted[mid] <= x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function lowerBound(sorted: Float64Array, x: number): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (sorted[mid] < x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** Box statistics of one column; `sorted` is the column sorted ascending. */
export function boxStats(column: Float64Array, sorted: Float64Array): BoxStats {
	const n = sorted.length;
	const q1 = quantileSorted(sorted, 25 / 100);
	const median = quantileSorted(sorted, 50 / 100);
	const q3 = quantileSorted(sorted, 75 / 100);
	const loVal = quantileSorted(sorted, 5 / 100);
	const hiVal = quantileSorted(sorted, 95 / 100);
	const below = upperBound(sorted, hiVal);
	const whiskerHigh = below === 0 || sorted[below - 1] < q3 ? q3 : sorted[below - 1];
	const above = lowerBound(sorted, loVal);
	const whiskerLow = above === n || sorted[above] > q1 ? q1 : sorted[above];
	return {
		q1,
		median,
		q3,
		whiskerLow,
		whiskerHigh,
		mean: pairwiseSum(column, 0, n) / n,
		min: sorted[0],
		max: sorted[n - 1],
		fliersLow: lowerBound(sorted, whiskerLow),
		fliersHigh: n - upperBound(sorted, whiskerHigh)
	};
}

/** `np.histogram(column, bins)` over [min, max], the column's own range. */
export function histogram(column: Float64Array, bins: number, min: number, max: number): Histogram {
	let first = min;
	let last = max;
	if (first === last) {
		first -= 0.5;
		last += 0.5;
	}
	const edges = linspace(first, last, bins + 1);
	const counts = new Uint32Array(bins);
	const denom = last - first;
	for (let i = 0; i < column.length; i++) {
		const x = column[i];
		if (!(x >= first && x <= last)) continue;
		let k = Math.trunc(((x - first) / denom) * bins);
		if (k === bins) k--;
		if (x < edges[k]) k--;
		if (x >= edges[k + 1] && k !== bins - 1) k++;
		counts[k]++;
	}
	return { edges, counts };
}

/**
 * Box statistics and histogram of every decision's loss, model order.
 * `loss` is the row-major `n × D` loss matrix.
 */
export function lossDistributions(loss: Float64Array, D: number, bins = 100): LossDistribution[] {
	const n = loss.length / D;
	const column = new Float64Array(n);
	return Array.from({ length: D }, (_, d) => {
		for (let i = 0; i < n; i++) column[i] = loss[i * D + d];
		const sorted = sortedCopy(column);
		const box = boxStats(column, sorted);
		return {
			decision: d,
			expectedLoss: box.mean,
			box,
			histogram: histogram(column, bins, sorted[0], sorted[n - 1])
		};
	});
}
