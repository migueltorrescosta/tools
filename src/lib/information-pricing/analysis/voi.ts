/**
 * Value of information per input: the savings from choosing the best decision
 * per quantile group of the input instead of one decision overall, measured
 * with 5-fold cross-validation (folds by row position, `i % 5`).
 */

import { qcutEdges } from './groups';
import { pairwiseSum, sortedCopy } from './numeric';

const FOLDS = 5;

function trainingMean(loss: Float64Array, D: number, n: number, fold: number): Float64Array {
	const out = new Float64Array(D);
	let count = 0;
	for (let i = 0; i < n; i++) {
		if (i % FOLDS === fold) continue;
		count++;
		for (let d = 0; d < D; d++) out[d] += loss[i * D + d];
	}
	for (let d = 0; d < D; d++) out[d] /= count;
	return out;
}

/**
 * Cross-validated expected loss for several groupings at once. Every row
 * sits in one of `S` segments (`segments[i]`); grouping b maps segment s to
 * group `groupOf[b][s]` of `groupCount[b]`. Per fold, every group picks the
 * decision with the smallest mean loss over the other four folds (the
 * training rows' overall mean when the group has none there), and the fold's
 * rows are scored with that pick. Each grouping's result is the mean over
 * the folds that hold rows.
 *
 * Training sums add per-fold, per-segment sums rather than every training
 * row in order, so they can differ from NumPy's `np.add.at` in the last bit.
 */
export function crossValidated(
	loss: Float64Array,
	D: number,
	segments: Uint8Array | Uint16Array,
	S: number,
	groupOf: Uint8Array[],
	groupCount: number[]
): Float64Array {
	const n = segments.length;
	const B = groupOf.length;
	const sums = new Float64Array(FOLDS * S * D);
	const counts = new Float64Array(FOLDS * S);
	for (let i = 0, fold = 0; i < n; i++) {
		const slot = fold * S + segments[i];
		counts[slot]++;
		const base = slot * D;
		const row = i * D;
		for (let d = 0; d < D; d++) sums[base + d] += loss[row + d];
		if (++fold === FOLDS) fold = 0;
	}
	// pick[(b·FOLDS + f)·S + s]: decision scored for segment s in fold f under grouping b.
	const pick = new Uint8Array(B * FOLDS * S);
	for (let b = 0; b < B; b++) {
		const G = groupCount[b];
		const map = groupOf[b];
		for (let f = 0; f < FOLDS && f < n; f++) {
			const train = new Float64Array(G * D);
			const trainCounts = new Float64Array(G);
			for (let other = 0; other < FOLDS; other++) {
				if (other === f) continue;
				for (let s = 0; s < S; s++) {
					const g = map[s];
					trainCounts[g] += counts[other * S + s];
					for (let d = 0; d < D; d++) train[g * D + d] += sums[(other * S + s) * D + d];
				}
			}
			const chosen = new Uint8Array(G);
			let fallback: Float64Array | null = null;
			for (let g = 0; g < G; g++) {
				const c = trainCounts[g];
				const means = c > 0 ? train.subarray(g * D, g * D + D).map((v) => v / c) : null;
				const row = means ?? (fallback ??= trainingMean(loss, D, n, f));
				let best = 0;
				for (let d = 1; d < D; d++) if (row[d] < row[best]) best = d;
				chosen[g] = best;
			}
			for (let s = 0; s < S; s++) pick[(b * FOLDS + f) * S + s] = chosen[map[s]];
		}
	}
	const scratch = Array.from({ length: B }, () => new Float64Array(Math.ceil(n / FOLDS)));
	const total = new Float64Array(B);
	let evaluated = 0;
	for (let f = 0; f < FOLDS && f < n; f++) {
		let m = 0;
		for (let i = f; i < n; i += FOLDS, m++) {
			const row = i * D;
			const s = segments[i];
			for (let b = 0; b < B; b++) scratch[b][m] = loss[row + pick[(b * FOLDS + f) * S + s]];
		}
		for (let b = 0; b < B; b++) total[b] += pairwiseSum(scratch[b], 0, m) / m;
		evaluated++;
	}
	return total.map((t) => t / evaluated);
}

export interface ValueOfInformation {
	/** Bin counts, the columns of `savings`. */
	bins: number[];
	/** `savings[input][b]`: baseline minus the cross-validated loss, native units. */
	savings: Float64Array[];
	/** Input indices by savings at the largest bin count, descending (stable, NaN last). */
	order: number[];
	/** The best decision's expected loss (no information). */
	baseline: number;
}

export const DEFAULT_BINS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Cross-validated loss of one input for every bin count, in one pass over
 * the rows: each row finds its segment among the union of all bins' edges,
 * and a table maps segments to each bin count's groups (the groups `qcut`
 * assigns).
 */
function inputLosses(
	column: Float64Array,
	sorted: Float64Array,
	loss: Float64Array,
	D: number,
	bins: number[]
): Float64Array {
	const n = column.length;
	const edges = bins.map((q) => qcutEdges(sorted, q));
	const union = Float64Array.from(new Set(edges.flatMap((e) => Array.from(e)))).sort();
	const U = union.length;
	const S = U + 1;
	const counts = edges.map((e) => Math.max(1, e.length - 1));
	// Segment u holds values with exactly u union edges strictly below them;
	// the group is the count of the bin's own edges below, the lowest edge
	// joining the first group.
	const groupOf = edges.map((e) => {
		const map = new Uint8Array(S);
		for (let u = 0; u < S; u++) {
			let below = 0;
			while (u > 0 && below < e.length && e[below] <= union[u - 1]) below++;
			map[u] = Math.min(Math.max(below, 1), Math.max(e.length - 1, 1)) - 1;
		}
		return map;
	});
	const segments = S <= 256 ? new Uint8Array(n) : new Uint16Array(n);
	const min = sorted[0];
	for (let i = 0; i < n; i++) {
		const x = column[i];
		let lo = 0;
		let hi = U;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (union[mid] < x) lo = mid + 1;
			else hi = mid;
		}
		segments[i] = x === min ? 1 : lo;
	}
	return crossValidated(loss, D, segments, S, groupOf, counts);
}

/**
 * Savings matrix of every input for every bin count
 * (`evaluate_value_of_information(bins=[2, …, 10])`). Inputs are
 * independent, so callers may split them across workers. `progress` hears
 * the number of inputs done after each one.
 */
export function valueOfInformation(
	inputs: Float64Array[],
	loss: Float64Array,
	D: number,
	baseline: number,
	bins: number[] = DEFAULT_BINS,
	sorted?: Float64Array[],
	progress?: (done: number) => void
): ValueOfInformation {
	const savings = inputs.map((column, j) => {
		const losses = inputLosses(column, sorted?.[j] ?? sortedCopy(column), loss, D, bins);
		progress?.(j + 1);
		return losses.map((v) => baseline - v);
	});
	const last = bins.indexOf(Math.max(...bins));
	const key = (j: number) => savings[j][last];
	const order = inputs
		.map((_, j) => j)
		.sort((a, b) => {
			const ka = key(a);
			const kb = key(b);
			if (Number.isNaN(ka) || Number.isNaN(kb)) {
				return Number(Number.isNaN(ka)) - Number(Number.isNaN(kb));
			}
			return kb - ka;
		});
	return { bins: [...bins], savings, order, baseline };
}
