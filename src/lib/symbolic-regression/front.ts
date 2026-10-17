/** Pareto-front helpers: scores and PySR's "best" pick, on validation loss. */
import type { FrontEntry } from './types';

/** Loss tolerance of the recommended pick, relative to the best validation MSE. */
export const RECOMMEND_LOSS_FACTOR = 1.5;

/**
 * Score of each entry of a front sorted by complexity:
 * −(ln valMse_i − ln valMse_{i−1}) / (c_i − c_{i−1}), 0 for the first entry.
 * Losses are clamped below at `Number.MIN_VALUE` so exact fits stay finite.
 */
export function computeScores(front: Pick<FrontEntry, 'complexity' | 'valMse'>[]): number[] {
	const logLoss = front.map((e) => Math.log(Math.max(e.valMse, Number.MIN_VALUE)));
	return front.map((e, i) => {
		if (i === 0) return 0;
		const dc = e.complexity - front[i - 1].complexity;
		return dc > 0 ? -(logLoss[i] - logLoss[i - 1]) / dc : 0;
	});
}

/**
 * Index of the recommended entry: among entries with valMse ≤ 1.5 × the minimum,
 * the highest score, ties going to the lower complexity. −1 when there is none.
 */
export function recommendedIndex(front: FrontEntry[]): number {
	let minLoss = Infinity;
	for (const e of front) if (e.valMse < minLoss) minLoss = e.valMse;
	if (!Number.isFinite(minLoss)) return -1;
	let best = -1;
	front.forEach((e, i) => {
		if (!(e.valMse <= RECOMMEND_LOSS_FACTOR * minLoss)) return;
		const b = front[best];
		if (best === -1 || e.score > b.score || (e.score === b.score && e.complexity < b.complexity)) {
			best = i;
		}
	});
	return best;
}
