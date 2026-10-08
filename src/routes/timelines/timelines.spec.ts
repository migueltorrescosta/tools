import { describe, it, expect, vi } from 'vitest';
import {
	buildTimelineRows,
	createTimelineLoader,
	formatShortDate,
	getYear,
	hasRichContent,
	isPast,
	localDateString,
	sortEventsByDate,
	type TimelineEvent,
	type TimelineRow
} from './timelines';

type Event = TimelineEvent;

function rowsFor(events: Event[]): TimelineRow[] {
	const sorted = sortEventsByDate(events);
	return buildTimelineRows(sorted, hasRichContent(sorted));
}

const mockEvents: Event[] = [
	{
		id: 1,
		emoji: '🇫🇮',
		date: '2024-01-28',
		title: 'Finland Election',
		description: 'Presidential election',
		url: 'https://example.com/finland'
	},
	{
		id: 2,
		emoji: '🇵🇹',
		date: '2024-03-10',
		title: 'Portugal Election',
		description: 'Legislative election'
	},
	{
		id: 3,
		emoji: '🇸🇰',
		date: '2024-04-06',
		title: 'Slovakia Election',
		description: 'Presidential election',
		url: 'https://example.com/slovakia'
	},
	{
		id: 4,
		emoji: '🇱🇹',
		date: '2024-05-12',
		title: 'Lithuania Election',
		description: 'Presidential election'
	},
	{
		id: 5,
		emoji: '🇧🇪',
		date: '2024-06-09',
		title: 'Belgium Election',
		description: 'Federal election'
	},
	{
		id: 6,
		emoji: '🇪🇺',
		date: '2024-06-09',
		title: 'EU Parliament',
		description: 'European Parliament elections',
		url: 'https://example.com/eu'
	},
	{
		id: 7,
		emoji: '🇫🇷',
		date: '2024-06-30',
		title: 'France Election',
		description: 'Legislative election'
	},
	{ id: 8, emoji: '🇬🇧', date: '2024-07-04', title: 'UK Election', description: 'General election' }
];

// Tests
describe('Timeline Utilities', () => {
	describe('getYear', () => {
		it('extracts year from YYYY-MM-DD format', () => {
			expect(getYear('2024-01-28')).toBe(2024);
			expect(getYear('2024-12-31')).toBe(2024);
			expect(getYear('2030-06-15')).toBe(2030);
		});

		it('handles edge case dates', () => {
			expect(getYear('2024-01-01')).toBe(2024);
			expect(getYear('2024-06-30')).toBe(2024);
		});
	});

	describe('formatShortDate', () => {
		it('formats date to short format (DD Mon)', () => {
			const result = formatShortDate('2024-01-28');
			expect(result).toMatch(/^28\s+Jan$/i);
		});

		it('formats different months correctly', () => {
			expect(formatShortDate('2024-03-10')).toMatch(/^10\s+Mar$/i);
			expect(formatShortDate('2024-12-25')).toMatch(/^25\s+Dec$/i);
		});

		it('pads single-digit days with zero', () => {
			const result = formatShortDate('2024-01-05');
			expect(result).toMatch(/^05\s+Jan$/i);
		});
	});

	describe('isPast', () => {
		it('returns true for dates in the past', () => {
			expect(isPast('2020-01-01')).toBe(true);
			expect(isPast('2024-01-01')).toBe(true);
		});

		it('returns false for future dates', () => {
			expect(isPast('2030-12-31')).toBe(false);
			expect(isPast('2099-06-15')).toBe(false);
		});

		it('returns false for today', () => {
			expect(isPast(localDateString())).toBe(false);
		});
	});

	describe('sortEventsByDate', () => {
		it('sorts events by date ascending without mutating the input', () => {
			const reversed = [...mockEvents].reverse();
			const sorted = sortEventsByDate(reversed);
			expect(sorted.map((e) => e.date)).toEqual(mockEvents.map((e) => e.date));
			expect(reversed[0].id).toBe(8);
		});
	});
});

