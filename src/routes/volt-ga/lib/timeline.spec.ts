import { describe, it, expect } from 'vitest';
import {
	formatDuration,
	formatTime,
	formatTimeRange,
	boundaryRow,
	getRowSpan,
	getActiveSessions,
	getDurationMinutes,
	getMasterBoundaries,
	getNextSessions,
	getNowOffset,
	type Session
} from './timeline';

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
		moderator: null,
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
	it('picks the earliest not-yet-ended session per room', () => {
		const next = getNextSessions(sessions, at('08:00'));
		expect(next.get('Sala 1')?.id).toBe('a');
		expect(next.get('Sala 2')?.id).toBe('c');
	});

	it('drops rooms whose sessions have all ended', () => {
		const next = getNextSessions(sessions, at('11:15'));
		expect(next.size).toBe(0);
	});

	it.todo('excludes the session already running (mg-drp8.128)');
});

describe('getNowOffset', () => {
	const b = ['09:00', '10:00', '11:00'];

	it('clamps before the first and after the last boundary', () => {
		expect(getNowOffset(at('08:00'), b)).toBe(0);
		expect(getNowOffset(at('12:00'), b)).toBe(1);
	});

	it('returns 0 for fewer than two boundaries', () => {
		expect(getNowOffset(at('09:30'), ['09:00'])).toBe(0);
	});

	it.todo('follows the row layout, event timezone and date (mg-drp8.127)');
});

describe('formatting', () => {
	it('formats HH:MM and ranges from the ISO string', () => {
		expect(formatTime('2026-06-13T09:05:00+02:00')).toBe('09:05');
		expect(formatTimeRange('2026-06-13T09:05:00+02:00', '2026-06-13T10:15:00+02:00')).toBe(
			'09:05 – 10:15'
		);
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
