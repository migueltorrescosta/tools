import { describe, it, expect } from 'vitest';
import {
	STABLE_ROUNDS,
	balances,
	completeRound,
	groupDelta,
	groupValue,
	initialValuations,
	itemFavourites,
	itemError,
	itemsOf,
	lptGroups,
	nextStableCount,
	paymentLabel,
	personError,
	roundFactor,
	roundedBalances,
	sameAllocation,
	seededRng,
	startError
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
			[20, 10]
		];
		const r = completeRound(vals, [0, 1], [[0], [1]], [null, 0], 0, 30);
		expect(r.valuations[0]).toEqual([10, 20]);
	});

	it('scales a selected person by the factor, averages with the old value, then renormalises', () => {
		const f = roundFactor(100);
		const r = completeRound([[10, 20]], [7, 8], [[7], [8]], [0], 100, 30);
		const a = (10 * f + 10) / 2;
		const b = (20 / f + 20) / 2;
		expect(r.valuations[0][0]).toBeCloseTo((a * 30) / (a + b), 12);
		expect(r.valuations[0][1]).toBeCloseTo((b * 30) / (a + b), 12);
		expect(r.prices).toEqual(r.valuations[0]);
	});

	it('does not mutate its inputs', () => {
		const vals = [[10, 20]];
		completeRound(vals, [0, 1], [[0], [1]], [0], 0, 30);
		expect(vals).toEqual([[10, 20]]);
	});

	it('reports the mean valuation as the consensus price', () => {
		const r = completeRound(
			[
				[10, 20],
				[30, 0]
			],
			[0, 1],
			[[0], [1]],
			[null, null],
			0,
			30
		);
		expect(r.prices).toEqual([20, 10]);
	});

	it('conserves the entered total: two people both picking Car for 10 rounds', () => {
		const items = [car, house];
		const groups = lptGroups(items, 2);
		const carGroup = groups.findIndex((g) => g.includes(car.id));
		let vals = initialValuations([car.price, house.price], 2, seededRng(3));
		let prices: number[] = [];
		for (let k = 0; k < 10; k++) {
			const r = completeRound(vals, [0, 1], groups, [carGroup, carGroup], k, 60000);
			vals = r.valuations;
			prices = r.prices;
		}
		expect(Math.abs(prices[0] + prices[1] - 60000)).toBeLessThan(1e-9);
		expect(prices[0]).toBeGreaterThan(car.price);
	});

	it('conserves the entered total after k rounds of any selection pattern', () => {
		const rng = seededRng(19);
		for (let trial = 0; trial < 100; trial++) {
			const n = 2 + Math.floor(rng() * 4);
			const items = Array.from({ length: 1 + Math.floor(rng() * 8) }, (_, id) => ({
				id,
				price: 1 + Math.round(rng() * 100000)
			}));
			const total = items.reduce((s, i) => s + i.price, 0);
			const groups = lptGroups(items, n);
			const ids = items.map((i) => i.id);
			let vals = initialValuations(
				items.map((i) => i.price),
				n,
				rng
			);
			const rounds = 1 + Math.floor(rng() * 30);
			for (let k = 0; k < rounds; k++) {
				const sel = Array.from({ length: n }, () => (rng() < 0.1 ? null : Math.floor(rng() * n)));
				const r = completeRound(vals, ids, groups, sel, k, total);
				vals = r.valuations;
				const sum = r.prices.reduce((a, b) => a + b, 0);
				expect(Math.abs(sum - total)).toBeLessThan(1e-9 * total);
			}
		}
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

	it('breaks ties toward the person holding the fewest items, then lowest index', () => {
		expect(
			itemFavourites(
				[
					[5, 5],
					[5, 5]
				],
				2
			)
		).toEqual([0, 1]);
		expect(
			itemFavourites(
				[
					[5, 5, 5, 5],
					[5, 5, 5, 5],
					[5, 5, 5, 5]
				],
				4
			)
		).toEqual([0, 1, 2, 0]);
	});

	it('still gives a strictly higher valuation precedence over item counts', () => {
		expect(
			itemFavourites(
				[
					[9, 9, 5],
					[1, 1, 5]
				],
				3
			)
		).toEqual([0, 0, 1]);
		expect(
			itemFavourites(
				[
					[9, 9, 6],
					[1, 1, 5]
				],
				3
			)
		).toEqual([0, 0, 0]);
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
		expect(roundedBalances([0, 0])).toEqual([0, 0]);
	});

	const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

	it('[100] split three ways pays exactly what the others get', () => {
		const r = roundedBalances(balances([100], [0], 3));
		expect(r).toEqual([67, -33, -34]);
		expect(sum(r)).toBe(0);
	});

	it('[10,10] three ways and [50,51] four ways net to zero', () => {
		expect(sum(roundedBalances(balances([10, 10], [0, 1], 3)))).toBe(0);
		expect(sum(roundedBalances(balances([50, 51], [0, 1], 4)))).toBe(0);
	});

	it('two people with a half-euro balance net to zero', () => {
		const r = roundedBalances(balances([100.5, 0.5], [0, 1], 2));
		expect(sum(r)).toBe(0);
		expect(r).toEqual([50, -50]);
		expect(sum(roundedBalances(balances([1], [0], 2)))).toBe(0);
	});

	it('rounded balances sum to zero and stay within 1 euro of the raw ones', () => {
		const rng = seededRng(11);
		for (let trial = 0; trial < 500; trial++) {
			const n = 2 + Math.floor(rng() * 5);
			const prices = Array.from({ length: 1 + Math.floor(rng() * 8) }, () =>
				rng() < 0.3 ? Math.round(rng() * 1000) : rng() * 100000
			);
			const favs = prices.map(() => Math.floor(rng() * n));
			const raw = balances(prices, favs, n);
			const r = roundedBalances(raw);
			expect(sum(r)).toBe(0);
			r.forEach((v, i) => {
				expect(Number.isInteger(v)).toBe(true);
				expect(Math.abs(v - raw[i])).toBeLessThan(1);
			});
		}
	});
});

