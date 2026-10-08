export interface Timeline {
	id: string;
	shortTitle: string;
	description: string;
}

export interface TimelineEvent {
	id: number;
	emoji: string;
	date: string;
	title: string;
	description: string;
	url?: string;
	conceptDescription?: string;
	valueAdd?: string;
}

export type TimelineRow =
	| { type: 'year'; year: number }
	| { type: 'events'; events: TimelineEvent[] };

export const COLUMNS = 3;

// Event dates are calendar dates ("YYYY-MM-DD"), not instants. They are never passed to
// new Date(str), which parses them as UTC midnight and shifts them a day in local time west of UTC.

function parseCalendarDate(dateStr: string): [number, number, number] {
	const [y, m, d] = dateStr.split('-').map(Number);
	return [y, m, d];
}

export function getYear(dateStr: string): number {
	return parseCalendarDate(dateStr)[0];
}

export function formatShortDate(dateStr: string): string {
	const [y, m, d] = parseCalendarDate(dateStr);
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		timeZone: 'UTC'
	});
}

/** The viewer's local calendar date as "YYYY-MM-DD". */
export function localDateString(now: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True when the event's calendar date is before the viewer's local today. */
export function isPast(dateStr: string, now: Date = new Date()): boolean {
	return dateStr < localDateString(now);
}

export function hasRichContent(events: TimelineEvent[]): boolean {
	return events.some((e) => e.conceptDescription || e.valueAdd);
}

export function sortEventsByDate(events: TimelineEvent[]): TimelineEvent[] {
	return [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Groups date-sorted events into a year separator followed by event rows.
 * Plain timelines are chunked into rows of COLUMNS; rich timelines keep one group per year.
 */
export function buildTimelineRows(events: TimelineEvent[], rich: boolean): TimelineRow[] {
	const eventsByYear = new Map<number, TimelineEvent[]>();
	for (const event of events) {
		const year = getYear(event.date);
		const group = eventsByYear.get(year);
		if (group) {
			group.push(event);
		} else {
			eventsByYear.set(year, [event]);
		}
	}

	const rows: TimelineRow[] = [];
	const sortedYears = Array.from(eventsByYear.keys()).sort((a, b) => a - b);
	for (const year of sortedYears) {
		rows.push({ type: 'year', year });
		const yearEvents = eventsByYear.get(year)!;
		if (rich) {
			rows.push({ type: 'events', events: yearEvents });
		} else {
			for (let i = 0; i < yearEvents.length; i += COLUMNS) {
				rows.push({ type: 'events', events: yearEvents.slice(i, i + COLUMNS) });
			}
		}
	}
	return rows;
}

export type TimelineImporter = (id: string) => Promise<TimelineEvent[]>;

/**
 * Loads timeline events through `importer`, caching by the id that was requested.
 * Only the most recent `load` call resolves with events; a call superseded by a newer one
 * resolves with null (also when it fails), so a slow earlier response can never replace
 * the selected timeline's events.
 */
export function createTimelineLoader(importer: TimelineImporter) {
	const cache = new Map<string, TimelineEvent[]>();
	let latest = 0;

	async function load(id: string): Promise<TimelineEvent[] | null> {
		const token = ++latest;
		let events = cache.get(id);
		if (!events) {
			try {
				events = await importer(id);
			} catch (error) {
				if (token !== latest) return null;
				throw error;
			}
			cache.set(id, events);
		}
		return token === latest ? events : null;
	}

	return { cache, load };
}

/**
 * The timeline to show for a `?t` value: that id when it names a timeline, otherwise a
 * random one (`random` returns a number in [0, 1), like Math.random).
 */
export function pickTimelineId(
	timelines: Timeline[],
	requested: string | null,
	random: () => number
): string {
	if (requested && timelines.some((t) => t.id === requested)) return requested;
	return timelines[Math.floor(random() * timelines.length)].id;
}
