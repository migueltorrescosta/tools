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

export function getYear(dateStr: string): number {
	return new Date(dateStr).getFullYear();
}

export function formatShortDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short'
	});
}

export function isPast(dateStr: string): boolean {
	const date = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return date < today;
}

export function hasRichContent(events: TimelineEvent[]): boolean {
	return events.some((e) => e.conceptDescription || e.valueAdd);
}

export function sortEventsByDate(events: TimelineEvent[]): TimelineEvent[] {
	return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
