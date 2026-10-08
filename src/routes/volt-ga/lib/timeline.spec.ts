import { describe, it, expect } from 'vitest';
import {
	formatClock,
	formatDuration,
	formatTime,
	formatTimeRange,
	boundaryRow,
	getRowSpan,
	getActiveSessions,
	getDurationMinutes,
	getMasterBoundaries,
	getNextSessions,
	getNowPosition,
	getEventBounds,
	getColumnSpan,
	ROOMS,
	type Session
} from './timeline';
import events from '../data/events.json';

const bundled = events as Session[];

function session(id: string, room: string, start: string, end: string): Session {
	return {
		id,
		day: 'saturday',
		room,
		title: id,
		startTime: `2026-06-13T${start}:00+02:00`,
		endTime: `2026-06-13T${end}:00+02:00`,
		description: '',
		speakers: [],
		moderators: [],
		type: 'session'
	};
}

const at = (hhmm: string) => new Date(`2026-06-13T${hhmm}:00+02:00`);

const sessions = [
	session('a', 'Sala 1', '09:00', '09:45'),
	session('b', 'Sala 1', '09:45', '11:15'),
	session('c', 'Sala 2', '09:30', '10:30'),
	session('d', 'Sala 2', '10:30', '11:15')
];

describe('getMasterBoundaries', () => {
	it('returns every start/end time once, sorted ascending', () => {
		expect(getMasterBoundaries(sessions)).toEqual(['09:00', '09:30', '09:45', '10:30', '11:15']);
	});

	it('sorts numerically across the hour, not by insertion order', () => {
		const b = getMasterBoundaries([
			session('x', 'Sala 1', '14:00', '15:00'),
			session('y', 'Sala 2', '08:05', '09:55')
		]);
		expect(b).toEqual(['08:05', '09:55', '14:00', '15:00']);
	});
});

describe('getRowSpan', () => {
	const b = getMasterBoundaries(sessions);

	it('puts the first session in the first slot below the header row, next to its label', () => {
		expect(getRowSpan(sessions[0], b)).toEqual({ rowStart: 2, rowEnd: 4 });
		expect(boundaryRow(0)).toBe(2);
	});

	it('starts every card on the row of the time label for its start time', () => {
		for (const s of sessions) {
			const span = getRowSpan(s, b);
			expect(span.rowStart).toBe(boundaryRow(b.indexOf(s.startTime.substring(11, 16))));
			expect(span.rowStart).toBeGreaterThan(1);
			expect(span.rowEnd).toBeGreaterThan(span.rowStart);
		}
		expect(getRowSpan(sessions[1], b)).toEqual({ rowStart: 4, rowEnd: 6 });
	});

	it('throws instead of returning row 0 for a time not on the boundaries', () => {
		expect(() => getRowSpan(session('z', 'Sala 3', '13:00', '14:00'), b)).toThrow(
			/not on the master/
		);
	});
});

describe('getActiveSessions', () => {
	it('treats a session as the half-open interval [start, end)', () => {
		expect(getActiveSessions(sessions, at('09:00')).map((s) => s.id)).toEqual(['a']);
		expect(getActiveSessions(sessions, at('09:45')).map((s) => s.id)).toEqual(['b', 'c']);
		expect(getActiveSessions(sessions, at('11:15'))).toEqual([]);
		expect(getActiveSessions(sessions, at('08:59'))).toEqual([]);
	});
});

describe('getNextSessions', () => {
	it('picks the earliest not-yet-started session per room', () => {
		const next = getNextSessions(sessions, at('08:00'));
		expect(next.get('Sala 1')?.id).toBe('a');
		expect(next.get('Sala 2')?.id).toBe('c');
	});

	it('drops rooms whose sessions have all started', () => {
		expect(getNextSessions(sessions, at('11:15')).size).toBe(0);
		expect(getNextSessions(sessions, at('10:30')).size).toBe(0);
	});

	it('excludes the session already running', () => {
		const next = getNextSessions(sessions, at('09:00'));
		expect(next.get('Sala 1')?.id).toBe('b');
		expect(next.get('Sala 2')?.id).toBe('c');
	});

	it('never marks an active session as next in the bundled data', () => {
		const now = new Date('2026-06-13T10:20:00+02:00');
		const active = new Set(getActiveSessions(bundled, now).map((s) => s.id));
		const next = getNextSessions(bundled, now);
		for (const s of next.values()) expect(active.has(s.id), s.id).toBe(false);
		expect(next.get('Peugeot Arena')?.id).toMatch(/^175-days-human-stories/);
	});
});

describe('getEventBounds', () => {
	it('uses the earliest start and latest end regardless of array order', () => {
		const shuffled = [sessions[2], sessions[3], sessions[0], sessions[1]];
		expect(getEventBounds(shuffled)).toEqual({
			start: at('09:00').getTime(),
			end: at('11:15').getTime()
		});
		expect(getEventBounds([])).toBeNull();
	});

	it('spans the bundled event until 19:00, not the last array element', () => {
		expect(getEventBounds(bundled)).toEqual({
			start: new Date('2026-06-13T07:45:00+02:00').getTime(),
			end: new Date('2026-06-13T19:00:00+02:00').getTime()
		});
	});
});

