import type { Rng } from './types';

/** Deterministic PRNG (mulberry32) for reproducible valuations in tests. */
export function seededRng(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Each person starts from the entered prices plus uniform noise in [-0.5, 0.5). */
export function initialValuations(prices: readonly number[], n: number, rng: Rng): number[][] {
	return Array.from({ length: n }, () => prices.map((v) => v + rng() - 0.5));
}

/** Multiplicative step applied in round `iteration` (0-based). */
export function roundFactor(iteration: number): number {
	return 1 + 1 / (0.1 * iteration + 10);
}

export interface RoundResult {
	/** Updated per-person valuations, [person][item]. */
	valuations: number[][];
	/** Consensus price per item: mean of valuations across people. */
	prices: number[];
}

/**
 * One round: a person who picked a group scales items in it up by the factor
 * and the rest down by it, then averages with their previous valuation.
 * A person with no selection (null) keeps their valuations unchanged.
 * Every person's row is then rescaled to sum to `total` (the entered estate
 * value), so the consensus prices always add up to what the user entered.
 */
export function completeRound(
	valuations: readonly (readonly number[])[],
	itemIds: readonly number[],
	groups: readonly (readonly number[])[],
	selections: readonly (number | null)[],
	iteration: number,
	total: number
): RoundResult {
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
	for (const row of next) normalise(row, total);
	const prices = itemIds.map((_, i) => next.reduce((s, r) => s + r[i], 0) / next.length);
	return { valuations: next, prices };
}

/** Rescale a row in place so it sums to `total`. Rows summing to 0 are left as is. */
function normalise(row: number[], total: number): void {
	const sum = row.reduce((a, b) => a + b, 0);
	if (sum === 0) return;
	const k = total / sum;
	for (let i = 0; i < row.length; i++) row[i] *= k;
}
