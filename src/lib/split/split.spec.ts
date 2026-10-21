import { describe, it, expect } from 'vitest';
import { Prng } from '$lib/prng';
import { itemError, paymentLabel, personError, roundedBalances, startError } from './index';

/** Uniform [0, 1) draws from a seeded stream. */
function seededRng(seed: number): () => number {
	const prng = new Prng(seed);
	return () => prng.next();
}

/** Signed balance per person: value of the items they receive minus the fair share. */
function balances(prices: number[], owner: number[], n: number): number[] {
	const share = prices.reduce((a, b) => a + b, 0) / n;
	const mine = Array<number>(n).fill(-share);
	owner.forEach((f, i) => (mine[f] += prices[i]));
	return mine;
}

describe('split settlement', () => {
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