describe('getColumnSpan', () => {
	const brk = (room: string, start: string, end: string): Session => ({
		...session('brk', room, start, end),
		type: 'break'
	});

	it('keeps a regular session in its own room column', () => {
		expect(getColumnSpan(sessions[2], sessions)).toEqual({ colStart: 4, colEnd: 5 });
	});

	it('spreads a break over the adjacent free rooms and skips a busy one', () => {
		const all = [...sessions, session('arena', 'Peugeot Arena', '12:00', '13:00')];
		expect(getColumnSpan(brk('Peugeot Arena', '12:00', '13:10'), all)).toEqual({
			colStart: 3,
			colEnd: 6
		});
		expect(getColumnSpan(brk('Sala 3', '09:30', '10:00'), all)).toEqual({
			colStart: 5,
			colEnd: 6
		});
	});

	it('falls back to its own room when every room is busy', () => {
		const busy = ROOMS.map((r, k) => session(`s${k}`, r, '09:00', '10:00'));
		expect(getColumnSpan(brk('Sala 1', '09:00', '10:00'), busy)).toEqual({
			colStart: 3,
			colEnd: 4
		});
	});
});

describe('getNowPosition', () => {
	const b = getMasterBoundaries(sessions); // 09:00 09:30 09:45 10:30 11:15

	it('is the row of the containing interval plus the fraction through it', () => {
		expect(getNowPosition(at('09:00'), sessions)).toEqual({ row: boundaryRow(0), fraction: 0 });
		expect(getNowPosition(at('09:15'), sessions)).toEqual({ row: boundaryRow(0), fraction: 0.5 });
		// 09:45 starts interval 2 exactly, even though it is 45/135 of the way in minutes
		expect(getNowPosition(at('09:45'), sessions)).toEqual({ row: boundaryRow(2), fraction: 0 });
		expect(getNowPosition(at('10:00'), sessions)).toEqual({
			row: boundaryRow(2),
			fraction: 1 / 3
		});
		expect(getNowPosition(at('11:00'), sessions)?.row).toBe(boundaryRow(b.length - 2));
	});

	it('lines up with the card rows from getRowSpan', () => {
		for (const s of sessions) {
			expect(getNowPosition(new Date(s.startTime), sessions)?.row).toBe(getRowSpan(s, b).rowStart);
		}
	});

	it('returns null before the first start and from the last end on', () => {
		expect(getNowPosition(at('08:59'), sessions)).toBeNull();
		expect(getNowPosition(at('11:15'), sessions)).toBeNull();
		expect(getNowPosition(at('12:00'), sessions)).toBeNull();
	});

	it('returns null on another date at the same time of day', () => {
		expect(getNowPosition(new Date('2027-01-01T10:00:00+02:00'), sessions)).toBeNull();
		expect(getNowPosition(new Date('2026-06-14T10:00:00+02:00'), sessions)).toBeNull();
	});

	it('uses the event instant, not the viewer timezone', () => {
		// 10:00 CEST written as UTC and as London time
		const expected = { row: boundaryRow(2), fraction: 1 / 3 };
		expect(getNowPosition(new Date('2026-06-13T08:00:00Z'), sessions)).toEqual(expected);
		expect(getNowPosition(new Date('2026-06-13T09:00:00+01:00'), sessions)).toEqual(expected);
	});

	it('returns null with fewer than two boundaries', () => {
		expect(getNowPosition(at('09:00'), [])).toBeNull();
	});
});

describe('formatting', () => {
	it('formats HH:MM and ranges from the ISO string', () => {
		expect(formatTime('2026-06-13T09:05:00+02:00')).toBe('09:05');
		expect(formatTimeRange('2026-06-13T09:05:00+02:00', '2026-06-13T10:15:00+02:00')).toBe(
			'09:05 – 10:15'
		);
	});

	it('shows the clock in event time (Europe/Bratislava), not UTC', () => {
		expect(formatClock(new Date('2026-06-13T10:20:00+02:00'))).toBe('10:20');
		expect(formatClock(new Date('2026-06-13T08:20:00Z'))).toBe('10:20');
		expect(formatClock(new Date('2026-06-12T22:05:00Z'))).toBe('00:05');
		// CET in winter
		expect(formatClock(new Date('2027-01-01T09:20:00Z'))).toBe('10:20');
	});

	it('formats 45, 60 and 90 minutes', () => {
		const d = (start: string, end: string) =>
			formatDuration(`2026-06-13T${start}:00+02:00`, `2026-06-13T${end}:00+02:00`);
		expect(d('09:00', '09:45')).toBe('45 min');
		expect(d('09:00', '10:00')).toBe('1h');
		expect(d('09:00', '10:30')).toBe('1h 30min');
	});

	it('computes duration across offsets as real elapsed minutes', () => {
		expect(getDurationMinutes('2026-06-13T09:00:00+02:00', '2026-06-13T08:30:00Z')).toBe(90);
	});
});