describe('buildTimelineRows', () => {
	it('returns no rows for no events', () => {
		expect(rowsFor([])).toEqual([]);
	});

	it('starts with a year separator and chunks a single year into rows of 3', () => {
		const rows = rowsFor(mockEvents);
		expect(rows[0]).toEqual({ type: 'year', year: 2024 });
		const eventRows = rows.filter((r) => r.type === 'events');
		expect(eventRows.map((r) => r.events.length)).toEqual([3, 3, 2]);
		expect(rows.filter((r) => r.type === 'year')).toHaveLength(1);
	});

	it('emits one separator per year in ascending order', () => {
		const events: Event[] = [];
		for (let year = 2024; year >= 2020; year--) {
			events.push({
				id: year,
				emoji: '🎯',
				date: `${year}-06-15`,
				title: `Event ${year}`,
				description: ''
			});
		}
		const years = rowsFor(events).flatMap((r) => (r.type === 'year' ? [r.year] : []));
		expect(years).toEqual([2020, 2021, 2022, 2023, 2024]);
	});

	it('produces 1 year row + 1 events row for exactly 3 events', () => {
		const events: Event[] = [1, 2, 3].map((i) => ({
			id: i,
			emoji: '📅',
			date: `2024-0${i}-01`,
			title: `Event ${i}`,
			description: ''
		}));
		const rows = rowsFor(events);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toEqual({ type: 'events', events });
	});

	it('produces 3 + 1 rows for 4 events', () => {
		const events: Event[] = [1, 2, 3, 4].map((i) => ({
			id: i,
			emoji: '📅',
			date: `2024-0${i}-01`,
			title: `Event ${i}`,
			description: ''
		}));
		const eventRows = rowsFor(events).filter((r) => r.type === 'events');
		expect(eventRows.map((r) => r.events.length)).toEqual([3, 1]);
	});
});

describe('Rich Content Handling', () => {
	const rich = (i: number): Event => ({
		id: i,
		emoji: '🧠',
		date: '2023-06-15',
		title: `Event ${i}`,
		description: 'Fallback',
		conceptDescription: 'Rich concept',
		valueAdd: 'Rich value'
	});

	it('detects rich content from conceptDescription or valueAdd', () => {
		expect(hasRichContent([rich(1)])).toBe(true);
		expect(hasRichContent([{ ...rich(1), conceptDescription: undefined }])).toBe(true);
		expect(hasRichContent([{ ...rich(1), valueAdd: undefined }])).toBe(true);
	});

	it('returns false when events lack rich fields or there are none', () => {
		expect(hasRichContent([mockEvents[0]])).toBe(false);
		expect(hasRichContent([])).toBe(false);
	});

	it('keeps all rich events of a year in one group', () => {
		const events = [1, 2, 3, 4, 5, 6, 7].map(rich);
		const rows = buildTimelineRows(events, true);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toEqual({ type: 'events', events });
	});

	it('still chunks plain events into groups of 3', () => {
		const events = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ ...mockEvents[0], id: i }));
		const eventRows = buildTimelineRows(events, false).filter((r) => r.type === 'events');
		expect(eventRows.map((r) => r.events.length)).toEqual([3, 3, 1]);
	});
});

describe('createTimelineLoader', () => {
	const ev = (id: string): Event[] => [
		{ id: 1, emoji: '📅', date: '2024-01-01', title: `${id}-event`, description: '' }
	];

	function deferredImporter() {
		const pending = new Map<
			string,
			{ resolve: (e: Event[]) => void; reject: (e: Error) => void }
		>();
		const importer = vi.fn(
			(id: string) =>
				new Promise<Event[]>((resolve, reject) => pending.set(id, { resolve, reject }))
		);
		return { importer, pending };
	}

	it('keeps the latest selection when an earlier import resolves last', async () => {
		const { importer, pending } = deferredImporter();
		const loader = createTimelineLoader(importer);

		const slow = loader.load('a');
		const fast = loader.load('b');
		pending.get('b')!.resolve(ev('b'));
		expect(await fast).toEqual(ev('b'));
		pending.get('a')!.resolve(ev('a'));
		expect(await slow).toBeNull();

		expect(loader.cache.get('a')).toEqual(ev('a'));
		expect(loader.cache.get('b')).toEqual(ev('b'));
	});

	it('serves cached events without importing again', async () => {
		const { importer, pending } = deferredImporter();
		const loader = createTimelineLoader(importer);
		const first = loader.load('a');
		pending.get('a')!.resolve(ev('a'));
		await first;
		expect(await loader.load('a')).toEqual(ev('a'));
		expect(importer).toHaveBeenCalledTimes(1);
	});

	it('swallows failures of superseded loads but rethrows the current one', async () => {
		const { importer, pending } = deferredImporter();
		const loader = createTimelineLoader(importer);
		const stale = loader.load('a');
		const current = loader.load('b');
		pending.get('a')!.reject(new Error('a failed'));
		expect(await stale).toBeNull();
		pending.get('b')!.reject(new Error('b failed'));
		await expect(current).rejects.toThrow('b failed');
		expect(loader.cache.has('b')).toBe(false);
	});
});
