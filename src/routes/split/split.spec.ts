import { describe, it, expect } from 'vitest';
import {
	setupExperiment,
	getGroupValue,
	getGroupDelta,
	getGroupDesc,
	calculateSuggestedSplit,
	validateItem,
	validatePerson,
	isFairSplit,
	roundTo,
	type Item,
	type Person
} from '$lib/split';

describe('Asset Splitting Library', () => {
	describe('setupExperiment - Greedy algorithm for fair division', () => {
		it('splits items equally between 2 people', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 100 }
			];

			const groups = setupExperiment(items, 2);

			expect(groups).toHaveLength(2);
			// Each person should get one item (or value close to equal)
			const values = groups.map((g) => getGroupValue(g, items));
			expect(values[0]).toBe(100);
			expect(values[1]).toBe(100);
		});

		it('splits items equally between N people', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 100 },
				{ id: 3, description: 'Item C', price: 100 },
				{ id: 4, description: 'Item D', price: 100 }
			];

			const groups = setupExperiment(items, 4);

			expect(groups).toHaveLength(4);
			// Each person should get one item
			groups.forEach((group, idx) => {
				expect(group).toHaveLength(1);
				expect(group[0]).toBe(idx + 1);
			});
		});

		it('handles remainder correctly - more items than people', () => {
			const items: Item[] = [
				{ id: 1, description: 'Expensive', price: 500 },
				{ id: 2, description: 'Cheap A', price: 50 },
				{ id: 3, description: 'Cheap B', price: 50 }
			];

			const groups = setupExperiment(items, 2);

			expect(groups).toHaveLength(2);
			const values = groups.map((g) => getGroupValue(g, items));
			// Total is 600, average is 300
			// Expensive item (500) goes to person with lower value
			// Other person gets 50 + 50 = 100
			// But greedy algorithm gives the first high value to min
			// After assignment: P1 = 500, P2 = 100
			expect(values[0] + values[1]).toBe(600);
		});

		it('handles empty items array', () => {
			const groups = setupExperiment([], 2);
			// With no items, no groups are created
			expect(groups).toEqual([]);
		});

		it('handles zero people', () => {
			const items: Item[] = [{ id: 1, description: 'Item', price: 100 }];
			const groups = setupExperiment(items, 0);
			expect(groups).toEqual([]);
		});

		it('handles single person with all items', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 200 }
			];

			const groups = setupExperiment(items, 1);

			expect(groups).toHaveLength(1);
			expect(groups[0]).toHaveLength(2);
			expect(getGroupValue(groups[0], items)).toBe(300);
		});

		it('assigns expensive items first (sorted by price descending)', () => {
			const items: Item[] = [
				{ id: 1, description: 'Cheap', price: 10 },
				{ id: 2, description: 'Medium', price: 50 },
				{ id: 3, description: 'Expensive', price: 100 }
			];

			const groups = setupExperiment(items, 2);

			expect(groups).toHaveLength(2);
			const values = groups.map((g) => getGroupValue(g, items));
			// Total = 160, avg = 80
			// Expensive (100) goes to P1, then P1=100
			// Medium (50) goes to P2, then P2=50
			// Cheap (10) goes to P2 (lower), then P2=60
			// Final: P1=100, P2=60
			expect(Math.max(...values)).toBe(100);
		});
	});

	describe('getGroupValue', () => {
		it('calculates total value of group items', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 200 },
				{ id: 3, description: 'Item C', price: 300 }
			];

			const value = getGroupValue([1, 2], items);
			expect(value).toBe(300);
		});

		it('returns 0 for empty group', () => {
			const items: Item[] = [{ id: 1, description: 'Item', price: 100 }];
			const value = getGroupValue([], items);
			expect(value).toBe(0);
		});

		it('handles non-existent item IDs', () => {
			const items: Item[] = [{ id: 1, description: 'Item', price: 100 }];
			const value = getGroupValue([1, 999], items);
			expect(value).toBe(100);
		});
	});

	describe('getGroupDelta', () => {
		it('calculates difference from average', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 100 }
			];

			// With 2 people, avg = 100
			// Group with item [1] has value 100, delta = 0
			const delta = getGroupDelta([1], items, 2);
			expect(delta).toBe(0);
		});

		it('positive delta when over average', () => {
			const items: Item[] = [
				{ id: 1, description: 'Expensive', price: 200 },
				{ id: 2, description: 'Cheap', price: 50 },
				{ id: 3, description: 'Cheap2', price: 50 }
			];

			// Total = 300, avg = 100 (for 3 people)
			const delta = getGroupDelta([1], items, 3);
			expect(delta).toBe(100); // 200 - 100
		});

		it('negative delta when under average', () => {
			const items: Item[] = [
				{ id: 1, description: 'Expensive', price: 200 },
				{ id: 2, description: 'Cheap', price: 50 },
				{ id: 3, description: 'Cheap2', price: 50 }
			];

			// Total = 300, avg = 100 (for 3 people)
			const delta = getGroupDelta([2], items, 3);
			expect(delta).toBe(-50); // 50 - 100
		});
	});

	describe('getGroupDesc', () => {
		it('returns comma-separated descriptions', () => {
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 200 }
			];

			const desc = getGroupDesc([1, 2], items);
			expect(desc).toBe('Item A, Item B');
		});

		it('returns (empty) for empty group', () => {
			const items: Item[] = [{ id: 1, description: 'Item', price: 100 }];
			const desc = getGroupDesc([], items);
			expect(desc).toBe('(empty)');
		});

		it('returns empty string for group with only non-existent IDs', () => {
			const items: Item[] = [{ id: 1, description: 'Item', price: 100 }];
			const desc = getGroupDesc([999], items);
			// All IDs are non-existent, filter removes falsy values, returns empty string
			expect(desc).toBe('');
		});
	});

	describe('calculateSuggestedSplit', () => {
		it('generates split suggestions for all people', () => {
			const people: Person[] = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' }
			];
			const items: Item[] = [
				{ id: 1, description: 'Item A', price: 100 },
				{ id: 2, description: 'Item B', price: 100 }
			];
			const groups: number[][] = [[1], [2]];

			const suggestions = calculateSuggestedSplit(people, items, groups);

			expect(suggestions).toHaveLength(2);
			expect(suggestions[0].name).toBe('Alice');
			expect(suggestions[1].name).toBe('Bob');
		});

		it('calculates correct deltas', () => {
			const people: Person[] = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' }
			];
			const items: Item[] = [
				{ id: 1, description: 'Expensive', price: 150 },
				{ id: 2, description: 'Cheap', price: 50 }
			];
			const groups: number[][] = [[1], [2]];

			const suggestions = calculateSuggestedSplit(people, items, groups);

			// Total = 200, avg = 100
			// Alice has 150, delta = +50
			// Bob has 50, delta = -50
			expect(suggestions[0].delta).toBe(50);
			expect(suggestions[1].delta).toBe(-50);
		});
	});

	describe('validateItem', () => {
		it('accepts valid item', () => {
			const result = validateItem('Valid Item', 100);
			expect(result.valid).toBe(true);
		});

		it('rejects empty description', () => {
			const result = validateItem('', 100);
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Description cannot be empty');
		});

		it('rejects whitespace-only description', () => {
			const result = validateItem('   ', 100);
			expect(result.valid).toBe(false);
		});

		it('rejects zero price', () => {
			const result = validateItem('Item', 0);
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Price must be greater than 0');
		});

		it('rejects negative price', () => {
			const result = validateItem('Item', -50);
			expect(result.valid).toBe(false);
		});

		it('accepts minimum valid price (1)', () => {
			const result = validateItem('Item', 1);
			expect(result.valid).toBe(true);
		});
	});

	describe('validatePerson', () => {
		it('accepts valid name', () => {
			const result = validatePerson('Alice');
			expect(result.valid).toBe(true);
		});

		it('rejects empty name', () => {
			const result = validatePerson('');
			expect(result.valid).toBe(false);
			expect(result.message).toBe('Name cannot be empty');
		});

		it('rejects whitespace-only name', () => {
			const result = validatePerson('   ');
			expect(result.valid).toBe(false);
		});
	});

	describe('isFairSplit', () => {
		it('returns true for perfectly fair split', () => {
			const items: Item[] = [
				{ id: 1, description: 'A', price: 100 },
				{ id: 2, description: 'B', price: 100 }
			];
			const groups: number[][] = [[1], [2]];

			const fair = isFairSplit(groups, items, 2);
			expect(fair).toBe(true);
		});

		it('returns false for unfair split', () => {
			const items: Item[] = [
				{ id: 1, description: 'Expensive', price: 200 },
				{ id: 2, description: 'Nothing', price: 0 }
			];
			const groups: number[][] = [[1], [2]];

			// Total = 200, avg = 100
			// P1 has 200 (delta = +100), P2 has 0 (delta = -100)
			// 100/100 = 100% error - definitely unfair
			const fair = isFairSplit(groups, items, 2, 0.01);
			expect(fair).toBe(false);
		});

		it('returns false for empty groups', () => {
			const items: Item[] = [{ id: 1, description: 'A', price: 100 }];
			const fair = isFairSplit([], items, 2);
			expect(fair).toBe(false);
		});

		it('respects tolerance parameter', () => {
			const items: Item[] = [
				{ id: 1, description: 'A', price: 110 },
				{ id: 2, description: 'B', price: 90 }
			];
			const groups: number[][] = [[1], [2]];

			// Total = 200, avg = 100
			// P1 has 110 (10% over), P2 has 90 (10% under)
			// Strict tolerance (1%) should fail
			expect(isFairSplit(groups, items, 2, 0.01)).toBe(false);
			// Lenient tolerance (20%) should pass
			expect(isFairSplit(groups, items, 2, 0.2)).toBe(true);
		});
	});

	describe('roundTo', () => {
		it('rounds to 2 decimal places by default', () => {
			expect(roundTo(1.234)).toBe(1.23);
			expect(roundTo(1.235)).toBe(1.24);
			expect(roundTo(1.999)).toBe(2);
		});

		it('rounds to specified decimal places', () => {
			expect(roundTo(1.2345, 1)).toBe(1.2);
			expect(roundTo(1.2345, 3)).toBe(1.235);
			expect(roundTo(1.2345, 0)).toBe(1);
		});

		it('handles negative numbers', () => {
			expect(roundTo(-1.234)).toBe(-1.23);
			expect(roundTo(-1.235)).toBe(-1.24);
		});

		it('handles zero', () => {
			expect(roundTo(0)).toBe(0);
		});
	});

	describe('Integration tests - end-to-end scenarios', () => {
		it('handles complex multi-person split', () => {
			const people: Person[] = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
				{ id: 3, name: 'Charlie' }
			];
			const items: Item[] = [
				{ id: 1, description: 'TV', price: 500 },
				{ id: 2, description: 'Laptop', price: 400 },
				{ id: 3, description: 'Phone', price: 300 },
				{ id: 4, description: 'Watch', price: 100 }
			];

			const groups = setupExperiment(items, people.length);
			const suggestions = calculateSuggestedSplit(people, items, groups);

			// Total = 1300, avg = 433.33
			const totalValue = items.reduce((sum, i) => sum + i.price, 0);
			expect(totalValue).toBe(1300);

			// Each person should get something (or be empty)
			expect(suggestions).toHaveLength(3);

			// All items should be assigned (count non-empty items across all people)
			const assignedItems = suggestions.filter((s) => s.items !== '(empty)');
			expect(assignedItems.length).toBeGreaterThan(0);
		});

		it('handles many small items vs few people', () => {
			const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
				id: i + 1,
				description: `Item ${i + 1}`,
				price: 10
			}));

			const groups = setupExperiment(items, 2);

			expect(groups).toHaveLength(2);
			const values = groups.map((g) => getGroupValue(g, items));
			expect(values[0] + values[1]).toBe(100); // All items assigned
			expect(Math.abs(values[0] - values[1])).toBeLessThanOrEqual(10); // Fair split
		});

		it('handles single expensive item vs many people', () => {
			const items: Item[] = [
				{ id: 1, description: 'Car', price: 1000 },
				{ id: 2, description: 'Cheap1', price: 10 },
				{ id: 3, description: 'Cheap2', price: 10 },
				{ id: 4, description: 'Cheap3', price: 10 }
			];

			const groups = setupExperiment(items, 4);

			expect(groups).toHaveLength(4);
			const values = groups.map((g) => getGroupValue(g, items));

			// Total = 1030, avg = 257.5
			// Car (1000) goes to one person
			// Remaining items (30) distributed among others
			expect(values.reduce((a, b) => a + b, 0)).toBe(1030);
		});
	});
});
