import { describe, it, expect, beforeEach } from 'vitest';

// Types (copied from component for testing)
interface Timeline {
	id: string;
	shortTitle: string;
	description: string;
}

interface Event {
	id: number;
	emoji: string;
	date: string;
	title: string;
	description: string;
	url?: string;
}

interface EventTimeline {
	eventId: number;
	timelineId: string;
}

type TimelineRow = { type: 'year'; year: number } | { type: 'events'; events: Event[] };

// Test data
const mockTimelines: Timeline[] = [
	{ id: 'eu-elections', shortTitle: 'European Elections', description: 'National elections in EU' },
	{ id: 'eu-key-events', shortTitle: 'Key Events', description: 'Key milestones' }
];

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

const mockEventTimeline: EventTimeline[] = [
	{ eventId: 1, timelineId: 'eu-elections' },
	{ eventId: 2, timelineId: 'eu-elections' },
	{ eventId: 3, timelineId: 'eu-elections' },
	{ eventId: 4, timelineId: 'eu-elections' },
	{ eventId: 5, timelineId: 'eu-elections' },
	{ eventId: 6, timelineId: 'eu-elections' },
	{ eventId: 7, timelineId: 'eu-elections' },
	{ eventId: 8, timelineId: 'eu-elections' }
];

// Functions (copied from component for testing)
const COLUMNS = 3;

function getYear(dateStr: string): number {
	return new Date(dateStr).getFullYear();
}

function formatShortDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short'
	});
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

function isPast(dateStr: string): boolean {
	const date = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
}

function updateFilteredEvents(
	timelineId: string,
	allEvents: Event[],
	eventTimeline: EventTimeline[]
): { filteredEvents: Event[]; timelineRows: TimelineRow[] } {
	if (!timelineId) {
		return { filteredEvents: [], timelineRows: [] };
	}

	const eventIds = eventTimeline
		.filter((et) => et.timelineId === timelineId)
		.map((et) => et.eventId);

	const filteredEvents = allEvents
		.filter((e) => eventIds.includes(e.id))
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	// Group events by year
	const eventsByYear = new Map<number, Event[]>();
	for (const event of filteredEvents) {
		const year = getYear(event.date);
		if (!eventsByYear.has(year)) {
			eventsByYear.set(year, []);
		}
		eventsByYear.get(year)!.push(event);
	}

	// Build rows: year separator + chunked events for each year
	const rows: TimelineRow[] = [];
	const sortedYears = Array.from(eventsByYear.keys()).sort((a, b) => a - b);

	for (const year of sortedYears) {
		rows.push({ type: 'year', year });

		const yearEvents = eventsByYear.get(year)!;
		for (let i = 0; i < yearEvents.length; i += COLUMNS) {
			rows.push({ type: 'events', events: yearEvents.slice(i, i + COLUMNS) });
		}
	}

	return { filteredEvents, timelineRows: rows };
}

function filterEventsByDateRange(events: Event[], startDate: string, endDate: string): Event[] {
	const start = new Date(startDate);
	const end = new Date(endDate);
	return events.filter((e) => {
		const eventDate = new Date(e.date);
		return eventDate >= start && eventDate <= end;
	});
}

function validateTimelineId(timelineId: string, timelines: Timeline[]): boolean {
	return timelines.some((t) => t.id === timelineId);
}

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

		it('handles dates with different separators', () => {
			expect(getYear('2024/03/10')).toBe(2024);
			expect(getYear('2024.05.12')).toBe(2024);
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

	describe('formatDate', () => {
		it('formats date to full format (DD Mon YYYY)', () => {
			const result = formatDate('2024-01-28');
			expect(result).toMatch(/^28\s+Jan\s+2024$/i);
		});

		it('formats dates across different years', () => {
			expect(formatDate('2024-06-09')).toMatch(/^09\s+Jun\s+2024$/i);
			expect(formatDate('2030-01-01')).toMatch(/^01\s+Jan\s+2030$/i);
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
			const today = new Date().toISOString().split('T')[0];
			// Note: isPast uses setHours(0,0,0,0) so today should be false
			expect(isPast(today)).toBe(false);
		});
	});
});

