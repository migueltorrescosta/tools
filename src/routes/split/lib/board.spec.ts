import { describe, expect, it } from 'vitest';
import type { Proposal } from '$lib/split';
import {
	allocation,
	amountColour,
	amountIntensity,
	bundlesFromOwners,
	chipsOn,
	demand,
	fallbackText,
	hitTest,
	holdersFromPicks,
	maxAbsRounded,
	itemOwners,
	moveAnnouncement,
	personColour,
	place,
	stepLabels,
	stepOf,
	toPicks,
	whoPaysWhom
} from './board';

const proposal: Proposal = {
	groups: [[1], [0, 2], []],
	transfers: [20, -5, -15],
	owners: [0, 1, 2],
	margin: 1
};

describe('placements', () => {
	it('places, moves and returns chips', () => {
		let p: (number | null)[] = [null, null, null];
		expect(toPicks(p)).toBeNull();
		p = place(p, 0, 1);
		p = place(p, 2, 1);
		expect(chipsOn(p, 3)).toEqual([[], [0, 2], []]);
		p = place(p, 2, null);
		expect(chipsOn(p, 3)).toEqual([[], [0], []]);
		expect(toPicks(p)).toBeNull();
		p = place(place(p, 1, 2), 2, 0);
		expect(toPicks(p)).toEqual([1, 2, 0]);
	});

	it('classifies demand, unclaimed only once every chip is placed', () => {
		expect(demand([1, 1, null], 3)).toEqual([null, 'over', null]);
		expect(demand([1, 1, 2], 3)).toEqual(['unclaimed', 'over', null]);
		expect(demand([0, 1, 2], 3)).toEqual([null, null, null]);
	});
});

describe('announcements', () => {
	it('announces moves', () => {
		expect(moveAnnouncement('Alice', 1)).toBe('Alice chose group 2');
		expect(moveAnnouncement('Alice', null)).toBe('Alice is unplaced');
	});
});

describe('colours', () => {
	it('gives up to 12 people distinct colour tokens', () => {
		const colours = Array.from({ length: 12 }, (_, i) => personColour(i));
		expect(new Set(colours).size).toBe(12);
		expect(colours[0]).toBe('var(--data-1)');
	});
});

describe('final allocation', () => {
	it('maps picks to holders and holders to rows', () => {
		const holder = holdersFromPicks([2, 0, 1]);
		expect(holder).toEqual([1, 2, 0]);
		const { items, owed } = allocation(proposal, holder);
		expect(items).toEqual([[], [1], [0, 2]]);
		expect(owed).toEqual([-15, 20, -5]);
	});
	it('round-trips owners and bundles', () => {
		const owner = itemOwners([[1], [0, 2], []], 3);
		expect(owner).toEqual([1, 0, 1]);
		expect(bundlesFromOwners(owner, 3)).toEqual([[1], [0, 2], []]);
	});
	it('scales settlement colour on a symlog scale', () => {
		// Fair share 1000, so C = 10.
		expect(amountIntensity(0, 1000, 500)).toBe(0);
		expect(amountIntensity(500, 1000, 500)).toBe(1);
		expect(amountIntensity(-500, 1000, 500)).toBe(1);
		expect(amountIntensity(10, 1000, 500)).toBeCloseTo(Math.log(2) / Math.log(51));
		expect(amountIntensity(10, 0, 500)).toBe(0);
		expect(amountIntensity(10, 1000, 0)).toBe(0);
		expect(maxAbsRounded([12.4, -499.6, 3])).toBe(500);
		expect(amountColour(500, 1000, 500)).toBe(
			'color-mix(in oklab, var(--danger-text) 100%, var(--text-muted))'
		);
		expect(amountColour(-10, 1000, 500)).toBe(
			'color-mix(in oklab, var(--success-text) 18%, var(--text-muted))'
		);
		expect(amountColour(0.4, 1000, 500)).toBe('var(--text-muted)');
	});
	it('words the fallback offer', () => {
		expect(fallbackText({ pFair: 0.834, residualEnvy: 0.051 })).toBe(
			'No split everyone agrees on yet. Best available split: about 83% likely fair, largest expected gap 5% of a fair share.'
		);
	});
});

describe('hitTest', () => {
	const rects = [
		{ left: 0, top: 0, right: 100, bottom: 100 },
		{ left: 120, top: 0, right: 220, bottom: 100 }
	];
	it('finds the rect under a point, with slop beyond the border', () => {
		expect(hitTest(50, 50, rects)).toBe(0);
		expect(hitTest(112, 50, rects, 16)).toBe(1); // in both slops, nearer the centre of 1
		expect(hitTest(105, 50, rects, 16)).toBe(0);
		expect(hitTest(50, 130, rects, 16)).toBe(-1);
		expect(hitTest(50, 112, rects, 16)).toBe(0);
	});
});

describe('whoPaysWhom', () => {
	const check = (balances: number[]) => {
		const pays = whoPaysWhom(balances);
		const net = balances.map(() => 0);
		for (const p of pays) {
			expect(p.amount).toBeGreaterThan(0);
			net[p.from] += p.amount;
			net[p.to] -= p.amount;
		}
		expect(net).toEqual(balances);
		expect(pays.length).toBeLessThanOrEqual(Math.max(0, balances.length - 1));
		return pays;
	};
	it('matches the largest payer with the largest receiver', () => {
		expect(check([145361, -50692, -43994, -50675])).toEqual([
			{ from: 0, to: 1, amount: 50692 },
			{ from: 0, to: 3, amount: 50675 },
			{ from: 0, to: 2, amount: 43994 }
		]);
	});
	it('settles mixed balances exactly in at most n − 1 payments', () => {
		check([30, 20, -10, -40, 0]);
		check([1, -1]);
		check([7, 5, -3, -3, -3, -3]);
	});
	it('needs no payments when everyone is even', () => {
		expect(check([0, 0, 0])).toEqual([]);
	});
});

describe('progress stepper', () => {
	it('maps each phase to its step', () => {
		expect(stepOf('setup')).toBe(0);
		expect(stepOf('start')).toBe(1);
		expect(stepOf('round')).toBe(2);
		expect(stepOf('final')).toBe(3);
	});
	it('shows the round number only on the current Rounds step', () => {
		expect(stepLabels(2, 3)).toEqual(['Setup', 'Start', 'Rounds · 3', 'Result']);
		expect(stepLabels(3, 3)).toEqual(['Setup', 'Start', 'Rounds', 'Result']);
	});
});
