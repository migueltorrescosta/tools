/**
 * For each item, the person who values it most. Ties go to the lowest person
 * index, so the result is deterministic.
 */
export function itemFavourites(
	valuations: readonly (readonly number[])[],
	itemCount: number
): number[] {
	return Array.from({ length: itemCount }, (_, col) => {
		let maxIdx = 0;
		let maxVal = -Infinity;
		for (let row = 0; row < valuations.length; row++) {
			const v = valuations[row]?.[col];
			if (v !== undefined && v > maxVal) {
				maxVal = v;
				maxIdx = row;
			}
		}
		return maxIdx;
	});
}

/**
 * Signed balance per person: value of the items they receive minus the fair
 * share (total / n). Positive means the person owes money.
 */
export function balances(
	prices: readonly number[],
	favourites: readonly number[],
	n: number
): number[] {
	const share = prices.reduce((a, b) => a + b, 0) / n;
	const mine = Array<number>(n).fill(0);
	favourites.forEach((f, i) => {
		if (f >= 0 && f < n) mine[f] += prices[i];
	});
	return mine.map((v) => v - share);
}

/**
 * Balances rounded to whole euros so that they still sum to exactly zero.
 * Largest-remainder (Hamilton) rounding: take the floor of each balance, then
 * give the leftover euros one each to the largest fractional parts, ties to
 * the lowest person index. Assumes the raw balances sum to zero.
 */
export function roundedBalances(raw: readonly number[]): number[] {
	// Snap float noise (e.g. 24.999999999) onto the integer it represents.
	const floors = raw.map((d) => Math.floor(d + 1e-9));
	const leftover = Math.round(-floors.reduce((a, b) => a + b, 0));
	const order = raw
		.map((d, i) => ({ i, rem: d - floors[i] }))
		// Remainders equal up to float noise count as tied.
		.sort((a, b) => (Math.abs(b.rem - a.rem) > 1e-9 ? b.rem - a.rem : a.i - b.i));
	const out = [...floors];
	for (let k = 0; k < leftover && k < order.length; k++) out[order[k].i] += 1;
	return out.map((v) => v + 0); // normalise -0
}

/** Indices of the items given to each person. */
export function itemsOf(favourites: readonly number[], person: number): number[] {
	return favourites.map((f, i) => (f === person ? i : -1)).filter((i) => i >= 0);
}
