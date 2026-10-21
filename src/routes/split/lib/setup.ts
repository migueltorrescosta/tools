/**
 * Route-only helpers for the split setup screen: name checks, item pills,
 * and saving the setup in the browser.
 */
import { personError } from '$lib/split';
import { amountIntensity } from './board';

export interface SetupItem {
	id: number;
	description: string;
	price: number;
}
export interface SetupPerson {
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

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isInt = (x: unknown): x is number => Number.isInteger(x);

/** Parse a saved setup, or null if it is missing or malformed. */
export function parseSetup(raw: string | null): SavedSetup | null {
	if (!raw) return null;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isObj(data) || !Array.isArray(data.people) || !Array.isArray(data.items)) return null;
	const people = data.people.filter(
		(p): p is SetupPerson => isObj(p) && isInt(p.id) && typeof p.name === 'string' && !!p.name
	);
	const items = data.items.filter(
		(i): i is SetupItem =>
			isObj(i) &&
			isInt(i.id) &&
			typeof i.description === 'string' &&
			typeof i.price === 'number' &&
			Number.isFinite(i.price) &&
			i.price > 0
	);
	const next = (v: unknown, list: { id: number }[]) =>
		Math.max(isInt(v) ? v : 0, ...list.map((x) => x.id + 1));
	return {
		people: people.map(({ id, name }) => ({ id, name })),
		items: items.map(({ id, description, price }) => ({ id, description, price })),
		nextPersonId: next(data.nextPersonId, people),
		nextItemId: next(data.nextItemId, items)
	};
}

/** Read the saved setup; null without storage or data. */
export function loadSetup(): SavedSetup | null {
	try {
		return parseSetup(localStorage.getItem(SETUP_KEY));
	} catch {
		return null;
	}
}

/** Save the setup; silently skipped when storage is unavailable. */
export function saveSetup(setup: SavedSetup): void {
	try {
		localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
	} catch {
		// Private mode or blocked storage: the page works without it.
	}
}
