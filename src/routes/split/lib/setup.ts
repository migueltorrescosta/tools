/**
 * Route-only helpers for the split setup screen: name checks, item pills,
 * and the shape check for the saved setup.
 */
import { personError } from '$lib/split';
import { amountIntensity } from './board';

interface SetupItem {
	id: number;
	description: string;
	price: number;
}
interface SetupPerson {
	id: number;
	name: string;
}
export interface SavedSetup {
	people: SetupPerson[];
	items: SetupItem[];
	nextPersonId: number;
	nextItemId: number;
}

/** personError, plus "That name is taken." for a case-insensitive, trimmed duplicate. */
export function personNameError(name: string, existing: readonly string[]): string | null {
	const base = personError(name);
	if (base) return base;
	const key = name.trim().toLowerCase();
	return existing.some((e) => e.trim().toLowerCase() === key) ? 'That name is taken.' : null;
}

/** Items sorted by price, highest first; ties keep entry order. */
export function byPriceDesc<T extends { price: number }>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => b.price - a.price);
}

/**
 * Border colour of an item pill: the accent hue on a symlog scale of the price
 * against the largest price, with C = 1% of the mean price.
 */
export function priceTint(price: number, prices: readonly number[]): string {
	const max = prices.reduce((m, p) => Math.max(m, p), 0);
	const mean = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
	const pct = Math.round(amountIntensity(price, mean, max) * 100);
	return `color-mix(in oklab, var(--accent) ${pct}%, var(--border))`;
}

export const SETUP_KEY = 'split-setup-v1';

const ok = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Minimal shape check of a saved setup (from readJson); null if unusable. */
export function parseSetup(data: unknown): SavedSetup | null {
	if (!ok(data) || !Array.isArray(data.people) || !Array.isArray(data.items)) return null;
	const people = data.people.filter(
		(p): p is SetupPerson => ok(p) && Number.isInteger(p.id) && typeof p.name === 'string'
	);
	const items = data.items.filter(
		(i): i is SetupItem =>
			ok(i) && Number.isInteger(i.id) && typeof i.description === 'string' && Number(i.price) > 0
	);
	// Next ids stay above every saved id, so keys never collide.
	const next = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id + 1));
	return { people, items, nextPersonId: next(people), nextItemId: next(items) };
}

/**
 * Start screen: per person, the entered value of every item they claimed
 * (claims[k] lists who claimed item k); a shared item counts in full for each
 * claimant. The rough settlement estimate is this value minus a fair share.
 */
export function claimedValues(
	prices: readonly number[],
	claims: readonly (readonly number[])[],
	n: number
): number[] {
	const value = Array<number>(n).fill(0);
	claims.forEach((who, k) => {
		for (const i of who) value[i] += prices[k] ?? 0;
	});
	return value;
}
