import { afterAll, describe, it, expect } from 'vitest';
import {
	buildTimelineRows,
	formatShortDate,
	getYear,
	isPast,
	localDateString,
	type TimelineEvent
} from './timelines';

// Node re-reads process.env.TZ on assignment, so each block runs in a real local zone.
const originalTz = process.env.TZ;
afterAll(() => {
	if (originalTz === undefined) delete process.env.TZ;
	else process.env.TZ = originalTz;
});

const zones = ['UTC', 'America/New_York', 'Pacific/Honolulu', 'Asia/Tokyo', 'Pacific/Kiritimati'];

describe.each(zones)('calendar dates in TZ=%s', (zone) => {
	const inZone = <T>(fn: () => T): T => {
		process.env.TZ = zone;
		return fn();
	};

	it('keeps New Year in its own year and day', () => {
		inZone(() => {
			expect(getYear('2026-01-01')).toBe(2026);
			expect(formatShortDate('2026-01-01')).toBe('01 Jan');
			expect(getYear('2025-12-31')).toBe(2025);
			expect(formatShortDate('2025-12-31')).toBe('31 Dec');
		});
	});

	it('groups Dec 31 and Jan 1 under their own years', () => {
		inZone(() => {
			const events: TimelineEvent[] = [
				{ id: 1, emoji: '🎆', date: '2025-12-31', title: 'Eve', description: '' },
				{ id: 2, emoji: '🎉', date: '2026-01-01', title: 'New Year', description: '' }
			];
			const years = buildTimelineRows(events, false).flatMap((r) =>
				r.type === 'year' ? [r.year] : []
			);
			expect(years).toEqual([2025, 2026]);
		});
	});

	it("does not mark today's events as past, early or late in the local day", () => {
		inZone(() => {
			for (const [h, m] of [
				[0, 30],
				[12, 0],
				[23, 30]
			]) {
				const now = new Date(2026, 5, 15, h, m);
				expect(localDateString(now)).toBe('2026-06-15');
				expect(isPast('2026-06-15', now)).toBe(false);
				expect(isPast('2026-06-14', now)).toBe(true);
				expect(isPast('2026-06-16', now)).toBe(false);
			}
		});
	});
});
