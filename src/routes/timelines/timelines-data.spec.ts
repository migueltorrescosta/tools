import { describe, it, expect } from 'vitest';
import timelinesData from './data/timelines.json';
import type { Timeline, TimelineEvent } from './timelines';

const timelines = timelinesData as Timeline[];
const eventFiles = import.meta.glob<TimelineEvent[]>('./data/events/*.json', {
	eager: true,
	import: 'default'
});

function eventsFor(id: string): TimelineEvent[] | undefined {
	return eventFiles[`./data/events/${id}.json`];
}

function isCalendarDate(s: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!match) return false;
	const [y, m, d] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

describe('timelines.json', () => {
	it('has unique ids', () => {
		const ids = timelines.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('has an events file for every timeline and no orphan files', () => {
		for (const t of timelines) {
			expect(eventsFor(t.id), `events file for ${t.id}`).toBeDefined();
		}
		const known = new Set(timelines.map((t) => `./data/events/${t.id}.json`));
		expect(Object.keys(eventFiles).filter((k) => !known.has(k))).toEqual([]);
	});
});

describe('isCalendarDate', () => {
	it('accepts real dates and rejects malformed or impossible ones', () => {
		expect(isCalendarDate('2028-02-29')).toBe(true);
		expect(isCalendarDate('2027-02-29')).toBe(false);
		expect(isCalendarDate('2026-13-01')).toBe(false);
		expect(isCalendarDate('2026-1-01')).toBe(false);
		expect(isCalendarDate('2026/01/01')).toBe(false);
	});
});

describe.each(timelines.map((t) => [t.id] as const))('events/%s.json', (id) => {
	const events = eventsFor(id) ?? [];

	it('is a non-empty list', () => {
		expect(events.length).toBeGreaterThan(0);
	});

	it('has valid ISO calendar dates', () => {
		const bad = events.filter((e) => !isCalendarDate(e.date)).map((e) => `${e.id}:${e.date}`);
		expect(bad).toEqual([]);
	});

	it('has required non-empty, trimmed string fields', () => {
		const bad: string[] = [];
		for (const e of events) {
			expect(typeof e.id).toBe('number');
			for (const key of ['emoji', 'title', 'description'] as const) {
				if (typeof e[key] !== 'string' || e[key].length === 0) bad.push(`${e.id}.${key} missing`);
			}
			for (const [key, value] of Object.entries(e)) {
				if (typeof value === 'string' && value !== value.trim()) bad.push(`${e.id}.${key}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('uses https for every url', () => {
		const bad = events.filter((e) => e.url !== undefined && !/^https:\/\/\S+$/.test(e.url));
		expect(bad.map((e) => `${e.id}:${e.url}`)).toEqual([]);
	});

	it('has both rich fields on every event when the timeline is rich', () => {
		const rich = events.some((e) => e.conceptDescription || e.valueAdd);
		const bad = rich
			? events.filter((e) => !e.conceptDescription || !e.valueAdd).map((e) => e.id)
			: [];
		expect(bad).toEqual([]);
	});
});

describe('event ids', () => {
	it('are unique across all timelines', () => {
		const seen = new Map<number, string>();
		const dups: string[] = [];
		for (const t of timelines) {
			for (const e of eventsFor(t.id) ?? []) {
				const prev = seen.get(e.id);
				if (prev) dups.push(`${e.id} in ${prev} and ${t.id}`);
				seen.set(e.id, t.id);
			}
		}
		expect(dups).toEqual([]);
	});
});