describe('Timeline Filtering', () => {
	describe('updateFilteredEvents', () => {
		it('returns empty arrays when timelineId is empty', () => {
			const result = updateFilteredEvents('', mockEvents, mockEventTimeline);
			expect(result.filteredEvents).toEqual([]);
			expect(result.timelineRows).toEqual([]);
		});

		it('filters events by timelineId', () => {
			const result = updateFilteredEvents('eu-elections', mockEvents, mockEventTimeline);
			expect(result.filteredEvents.length).toBe(8);
			expect(result.filteredEvents.every((e) => e.id >= 1 && e.id <= 8)).toBe(true);
		});

		it('returns empty when timeline has no events', () => {
			const emptyMapping: EventTimeline[] = [];
			const result = updateFilteredEvents('eu-elections', mockEvents, emptyMapping);
			expect(result.filteredEvents).toEqual([]);
			expect(result.timelineRows).toEqual([]);
		});

		it('sorts events by date ascending', () => {
			const result = updateFilteredEvents('eu-elections', mockEvents, mockEventTimeline);
			const dates = result.filteredEvents.map((e) => e.date);
			const sortedDates = [...dates].sort();
			expect(dates).toEqual(sortedDates);
		});

		it('generates correct timeline rows structure', () => {
			const result = updateFilteredEvents('eu-elections', mockEvents, mockEventTimeline);

			// Should have year separators and event rows
			expect(result.timelineRows.length).toBeGreaterThan(0);

			// First row should be a year separator
			expect(result.timelineRows[0].type).toBe('year');

			// Should have event rows after year separator
			const eventRows = result.timelineRows.filter((r) => r.type === 'events');
			expect(eventRows.length).toBeGreaterThan(0);
		});

		it('chunks events into rows of 3 columns', () => {
			const result = updateFilteredEvents('eu-elections', mockEvents, mockEventTimeline);

			const eventRows = result.timelineRows.filter((r) => r.type === 'events');

			// Most rows should have 3 events (except possibly the last one)
			for (let i = 0; i < eventRows.length - 1; i++) {
				expect(eventRows[i].events.length).toBe(3);
			}

			// The last event row should have the remaining events
			const lastRow = eventRows[eventRows.length - 1];
			expect(lastRow.events.length).toBeLessThanOrEqual(3);
		});

		it('groups events by year correctly', () => {
			const result = updateFilteredEvents('eu-elections', mockEvents, mockEventTimeline);

			const yearSeparators = result.timelineRows.filter((r) => r.type === 'year');

			// All events are from 2024 in mock data
			expect(yearSeparators.length).toBe(1);
			expect(yearSeparators[0].year).toBe(2024);
		});
	});

	describe('filterEventsByDateRange', () => {
		it('filters events within date range', () => {
			const result = filterEventsByDateRange(mockEvents, '2024-01-01', '2024-06-30');
			expect(result.length).toBe(7); // Jan to Jun 2024
		});

		it('returns empty array when no events in range', () => {
			const result = filterEventsByDateRange(mockEvents, '2025-01-01', '2025-12-31');
			expect(result).toEqual([]);
		});

		it('includes boundary dates', () => {
			const result = filterEventsByDateRange(mockEvents, '2024-01-28', '2024-01-28');
			expect(result.length).toBe(1);
			expect(result[0].id).toBe(1); // Finland Election
		});

		it('returns all events when range covers all', () => {
			const result = filterEventsByDateRange(mockEvents, '2020-01-01', '2030-12-31');
			expect(result.length).toBe(mockEvents.length);
		});
	});

	describe('validateTimelineId', () => {
		it('returns true for valid timeline ID', () => {
			expect(validateTimelineId('eu-elections', mockTimelines)).toBe(true);
			expect(validateTimelineId('eu-key-events', mockTimelines)).toBe(true);
		});

		it('returns false for invalid timeline ID', () => {
			expect(validateTimelineId('invalid-id', mockTimelines)).toBe(false);
			expect(validateTimelineId('', mockTimelines)).toBe(false);
		});

		it('returns false for empty timelines array', () => {
			expect(validateTimelineId('eu-elections', [])).toBe(false);
		});
	});
});

