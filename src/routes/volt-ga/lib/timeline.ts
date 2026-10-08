export interface Session {
	id: string;
	day: string;
	room: string;
	title: string;
	startTime: string;
	endTime: string;
	description: string;
	speakers: { name: string; type: string }[];
	moderators: string[];
	type: string;
}

/** Normalize ISO time to "HH:MM" string */
function toTimeStr(iso: string): string {
	return iso.substring(11, 16);
}

/** Parse "HH:MM" to total minutes from midnight */
function toMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

/** Collect all unique session boundary times across all sessions, sorted ascending */
export function getMasterBoundaries(sessions: Session[]): string[] {
	const times = new Set<string>();
	for (const s of sessions) {
		times.add(toTimeStr(s.startTime));
		times.add(toTimeStr(s.endTime));
	}
	return Array.from(times).sort((a, b) => toMinutes(a) - toMinutes(b));
}

/** Grid rows taken by the room-header row above the timeline */
export const HEADER_ROWS = 1;

/** CSS grid row (1-indexed) of the slot that starts at boundary index i; matches the time labels */
export function boundaryRow(i: number): number {
	return i + HEADER_ROWS + 1;
}

/** Given a session and the master boundaries, compute grid row start/end (1-indexed for CSS Grid) */
export function getRowSpan(
	session: Session,
	boundaries: string[]
): { rowStart: number; rowEnd: number } {
	const start = toTimeStr(session.startTime);
	const end = toTimeStr(session.endTime);
	const startIdx = boundaries.indexOf(start);
	const endIdx = boundaries.indexOf(end);
	if (startIdx < 0 || endIdx < 0) {
		throw new Error(`Session "${session.id}" (${start}-${end}) is not on the master boundaries`);
	}
	return {
		rowStart: boundaryRow(startIdx),
		rowEnd: boundaryRow(endIdx)
	};
}

/**
 * Locate "now" on the schedule grid: the grid row of the boundary interval that
 * contains it, plus the fraction through that interval. Rows are equal height
 * regardless of duration, so the position must be per-row, not linear in minutes.
 * Works on absolute instants, so the viewer's timezone and date are irrelevant.
 * Returns null when now is outside the event (before the first start, at or after the last end).
 */
export function getNowPosition(
	now: Date,
	sessions: Session[]
): { row: number; fraction: number } | null {
	const instants = Array.from(
		new Set(
			sessions.flatMap((s) => [new Date(s.startTime).getTime(), new Date(s.endTime).getTime()])
		)
	).sort((x, y) => x - y);
	const t = now.getTime();
	if (instants.length < 2 || t < instants[0] || t >= instants[instants.length - 1]) return null;
	let i = 0;
	while (t >= instants[i + 1]) i++;
	return {
		row: boundaryRow(i),
		fraction: (t - instants[i]) / (instants[i + 1] - instants[i])
	};
}

/** Get sessions currently active (startTime <= now < endTime) */
export function getActiveSessions(sessions: Session[], now: Date): Session[] {
	const nowMs = now.getTime();
	return sessions.filter((s) => {
		const startMs = new Date(s.startTime).getTime();
		const endMs = new Date(s.endTime).getTime();
		return startMs <= nowMs && nowMs < endMs;
	});
}

/** For each room, get the next upcoming session (the first with startTime > now) */
export function getNextSessions(sessions: Session[], now: Date): Map<string, Session> {
	const nowMs = now.getTime();
	const byRoom = new Map<string, Session[]>();
	for (const s of sessions) {
		if (new Date(s.startTime).getTime() <= nowMs) continue;
		const list = byRoom.get(s.room) || [];
		list.push(s);
		byRoom.set(s.room, list);
	}
	const result = new Map<string, Session>();
	for (const [room, list] of byRoom) {
		list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
		result.set(room, list[0]);
	}
	return result;
}

/** Earliest start and latest end of the event, as epoch ms; null when there are no sessions */
export function getEventBounds(sessions: Session[]): { start: number; end: number } | null {
	if (sessions.length === 0) return null;
	let start = Infinity;
	let end = -Infinity;
	for (const s of sessions) {
		start = Math.min(start, new Date(s.startTime).getTime());
		end = Math.max(end, new Date(s.endTime).getTime());
	}
	return { start, end };
}

/** Whether a session occupies the venue rather than a single room (lunch, coffee breaks) */
export function isVenueWide(session: Session): boolean {
	return session.type === 'break';
}

/**
 * Grid columns (1-indexed, room k is column k + 2) for a session card.
 * Regular sessions take their own room's column. Venue-wide breaks spread across
 * the run of adjacent rooms that are free for the whole break, preferring the run
 * containing the break's own room, so they never paint over a room's programme.
 * Falls back to the own room when every room is busy.
 */
export function getColumnSpan(
	session: Session,
	sessions: Session[],
	rooms: string[] = ROOMS
): { colStart: number; colEnd: number } {
	const own = rooms.indexOf(session.room);
	if (!isVenueWide(session)) return { colStart: own + 2, colEnd: own + 3 };
	const start = new Date(session.startTime).getTime();
	const end = new Date(session.endTime).getTime();
	const busy = rooms.map((room) =>
		sessions.some(
			(o) =>
				o.id !== session.id &&
				!isVenueWide(o) &&
				o.room === room &&
				new Date(o.startTime).getTime() < end &&
				start < new Date(o.endTime).getTime()
		)
	);
	const runs: [number, number][] = [];
	for (let k = 0; k < rooms.length; k++) {
		if (busy[k]) continue;
		const last = runs[runs.length - 1];
		if (last && last[1] === k) last[1] = k + 1;
		else runs.push([k, k + 1]);
	}
	if (runs.length === 0) return { colStart: own + 2, colEnd: own + 3 };
	const [from, to] = runs.find(([a, b]) => a <= own && own < b) ?? runs[0];
	return { colStart: from + 2, colEnd: to + 2 };
}

/** Format an ISO time string to "HH:MM" */
export function formatTime(iso: string): string {
	return iso.substring(11, 16);
}

/** IANA zone of the event; all schedule times are wall-clock times here */
export const EVENT_TIMEZONE = 'Europe/Bratislava';

const clockFormat = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: EVENT_TIMEZONE
});

/** Format an instant as "HH:MM" in event time, independent of the viewer's zone */
export function formatClock(now: Date): string {
	return clockFormat.format(now);
}

/** Format a time range like "09:30 – 10:15" */
export function formatTimeRange(start: string, end: string): string {
	return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

/** Compute duration in minutes between two ISO strings */
export function getDurationMinutes(start: string, end: string): number {
	const diffMs = new Date(end).getTime() - new Date(start).getTime();
	return Math.round(diffMs / 60000);
}

/** Format duration as "45 min" or "1h 30min" */
export function formatDuration(start: string, end: string): string {
	const min = getDurationMinutes(start, end);
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Room order for display */
export const ROOMS = ['Peugeot Arena', 'Sala 1', 'Sala 2', 'Sala 3'];

/** Room colors */
export const ROOM_COLORS: Record<string, string> = {
	'Peugeot Arena': '#00f5ff',
	'Sala 1': '#ff00ff',
	'Sala 2': '#10b981',
	'Sala 3': '#f59e0b'
};