describe('split payment label', () => {
	const fmt = (n: number) => `€${n}`;

	it('never shows a negative zero', () => {
		expect(paymentLabel(0.3, fmt)).toBe('No payment');
		expect(paymentLabel(-0.3, fmt)).toBe('No payment');
		expect(paymentLabel(0, fmt)).toBe('No payment');
		expect(paymentLabel(-0, fmt)).toBe('No payment');
	});

	it('says who pays and who receives, with a positive amount', () => {
		expect(paymentLabel(20000, fmt)).toBe('Pay €20000');
		expect(paymentLabel(-20000, fmt)).toBe('Receive €20000');
		expect(paymentLabel(0.6, fmt)).toBe('Pay €1');
	});

	it('labels the House group as paying and the Car group as receiving', () => {
		const items = [car, house];
		const [houseGroup, carGroup] = lptGroups(items, 2);
		expect(paymentLabel(groupDelta(houseGroup, items, 2), fmt)).toBe('Pay €20000');
		expect(paymentLabel(groupDelta(carGroup, items, 2), fmt)).toBe('Receive €20000');
	});
});

describe('split convergence', () => {
	it('compares allocations item by item', () => {
		expect(sameAllocation([0, 1], [0, 1])).toBe(true);
		expect(sameAllocation([0, 1], [1, 0])).toBe(false);
		expect(sameAllocation([0], [0, 1])).toBe(false);
	});

	it('counts consecutive unchanged rounds and resets on a change', () => {
		let count = nextStableCount(null, [0, 1], 0);
		expect(count).toBe(0);
		count = nextStableCount([0, 1], [0, 1], count);
		count = nextStableCount([0, 1], [0, 1], count);
		expect(count).toBe(2);
		expect(nextStableCount([0, 1], [1, 1], count)).toBe(0);
	});

	it('settles on a seeded run where both people keep choosing their own group', () => {
		const items = [car, house];
		const groups = lptGroups(items, 2);
		let vals = initialValuations([car.price, house.price], 2, seededRng(5));
		let last: number[] | null = null;
		let stable = 0;
		for (let k = 0; k < 10; k++) {
			vals = completeRound(vals, [0, 1], groups, [0, 1], k, 60000).valuations;
			const favs = itemFavourites(vals, 2);
			stable = nextStableCount(last, favs, stable);
			last = favs;
		}
		expect(stable).toBeGreaterThanOrEqual(STABLE_ROUNDS);
		// Person 0 keeps picking group 0 (House), person 1 group 1 (Car).
		expect(last).toEqual([1, 0]);
	});
});

describe('split input validation', () => {
	it('rejects a blank description or a non-positive or missing price', () => {
		expect(itemError('  ', 10)).toBe('Enter a description.');
		expect(itemError('Car', 0)).toBe('Enter a price greater than 0.');
		expect(itemError('Car', -5)).toBe('Enter a price greater than 0.');
		expect(itemError('Car', null)).toBe('Enter a price greater than 0.');
		expect(itemError('Car', Number.NaN)).toBe('Enter a price greater than 0.');
		expect(itemError('Car', 10000)).toBeNull();
	});

	it('rejects a blank name', () => {
		expect(personError(' ')).toBe('Enter a name.');
		expect(personError('Alice')).toBeNull();
	});

	it('needs at least 2 people and 1 item to start', () => {
		expect(startError(1, 3)).toBe('Add at least 2 people to start.');
		expect(startError(2, 0)).toBe('Add at least 1 item to start.');
		expect(startError(2, 1)).toBeNull();
	});
});