describe('Timeline Row Generation', () => {
	it('generates correct number of rows for multiple years', () => {
		const multiYearEvents: Event[] = [
			{ id: 1, emoji: '🇫🇮', date: '2024-01-28', title: 'Event 2024', description: '' },
			{ id: 2, emoji: '🇵🇹', date: '2025-03-10', title: 'Event 2025', description: '' },
			{ id: 3, emoji: '🇸🇰', date: '2026-04-06', title: 'Event 2026', description: '' }
		];

		const mapping: EventTimeline[] = [
			{ eventId: 1, timelineId: 'test' },
			{ eventId: 2, timelineId: 'test' },
			{ eventId: 3, timelineId: 'test' }
		];

		const result = updateFilteredEvents('test', multiYearEvents, mapping);

		const yearSeparators = result.timelineRows.filter((r) => r.type === 'year');
		expect(yearSeparators.length).toBe(3);
	});

	it('handles events spanning many years correctly', () => {
		// Create events for 5 different years with 1 event each
		const manyYearEvents: Event[] = [];
		const mapping: EventTimeline[] = [];

		for (let year = 2020; year <= 2024; year++) {
			manyYearEvents.push({
				id: year,
				emoji: '🎯',
				date: `${year}-06-15`,
				title: `Event ${year}`,
				description: ''
			});
			mapping.push({ eventId: year, timelineId: 'test' });
		}

		const result = updateFilteredEvents('test', manyYearEvents, mapping);

		const yearSeparators = result.timelineRows.filter((r) => r.type === 'year');
		expect(yearSeparators.length).toBe(5);

		const years = yearSeparators.map((r) => (r as { type: 'year'; year: number }).year);
		expect(years).toEqual([2020, 2021, 2022, 2023, 2024]);
	});

	it('handles exactly 3 events (one full row)', () => {
		const threeEvents: Event[] = [
			{ id: 1, emoji: '🇦', date: '2024-01-01', title: 'Event 1', description: '' },
			{ id: 2, emoji: '🇧', date: '2024-02-01', title: 'Event 2', description: '' },
			{ id: 3, emoji: '🇨', date: '2024-03-01', title: 'Event 3', description: '' }
		];

		const mapping = [
			{ eventId: 1, timelineId: 'test' },
			{ eventId: 2, timelineId: 'test' },
			{ eventId: 3, timelineId: 'test' }
		];

		const result = updateFilteredEvents('test', threeEvents, mapping);

		// Should have: 1 year row + 1 events row
		expect(result.timelineRows.length).toBe(2);

		const eventRow = result.timelineRows[1] as { type: 'events'; events: Event[] };
		expect(eventRow.type).toBe('events');
		expect(eventRow.events.length).toBe(3);
	});

	it('handles 4 events (two rows: 3 + 1)', () => {
		const fourEvents: Event[] = [
			{ id: 1, emoji: '🇦', date: '2024-01-01', title: 'Event 1', description: '' },
			{ id: 2, emoji: '🇧', date: '2024-02-01', title: 'Event 2', description: '' },
			{ id: 3, emoji: '🇨', date: '2024-03-01', title: 'Event 3', description: '' },
			{ id: 4, emoji: '🇩', date: '2024-04-01', title: 'Event 4', description: '' }
		];

		const mapping = [
			{ eventId: 1, timelineId: 'test' },
			{ eventId: 2, timelineId: 'test' },
			{ eventId: 3, timelineId: 'test' },
			{ eventId: 4, timelineId: 'test' }
		];

		const result = updateFilteredEvents('test', fourEvents, mapping);

		// Should have: 1 year row + 2 event rows
		expect(result.timelineRows.length).toBe(3);

		const eventRows = result.timelineRows.filter((r) => r.type === 'events') as Array<{
			type: 'events';
			events: Event[];
		}>;

		expect(eventRows[0].events.length).toBe(3);
		expect(eventRows[1].events.length).toBe(1);
	});
});

describe('Event Structure Validation', () => {
	it('validates required event fields', () => {
		const event = mockEvents[0];
		expect(event).toHaveProperty('id');
		expect(event).toHaveProperty('emoji');
		expect(event).toHaveProperty('date');
		expect(event).toHaveProperty('title');
		expect(event).toHaveProperty('description');
	});

	it('validates optional url field', () => {
		const eventWithUrl = mockEvents[0];
		expect(eventWithUrl.url).toBeDefined();
	});

	it('events have valid date format', () => {
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		for (const event of mockEvents) {
			expect(event.date).toMatch(dateRegex);
		}
	});

	it('events have numeric ids', () => {
		for (const event of mockEvents) {
			expect(typeof event.id).toBe('number');
			expect(event.id).toBeGreaterThan(0);
		}
	});
});

describe('Timeline Structure Validation', () => {
	it('validates required timeline fields', () => {
		for (const timeline of mockTimelines) {
			expect(timeline).toHaveProperty('id');
			expect(timeline).toHaveProperty('shortTitle');
			expect(timeline).toHaveProperty('description');
		}
	});

	it('timeline ids are unique', () => {
		const ids = mockTimelines.map((t) => t.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it('validates event-timeline mapping structure', () => {
		for (const mapping of mockEventTimeline) {
			expect(mapping).toHaveProperty('eventId');
			expect(mapping).toHaveProperty('timelineId');
			expect(typeof mapping.eventId).toBe('number');
			expect(typeof mapping.timelineId).toBe('string');
		}
	});

	it('all mapped eventIds exist in events', () => {
		const eventIds = new Set(mockEvents.map((e) => e.id));
		for (const mapping of mockEventTimeline) {
			expect(eventIds.has(mapping.eventId)).toBe(true);
		}
	});

	it('all mapped timelineIds exist in timelines', () => {
		const timelineIds = new Set(mockTimelines.map((t) => t.id));
		for (const mapping of mockEventTimeline) {
			expect(timelineIds.has(mapping.timelineId)).toBe(true);
		}
	});
});
