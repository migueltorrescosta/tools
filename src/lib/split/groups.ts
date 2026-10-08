import type { PricedItem } from './types';

/**
 * Longest-processing-time grouping: items sorted by descending price, each
 * placed in the group with the lowest running value (lowest index on ties).
 * Returns n groups of item ids.
 */
export function lptGroups(items: readonly PricedItem[], n: number): number[][] {
	if (n <= 0 || items.length === 0) return [];
	const vals = Array<number>(n).fill(0);
	const groups = Array.from({ length: n }, () => [] as number[]);
	const sorted = [...items].sort((a, b) => b.price - a.price);
	for (const item of sorted) {
		let min = 0;
		for (let g = 1; g < n; g++) if (vals[g] < vals[min]) min = g;
		groups[min].push(item.id);
		vals[min] += item.price;
	}
	return groups;
}

/** Sum of the prices of the items in a group. Unknown ids count as 0. */
export function groupValue(group: readonly number[], items: readonly PricedItem[]): number {
	return group.reduce((s, id) => s + (items.find((i) => i.id === id)?.price ?? 0), 0);
}

/** Group value minus the fair share (total / n). */
export function groupDelta(
	group: readonly number[],
	items: readonly PricedItem[],
	n: number
): number {
	const total = items.reduce((s, i) => s + i.price, 0);
	return groupValue(group, items) - total / n;
}
