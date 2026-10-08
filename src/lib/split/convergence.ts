/** Rounds the allocation must stay unchanged before the suggestion counts as settled. */
export const STABLE_ROUNDS = 3;

/** True when both allocations give every item to the same person. */
export function sameAllocation(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Number of consecutive completed rounds the allocation has stayed the same.
 * `prev` is the allocation before the round (null if none yet), `count` the
 * streak so far.
 */
export function nextStableCount(
	prev: readonly number[] | null,
	cur: readonly number[],
	count: number
): number {
	return prev !== null && sameAllocation(prev, cur) ? count + 1 : 0;
}
