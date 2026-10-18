import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
	createTimelineLoader,
	formatShortDate,
	getYear,
	groupByYear,
	hasRichContent,
	isPast,
	localDateString,
	pickTimelineId,
	sortEventsByDate,
	type TimelineEvent
} from './timelines';

type Event = TimelineEvent;

function groupsFor(events: Event[]) {
	return groupByYear(sortEventsByDate(events));
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
		// Pin both the zone and the clock so results do not depend on where or when the suite
		// runs. Local times are built with new Date(y, m, d, h, min), i.e. in the pinned zone.
		const originalTz = process.env.TZ;
		beforeEach(() => {
			process.env.TZ = 'Europe/Rome';
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
			if (originalTz === undefined) delete process.env.TZ;
			else process.env.TZ = originalTz;
		});

		it('returns true for dates before today', () => {
			vi.setSystemTime(new Date(2026, 5, 15, 12, 0));
			expect(isPast('2020-01-01')).toBe(true);
			expect(isPast('2026-06-14')).toBe(true);
		});

		it('returns false for future dates', () => {
			vi.setSystemTime(new Date(2026, 5, 15, 12, 0));
			expect(isPast('2026-06-16')).toBe(false);
			expect(isPast('2099-06-15')).toBe(false);
		});

		it('returns false for today, including when local and UTC dates differ', () => {
			// 00:30 in Rome (summer time) is still the previous day in UTC; 23:30 is late in the day.
			for (const [h, m] of [
				[0, 30],
				[12, 0],
				[23, 30]
			]) {
				vi.setSystemTime(new Date(2026, 5, 15, h, m));
				expect(localDateString()).toBe('2026-06-15');
				expect(isPast('2026-06-15')).toBe(false);
				expect(isPast('2026-06-14')).toBe(true);
			}
			vi.setSystemTime(new Date(2026, 5, 15, 0, 30));
			expect(new Date().toISOString().slice(0, 10)).toBe('2026-06-14');
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

describe('groupByYear', () => {
	it('returns no groups for no events', () => {
		expect(groupsFor([])).toEqual([]);
	});

	it('keeps every event of a single year in one group, in date order', () => {
		const groups = groupsFor(mockEvents);
		expect(groups).toHaveLength(1);
		expect(groups[0].year).toBe(2024);
		expect(groups[0].events).toEqual(sortEventsByDate(mockEvents));
	});

	it('emits one group per year in ascending order', () => {
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
		const groups = groupsFor(events);
		expect(groups.map((g) => g.year)).toEqual([2020, 2021, 2022, 2023, 2024]);
		expect(groups.every((g) => g.events.length === 1)).toBe(true);
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

describe('pickTimelineId', () => {
	const timelines = [
		{ id: 'a', shortTitle: 'A', description: '' },
		{ id: 'b', shortTitle: 'B', description: '' },
		{ id: 'c', shortTitle: 'C', description: '' }
	];
	const never = () => {
		throw new Error('random must not be used for a valid ?t');
	};

	it('keeps a ?t that names a timeline', () => {
		expect(pickTimelineId(timelines, 'b', never)).toBe('b');
	});

	it('falls back to a random timeline for a missing or unknown ?t', () => {
		expect(pickTimelineId(timelines, null, () => 0)).toBe('a');
		expect(pickTimelineId(timelines, '', () => 0.5)).toBe('b');
		expect(pickTimelineId(timelines, 'bogus', () => 0.999)).toBe('c');
	});
});
