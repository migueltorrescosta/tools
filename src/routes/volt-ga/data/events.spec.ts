import { describe, it, expect } from 'vitest';
import events from './events.json';
import { getColumnSpan, isVenueWide, ROOM_COLORS, ROOMS, type Session } from '../lib/timeline';

const sessions = events as Session[];
const ms = (iso: string) => new Date(iso).getTime();

describe('volt-ga events.json', () => {
	it('has unique ids', () => {
		const ids = sessions.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('has valid ISO times with start < end', () => {
		for (const s of sessions) {
			expect(Number.isNaN(ms(s.startTime)), s.id).toBe(false);
			expect(Number.isNaN(ms(s.endTime)), s.id).toBe(false);
			expect(ms(s.startTime), s.id).toBeLessThan(ms(s.endTime));
		}
	});

	it('only uses known rooms, each with a colour', () => {
		for (const s of sessions) {
			expect(ROOMS, s.id).toContain(s.room);
			expect(ROOM_COLORS[s.room], s.id).toBeDefined();
		}
	});

	it('has no same-room overlaps between room sessions', () => {
		const overlaps: string[] = [];
		for (const a of sessions) {
			for (const b of sessions) {
				if (a.id >= b.id || a.room !== b.room || isVenueWide(a) || isVenueWide(b)) continue;
				if (ms(a.startTime) < ms(b.endTime) && ms(b.startTime) < ms(a.endTime)) {
					overlaps.push(`${a.id}|${b.id}`);
				}
			}
		}
		expect(overlaps).toEqual([]);
	});

	it('renders no two cards into the same grid cells', () => {
		const overlaps: string[] = [];
		const cols = new Map(sessions.map((s) => [s.id, getColumnSpan(s, sessions)]));
		for (const a of sessions) {
			for (const b of sessions) {
				if (a.id >= b.id) continue;
				const ca = cols.get(a.id)!;
				const cb = cols.get(b.id)!;
				const sharesColumn = ca.colStart < cb.colEnd && cb.colStart < ca.colEnd;
				const sharesTime = ms(a.startTime) < ms(b.endTime) && ms(b.startTime) < ms(a.endTime);
				if (sharesColumn && sharesTime) overlaps.push(`${a.id}|${b.id}`);
			}
		}
		expect(overlaps).toEqual([]);
	});

	it('lays the lunch break across the rooms left free by the ecstatic dance', () => {
		const lunch = sessions.find((s) => s.id === 'lunch-block')!;
		expect(getColumnSpan(lunch, sessions)).toEqual({ colStart: 3, colEnd: 6 });
	});

	it('lists moderators as separate names', () => {
		for (const s of sessions) {
			expect(Array.isArray(s.moderators), s.id).toBe(true);
			for (const m of s.moderators) expect(m, s.id).toMatch(/^[^,]+$/);
		}
	});
});
