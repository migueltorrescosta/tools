import type { Category, Comparison, Run, Stimulus } from './types.js';

export const RUNS_KEY = 'implicit-association:runs';
/** The IndexedDB key (src/lib/implicit-association/idb.ts) of the custom comparisons. */
export const CUSTOM_KEY = 'custom';
export const MIN_ITEMS = 4;
export const MAX_ITEMS = 8;

/** The JSON export: every run and custom comparison, versioned for later changes. */
export interface Backup {
	version: 1;
	runs: Run[];
	custom: Comparison[];
}

/** A short stable id from the comparison's content, so the same shared test groups together. */
export function contentId(c: Pick<Comparison, 'targets' | 'attributes'>): string {
	const text = JSON.stringify([c.targets, c.attributes]);
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
	return `custom-${h.toString(36)}`;
}

/** Problems with a custom category, or an empty list. */
export function categoryErrors(c: Category): string[] {
	const errors: string[] = [];
	if (!c.label.trim()) errors.push('Name every category.');
	if (c.items.length < MIN_ITEMS || c.items.length > MAX_ITEMS)
		errors.push(`Give ${c.label.trim() || 'each category'} ${MIN_ITEMS} to ${MAX_ITEMS} items.`);
	return errors;
}

/** Merge imported data into the current data: new runs and comparisons are added by id. */
export function merge(current: Backup, incoming: Backup): Backup {
	const runIds = new Set(current.runs.map((r) => r.id));
	const customIds = new Set(current.custom.map((c) => c.id));
	return {
		version: 1,
		runs: [...current.runs, ...incoming.runs.filter((r) => !runIds.has(r.id))].sort((a, b) =>
			a.date.localeCompare(b.date)
		),
		custom: [...current.custom, ...incoming.custom.filter((c) => !customIds.has(c.id))]
	};
}

/** Parse an export file; null when it is not one. */
export function parseBackup(text: string): Backup | null {
	try {
		const data = JSON.parse(text) as Partial<Backup>;
		if (data.version !== 1 || !Array.isArray(data.runs) || !Array.isArray(data.custom)) return null;
		return { version: 1, runs: data.runs, custom: data.custom };
	} catch {
		return null;
	}
}

/** A share link's payload: labels and words only (images stay in the browser). */
type Shared = [string, string[]][];

const toBase64Url = (s: string) =>
	btoa(String.fromCodePoint(...new TextEncoder().encode(s)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
const fromBase64Url = (s: string) =>
	new TextDecoder().decode(
		Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (ch) => ch.codePointAt(0)!)
	);

export const isWordOnly = (c: Pick<Comparison, 'targets' | 'attributes'>) =>
	[...c.targets, ...c.attributes].every((cat) => cat.items.every((i) => i.kind === 'word'));

/** Encode a word-only comparison for the URL hash (`#c=...`). */
export function encodeShare(c: Pick<Comparison, 'targets' | 'attributes'>): string {
	const payload: Shared = [...c.targets, ...c.attributes].map((cat) => [
		cat.label,
		cat.items.map((i) => (i.kind === 'word' ? i.text : ''))
	]);
	return toBase64Url(JSON.stringify(payload));
}

/** Decode a share link into a custom comparison; null when it is malformed. */
export function decodeShare(code: string): Comparison | null {
	try {
		const data = JSON.parse(fromBase64Url(code)) as Shared;
		if (!Array.isArray(data) || data.length !== 4) return null;
		const cats = data.map(([label, list]): Category => {
			if (typeof label !== 'string' || !Array.isArray(list)) throw new Error('bad');
			return {
				label: label.slice(0, 40),
				items: list
					.filter((w) => typeof w === 'string' && w.trim())
					.map((w): Stimulus => ({ kind: 'word', text: w.trim().slice(0, 40) }))
			};
		});
		if (cats.some((c) => categoryErrors(c).length)) return null;
		const body = { targets: [cats[0], cats[1]], attributes: [cats[2], cats[3]] } as Pick<
			Comparison,
			'targets' | 'attributes'
		>;
		return { ...body, id: contentId(body), custom: true };
	} catch {
		return null;
	}
}
