import { describe, expect, it } from 'vitest';
import {
	byPriceDesc,
	parseSetup,
	personNameError,
	priceTint,
	claimedValues,
	ringLabels
} from './setup';

describe('personNameError', () => {
	it('rejects empty and duplicate names, ignoring case and spaces', () => {
		expect(personNameError('  ', [])).toBe('Enter a name.');
		expect(personNameError(' alice ', ['Alice'])).toBe('That name is taken.');
		expect(personNameError('Alicia', ['Alice'])).toBeNull();
	});
});

describe('item pills', () => {
	it('sorts by price, highest first, keeping ties in order', () => {
		const items = [
			{ id: 0, price: 5 },
			{ id: 1, price: 50 },
			{ id: 2, price: 5 }
		];
		expect(byPriceDesc(items).map((i) => i.id)).toEqual([1, 0, 2]);
	});
	it('tints the border by price on a symlog scale', () => {
		expect(priceTint(100, [100, 10])).toBe(
			'color-mix(in oklab, var(--accent) 100%, var(--border))'
		);
		// Mean 55, so C = 0.55: log(1 + 10/0.55) / log(1 + 100/0.55) ≈ 0.57.
		expect(priceTint(10, [100, 10])).toBe('color-mix(in oklab, var(--accent) 57%, var(--border))');
	});
});

describe('parseSetup', () => {
	it('restores a saved setup, dropping bad entries and keeping ids unique', () => {
		const saved = {
			people: [{ id: 3, name: 'Ana' }, { id: 'x' }],
			items: [
				{ id: 1, description: 'Car', price: 10 },
				{ id: 2, description: 'Bad', price: -1 }
			]
		};
		expect(parseSetup(saved)).toEqual({
			people: [{ id: 3, name: 'Ana' }],
			items: [{ id: 1, description: 'Car', price: 10 }],
			nextPersonId: 4,
			nextItemId: 2
		});
	});
	it('ignores missing or broken data', () => {
		expect(parseSetup(null)).toBeNull();
		expect(parseSetup([])).toBeNull();
		expect(parseSetup({ people: [] })).toBeNull();
		// A price saved as a string is dropped, not kept as a string.
		const stringPrice = { people: [], items: [{ id: 1, description: 'Car', price: '10' }] };
		expect(parseSetup(stringPrice)?.items).toEqual([]);
	});
});

describe('claimedValues', () => {
	it('counts every item a person claimed, shared ones in full, at entered prices', () => {
		// House shared by 0 and 1, Car only 1, Lamp only 2, Vase unclaimed.
		const values = claimedValues([100, 30, 10, 5], [[0, 1], [1], [2], []], 3);
		expect(values).toEqual([100, 130, 10]);
		// The estimate is the value minus a fair share (T / n = 145 / 3).
		expect(values.map((v) => Math.round(v - 145 / 3))).toEqual([52, 82, -38]);
	});
});

describe('ringLabels', () => {
	it('uses initials, longer only when two names share them', () => {
		expect(ringLabels(['Ana', 'ben', 'Carla'])).toEqual(['A', 'B', 'C']);
		expect(ringLabels(['Ana', 'Alex', 'Ben'])).toEqual(['An', 'Al', 'Be']);
		expect(ringLabels(['Anna', 'Anne'])).toEqual(['Ann', 'Ann']);
		expect(ringLabels([' zoë '])).toEqual(['Z']);
	});
});
