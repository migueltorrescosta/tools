/**
 * Asset Splitting Algorithm Library
 * Pure functions for fair division of items between people
 */

export interface Item {
	id: number;
	description: string;
	price: number;
}

export interface Person {
	id: number;
	name: string;
}

/**
 * Setup experiment - Greedy algorithm for fair division
 * Assigns each item to the person with the lowest total value
 */
export function setupExperiment(items: Item[], numPeople: number): number[][] {
	if (!numPeople || !items.length) {
		return [];
	}
	const vals = Array(numPeople).fill(0);
	const groups = Array.from({ length: numPeople }, () => [] as number[]);
	const sorted = [...items].sort((a, b) => b.price - a.price);

	for (const item of sorted) {
		let min = 0;
		for (let g = 1; g < numPeople; g++) {
			if (vals[g] < vals[min]) min = g;
		}
		groups[min].push(item.id);
		vals[min] += item.price;
	}

	return groups;
}

/**
 * Calculate total value of a group
 */
export function getGroupValue(group: number[], items: Item[]): number {
	return group.reduce((sum, id) => sum + (items.find((i) => i.id === id)?.price || 0), 0);
}

/**
 * Calculate the difference between group value and average
 */
export function getGroupDelta(group: number[], items: Item[], numPeople: number): number {
	const totalValue = items.reduce((sum, i) => sum + i.price, 0);
	const avg = totalValue / numPeople;
	return getGroupValue(group, items) - avg;
}

/**
 * Get human-readable description of a group's items
 */
export function getGroupDesc(group: number[], items: Item[]): string {
	if (!group?.length) return '(empty)';
	return group
		.map((id) => items.find((i) => i.id === id)?.description)
		.filter(Boolean)
		.join(', ');
}

/**
 * Calculate fair split suggestions based on greedy algorithm results
 */
export function calculateSuggestedSplit(
	people: Person[],
	items: Item[],
	groups: number[][]
): Array<{ name: string; items: string; total: number; delta: number }> {
	const totalValue = items.reduce((sum, i) => sum + i.price, 0);
	const avg = totalValue / people.length;

	return people.map((person, idx) => {
		const groupItems = groups[idx] || [];
		const groupValue = getGroupValue(groupItems, items);
		const delta = groupValue - avg;

		const itemDescs = groupItems
			.map((id) => items.find((i) => i.id === id)?.description)
			.filter(Boolean)
			.join(', ');

		return {
			name: person.name,
			items: itemDescs || '(empty)',
			total: groupValue,
			delta
		};
	});
}

/**
 * Validate item input
 */
export function validateItem(
	description: string,
	price: number
): { valid: boolean; message: string } {
	if (!description.trim()) {
		return { valid: false, message: 'Description cannot be empty' };
	}
	if (price <= 0) {
		return { valid: false, message: 'Price must be greater than 0' };
	}
	return { valid: true, message: 'Valid item' };
}

/**
 * Validate person input
 */
export function validatePerson(name: string): { valid: boolean; message: string } {
	if (!name.trim()) {
		return { valid: false, message: 'Name cannot be empty' };
	}
	return { valid: true, message: 'Valid person' };
}

/**
 * Check if split is fair (all groups within tolerance of average)
 */
export function isFairSplit(
	groups: number[][],
	items: Item[],
	numPeople: number,
	tolerance: number = 0.01
): boolean {
	if (!numPeople || !items.length || !groups.length) return false;

	const totalValue = items.reduce((sum, i) => sum + i.price, 0);
	const avg = totalValue / numPeople;

	for (const group of groups) {
		const groupValue = getGroupValue(group, items);
		const delta = Math.abs(groupValue - avg);
		if (delta / avg > tolerance) return false;
	}

	return true;
}

/**
 * Round to specified decimal places
 */
export function roundTo(value: number, decimals: number = 2): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}
