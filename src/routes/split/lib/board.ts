/**
 * Route-only helpers for the split chip board: chip placements, picks,
 * demand cues, colours and the final table.
 * Pure functions over the engine's types; the page holds the state.
 */
import type { Fallback, Proposal } from '$lib/split';

/** placements[i] = group index person i's chip sits on, or null while unplaced. */
export type Placements = readonly (number | null)[];

export function emptyPlacements(n: number): (number | null)[] {
	return Array<number | null>(n).fill(null);
}

/** Move person's chip to a group (or back to the tray with null). */
export function place(placements: Placements, person: number, group: number | null) {
	return placements.map((g, i) => (i === person ? group : g));
}

export function allPlaced(placements: Placements): boolean {
	return placements.length > 0 && placements.every((g) => g !== null);
}

/** The engine's picks once every chip is placed, else null. */
export function toPicks(placements: Placements): number[] | null {
	return allPlaced(placements) ? placements.map((g) => g as number) : null;
}

/** People whose chip sits on each group, in person order. */
export function chipsOn(placements: Placements, n: number): number[][] {
	const out = Array.from({ length: n }, () => [] as number[]);
	placements.forEach((g, i) => {
		if (g !== null && g >= 0 && g < n) out[g].push(i);
	});
	return out;
}

export type Demand = 'over' | 'unclaimed' | null;

/**
 * Per group: 'over' with two or more chips, 'unclaimed' with none once every
 * chip is placed, else null.
 */
export function demand(placements: Placements, n: number): Demand[] {
	const done = allPlaced(placements);
	return chipsOn(placements, n).map((c) =>
		c.length >= 2 ? 'over' : done && c.length === 0 ? 'unclaimed' : null
	);
}

export const DEMAND_LABEL: Record<Exclude<Demand, null>, string> = {
	over: 'Over-demanded',
	unclaimed: 'Unclaimed'
};

/** Live-region text for a chip move. */
export function moveAnnouncement(name: string, group: number | null): string {
	return group === null ? `${name} is unplaced` : `${name} chose group ${group + 1}`;
}

// Data tokens in an order that keeps neighbours distinct; skips the grey (8).
const COLOUR_ORDER = [1, 4, 3, 6, 2, 5, 9, 10, 11, 7, 12, 8];

/** A colour token per person, unique for up to 12 people. */
export function personColour(person: number): string {
	return `var(--data-${COLOUR_ORDER[person % COLOUR_ORDER.length]})`;
}

/** holder[g] = person taking group g, when the picks are a permutation. */
export function holdersFromPicks(picks: readonly number[]): number[] {
	const holder = Array<number>(picks.length).fill(-1);
	picks.forEach((g, i) => (holder[g] = i));
	return holder;
}

/** Per person: item indices and raw settlement (+ pays), from a proposal and its holders. */
export function allocation(proposal: Proposal, holder: readonly number[]) {
	const n = holder.length;
	const items = Array.from({ length: n }, () => [] as number[]);
	const owed = Array<number>(n).fill(0);
	holder.forEach((person, g) => {
		items[person] = [...proposal.groups[g]];
		owed[person] = proposal.transfers[g];
	});
	return { items, owed };
}

/** itemOwner[k] = person holding item k, for the swap-or-adjust editor. */
export function itemOwners(personItems: readonly (readonly number[])[], m: number): number[] {
	const owner = Array<number>(m).fill(0);
	personItems.forEach((list, person) => list.forEach((k) => (owner[k] = person)));
	return owner;
}

/** Groups (one per person, in person order) from an item → person map. */
export function bundlesFromOwners(owner: readonly number[], n: number): number[][] {
	const groups = Array.from({ length: n }, () => [] as number[]);
	owner.forEach((p, k) => groups[p]?.push(k));
	return groups;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The round-cap offer, in plain words. */
export function fallbackText(fb: Pick<Fallback, 'pFair' | 'residualEnvy'>): string {
	return `No split everyone agrees on yet. Best available split: about ${pct(fb.pFair)} likely fair, largest expected gap ${pct(fb.residualEnvy)} of a fair share.`;
}

/**
 * Colour intensity in [0, 1] for a settlement amount on a symlog scale:
 * log(1 + |x|/C) / log(1 + max/C), with C = 1% of a fair share. `max` is the
 * largest |amount| on the screen.
 */
export function amountIntensity(x: number, fairShare: number, max: number): number {
	const c = 0.01 * fairShare;
	if (!(c > 0) || !(max > 0)) return 0;
	const t = Math.log1p(Math.abs(x) / c) / Math.log1p(max / c);
	return Math.min(1, Math.max(0, t));
}

/** Text colour for a settlement shown as `amount` (+ pays): red for Pay, green for Receive, muted otherwise. */
export function amountColour(amount: number, fairShare: number, max: number): string {
	const r = Math.round(amount);
	if (r === 0) return 'var(--text-muted)';
	const pct = Math.round(amountIntensity(r, fairShare, max) * 100);
	const tone = r > 0 ? 'var(--danger-text)' : 'var(--success-text)';
	return `color-mix(in oklab, ${tone} ${pct}%, var(--text-muted))`;
}

/** Largest rounded |amount|, for the colour scale. */
export function maxAbsRounded(amounts: readonly number[]): number {
	return amounts.reduce((m, x) => Math.max(m, Math.abs(Math.round(x))), 0);
}

/**
 * Drop target under a point: the index of the rect that contains it after
 * growing each by `slop` px, nearest centre on overlaps; -1 if none.
 */
export function hitTest(
	x: number,
	y: number,
	rects: readonly { left: number; top: number; right: number; bottom: number }[],
	slop = 16
): number {
	let best = -1;
	let bestD = Infinity;
	rects.forEach((r, i) => {
		if (x < r.left - slop || x > r.right + slop || y < r.top - slop || y > r.bottom + slop) return;
		const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	});
	return best;
}
