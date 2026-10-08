import { describe, it, expect } from 'vitest';
import events from './events.json';
import { ROOM_COLORS, ROOMS, type Session } from '../lib/timeline';

const sessions = events as Session[];
const ms = (iso: string) => new Date(iso).getTime();

// Known same-room overlaps tracked in mg-drp8.130. Remove the entry when the data is fixed.
const KNOWN_OVERLAPS = new Set(['lunch-block|mind-body-coherence-connecting-thru-ecstatic-dance']);

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

	it('has no same-room overlaps beyond the known ones', () => {
		const overlaps: string[] = [];
		for (const a of sessions) {
			for (const b of sessions) {
				if (a.id >= b.id || a.room !== b.room) continue;
				if (ms(a.startTime) < ms(b.endTime) && ms(b.startTime) < ms(a.endTime)) {
					overlaps.push(`${a.id}|${b.id}`);
				}
			}
		}
		expect(new Set(overlaps)).toEqual(KNOWN_OVERLAPS);
	});
});
