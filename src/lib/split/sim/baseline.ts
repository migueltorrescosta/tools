/**
 * The pre-#38 split engine, kept only as the simulation baseline: noisy
 * initial valuations, a fixed multiplicative update per round, LPT groups on
 * the consensus prices, per-item argmax suggestion, settled after 3 unchanged
 * rounds. Not used by the app.
 */
import { lptGroups } from '../groups';
import type { Rng } from '../types';

export const STABLE_ROUNDS = 3;

/** Each person starts from the entered prices plus uniform noise in [-0.5, 0.5). */
export function initialValuations(prices: readonly number[], n: number, rng: Rng): number[][] {
	return Array.from({ length: n }, () => prices.map((v) => v + rng() - 0.5));
}

/** Multiplicative step applied in round `iteration` (0-based). */
export function roundFactor(iteration: number): number {
	return 1 + 1 / (0.1 * iteration + 10);
}

/**
 * One round: a person who picked a group scales items in it up by the factor
 * and the rest down by it, then averages with their previous valuation; every
 * row is rescaled to sum to `total`. Returns valuations and consensus prices.
 */
export function completeRound(
	valuations: readonly (readonly number[])[],
	itemIds: readonly number[],
	groups: readonly (readonly number[])[],
	selections: readonly (number | null)[],
	iteration: number,
	total: number
): { valuations: number[][]; prices: number[] } {
	const factor = roundFactor(iteration);
	const next = valuations.map((row, p) => {
		const sel = selections[p];
		if (sel === null || sel === undefined) return [...row];
		const group = groups[sel] ?? [];
		return row.map((v, i) => {
			const scaled = v * (group.includes(itemIds[i]) ? factor : 1 / factor);
			return (scaled + v) / 2;
		});
	});
	for (const row of next) {
		const sum = row.reduce((a, b) => a + b, 0);
		if (sum !== 0) for (let i = 0; i < row.length; i++) row[i] *= total / sum;
	}
	const prices = itemIds.map((_, i) => next.reduce((s, r) => s + r[i], 0) / next.length);
	return { valuations: next, prices };
}

/** Per item, the highest valuer; ties to the person holding fewest items, then lowest index. */
export function itemFavourites(
	valuations: readonly (readonly number[])[],
	itemCount: number
): number[] {
	const held = Array<number>(valuations.length).fill(0);
	return Array.from({ length: itemCount }, (_, col) => {
		let maxIdx = 0;
		let maxVal = -Infinity;
		for (let row = 0; row < valuations.length; row++) {
			const v = valuations[row][col];
			if (v > maxVal || (v === maxVal && held[row] < held[maxIdx])) {
				maxVal = v;
				maxIdx = row;
			}
		}
		held[maxIdx]++;
		return maxIdx;
	});
}

/** Value of each person's items minus the fair share (positive = owes). */
export function balances(
	prices: readonly number[],
	favourites: readonly number[],
	n: number
): number[] {
	const share = prices.reduce((a, b) => a + b, 0) / n;
	const mine = Array<number>(n).fill(0);
	favourites.forEach((f, i) => (mine[f] += prices[i]));
	return mine.map((v) => v - share);
}

/**
 * Runs the old engine against truthful agents with true values `truth`
 * until the allocation is unchanged for STABLE_ROUNDS rounds (or maxRounds).
 * `rng` continues the caller's stream (initial valuations draw from it).
 * Returns rounds used and the true max envy as a fraction of the fair share,
 * settling the settled allocation at the prices of that moment. The issue's
 * original harness kept iterating 30 rounds after settling and settled at the
 * later prices; `afterSettled = 30` reproduces that.
 */
export function runBaseline(
	entered: readonly number[],
	truth: readonly (readonly number[])[],
	rng: Rng,
	afterSettled = 0,
	maxRounds = 300
): { rounds: number; settled: boolean; envy: number } {
	const n = truth.length;
	const m = entered.length;
	const total = entered.reduce((a, b) => a + b, 0);
	const ids = entered.map((_, i) => i);
	let vals = initialValuations(entered, n, rng);
	let prices = [...entered];
	let last: number[] | null = null;
	let stable = 0;
	let rounds = 0;
	let settledAt = -1;
	let settledFavs: number[] | null = null;
	while (rounds < maxRounds && (settledAt < 0 || rounds < settledAt + afterSettled)) {
		const items = ids.map((id) => ({ id, price: prices[id] }));
		const groups = lptGroups(items, n);
		const delta = groups.map((g) => g.reduce((s, id) => s + prices[id], 0) - total / n);
		const sel = truth.map((t) => {
			let best = 0;
			let bu = -Infinity;
			groups.forEach((g, gi) => {
				const u = g.reduce((s, id) => s + t[id], 0) - delta[gi];
				if (u > bu) {
					bu = u;
					best = gi;
				}
			});
			return best;
		});
		const r = completeRound(vals, ids, groups, sel, rounds, total);
		vals = r.valuations;
		prices = r.prices;
		rounds++;
		const favs = itemFavourites(vals, m);
		stable = last !== null && last.every((v, i) => v === favs[i]) ? stable + 1 : 0;
		last = favs;
		if (settledAt < 0 && stable >= STABLE_ROUNDS) {
			settledAt = rounds;
			settledFavs = favs;
		}
	}
	const favs = settledFavs ?? last!;
	const owed = balances(prices, favs, n);
	const bundle = (p: number, q: number) =>
		favs.reduce((s, f, i) => s + (f === q ? truth[p][i] : 0), 0);
	let maxEnvy = 0;
	for (let p = 0; p < n; p++)
		for (let q = 0; q < n; q++)
			maxEnvy = Math.max(maxEnvy, bundle(p, q) - owed[q] - (bundle(p, p) - owed[p]));
	return {
		rounds: settledAt >= 0 ? settledAt : rounds,
		settled: settledAt >= 0,
		envy: maxEnvy / (total / n)
	};
}
