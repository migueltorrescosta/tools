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

/** Balances rounded to whole euros for display. */
export function roundedBalances(raw: readonly number[]): number[] {
	return raw.map((d) => Math.sign(d) * Math.round(Math.abs(d)));
}

/** Indices of the items given to each person. */
export function itemsOf(favourites: readonly number[], person: number): number[] {
	return favourites.map((f, i) => (f === person ? i : -1)).filter((i) => i >= 0);
}
