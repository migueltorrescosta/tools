import { describe, it, expect } from 'vitest';
import {
	balances,
	completeRound,
	groupDelta,
	groupValue,
	initialValuations,
	itemFavourites,
	itemsOf,
	lptGroups,
	roundFactor,
	roundedBalances,
	seededRng
} from './index';

const car = { id: 0, price: 10000 };
const house = { id: 1, price: 50000 };

describe('split groups (LPT)', () => {
	it('puts every item in exactly one of n groups', () => {
		const rng = seededRng(1);
		for (let trial = 0; trial < 50; trial++) {
			const n = 2 + Math.floor(rng() * 5);
			const items = Array.from({ length: 1 + Math.floor(rng() * 10) }, (_, id) => ({
				id,
				price: Math.round(rng() * 1000)
			}));
			const groups = lptGroups(items, n);
			expect(groups).toHaveLength(n);
			expect(
				groups
					.flat()
					.slice()
					.sort((a, b) => a - b)
			).toEqual(items.map((i) => i.id));
		}
	});

	it('splits [Car 10000, House 50000] between two into {House},{Car}', () => {
		expect(lptGroups([car, house], 2)).toEqual([[1], [0]]);
	});

	it('returns no groups for no people or no items', () => {
		expect(lptGroups([car], 0)).toEqual([]);
		expect(lptGroups([], 3)).toEqual([]);
	});

	it('values a group and its delta from the fair share', () => {
		expect(groupValue([0, 1], [car, house])).toBe(60000);
		expect(groupDelta([1], [car, house], 2)).toBe(20000);
		expect(groupDelta([0], [car, house], 2)).toBe(-20000);
	});
});

describe('split round', () => {
	it('seeds valuations reproducibly within ±0.5 of the entered prices', () => {
		const a = initialValuations([100, 200], 3, seededRng(42));
		const b = initialValuations([100, 200], 3, seededRng(42));
		expect(a).toEqual(b);
		expect(a).toHaveLength(3);
		for (const row of a) {
			expect(Math.abs(row[0] - 100)).toBeLessThanOrEqual(0.5);
			expect(Math.abs(row[1] - 200)).toBeLessThanOrEqual(0.5);
		}
	});

	it('uses factor 1 + 1/(0.1 k + 10)', () => {
		expect(roundFactor(0)).toBeCloseTo(1.1, 12);
		expect(roundFactor(100)).toBeCloseTo(1.05, 12);
	});

	it('leaves an unselected person unchanged', () => {
		const vals = [
			[10, 20],
			[30, 40]
		];
		const r = completeRound(vals, [0, 1], [[0], [1]], [null, 0], 0);
		expect(r.valuations[0]).toEqual([10, 20]);
	});

	it('scales a selected person by the factor and averages with the old value', () => {
		const f = roundFactor(100);
		const r = completeRound([[10, 20]], [7, 8], [[7], [8]], [0], 100);
		expect(r.valuations[0][0]).toBeCloseTo((10 * f + 10) / 2, 12);
		expect(r.valuations[0][1]).toBeCloseTo((20 / f + 20) / 2, 12);
		expect(r.prices).toEqual(r.valuations[0]);
	});

	it('does not mutate its inputs', () => {
		const vals = [[10, 20]];
		completeRound(vals, [0, 1], [[0], [1]], [0], 0);
		expect(vals).toEqual([[10, 20]]);
	});

	it('reports the mean valuation as the consensus price', () => {
		const r = completeRound(
			[
				[10, 20],
				[30, 40]
			],
			[0, 1],
			[[0], [1]],
			[null, null],
			0
		);
		expect(r.prices).toEqual([20, 30]);
	});
});

describe('split favourites', () => {
	it('picks the person with the highest valuation per item', () => {
		expect(
			itemFavourites(
				[
					[1, 9, 5],
					[2, 3, 7]
				],
				3
			)
		).toEqual([1, 0, 1]);
	});

	it('breaks ties to the lowest person index', () => {
		expect(
			itemFavourites(
				[
					[5, 5],
					[5, 5]
				],
				2
			)
		).toEqual([0, 0]);
	});

	it('lists the items given to a person', () => {
		expect(itemsOf([1, 0, 1], 1)).toEqual([0, 2]);
		expect(itemsOf([1, 0, 1], 2)).toEqual([]);
	});
});

describe('split settlement', () => {
	it('balances each person as value of their items minus the share', () => {
		expect(balances([10000, 50000], [1, 0], 2)).toEqual([20000, -20000]);
		expect(balances([100], [0], 4)).toEqual([75, -25, -25, -25]);
	});

	it('raw balances sum to zero', () => {
		const rng = seededRng(7);
		for (let trial = 0; trial < 100; trial++) {
			const n = 2 + Math.floor(rng() * 5);
			const prices = Array.from({ length: 1 + Math.floor(rng() * 8) }, () => rng() * 10000);
			const favs = prices.map(() => Math.floor(rng() * n));
			const sum = balances(prices, favs, n).reduce((a, b) => a + b, 0);
			expect(Math.abs(sum)).toBeLessThan(1e-6);
		}
	});

	it('rounds balances to whole euros', () => {
		expect(roundedBalances([20000.4, -20000.4])).toEqual([20000, -20000]);
	});
});
