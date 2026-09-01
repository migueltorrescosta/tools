export interface Session {
	id: string;
	day: string;
	room: string;
	title: string;
	startTime: string;
	endTime: string;
	description: string;
	speakers: { name: string; type: string }[];
	moderator: string | null;
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

/** Given a session and the master boundaries, compute grid row start/end (1-indexed for CSS Grid) */
export function getRowSpan(
	session: Session,
	boundaries: string[]
): { rowStart: number; rowEnd: number } {
	const start = toTimeStr(session.startTime);
	const end = toTimeStr(session.endTime);
	const startIdx = boundaries.indexOf(start);
	const endIdx = boundaries.indexOf(end);
	// CSS Grid is 1-indexed: first boundary line = 1
	return {
		rowStart: startIdx + 1,
		rowEnd: endIdx + 1
	};
}

/** Compute how far "now" is through the timeline as a fraction 0-1 */
export function getNowOffset(now: Date, boundaries: string[]): number {
	if (boundaries.length < 2) return 0;
	const first = toMinutes(boundaries[0]);
	const last = toMinutes(boundaries[boundaries.length - 1]);
	const totalMinutes = last - first;
	if (totalMinutes <= 0) return 0;

	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	if (nowMinutes <= first) return 0;
	if (nowMinutes >= last) return 1;
	return (nowMinutes - first) / totalMinutes;
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
		if (new Date(s.endTime).getTime() <= nowMs) continue;
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

/** Format an ISO time string to "HH:MM" */
export function formatTime(iso: string): string {
	return iso.substring(11, 16);
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
