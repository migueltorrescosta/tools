import { describe, it, expect } from 'vitest';
import holidaysData from './data/events/public-holidays.json';
import {
	COUNTRY_HOLIDAYS,
	addDays,
	formatCalendarDate,
	generateHolidays,
	orthodoxEaster,
	westernEaster,
	weekday
} from './holidays';
import type { TimelineEvent } from './timelines';

const holidays = holidaysData as TimelineEvent[];

function dateOf(country: string, name: string, year: number): string[] {
	return holidays
		.filter(
			(e) =>
				e.date.startsWith(`${year}-`) &&
				e.title.startsWith(`${country}: `) &&
				e.title
					.slice(country.length + 2)
					.split(' / ')
					.includes(name)
		)
		.map((e) => e.date);
}

describe('westernEaster', () => {
	it.each([
		[2019, '2019-04-21'],
		[2024, '2024-03-31'],
		[2025, '2025-04-20'],
		[2026, '2026-04-05'],
		[2027, '2027-03-28'],
		[2028, '2028-04-16'],
		[2029, '2029-04-01'],
		[2038, '2038-04-25'],
		[2285, '2285-03-22']
	])('%i -> %s', (year, expected) => {
		expect(formatCalendarDate(westernEaster(year))).toBe(expected);
	});

	it('always falls on a Sunday between 22 March and 25 April', () => {
		for (let year = 1900; year <= 2100; year++) {
			const easter = westernEaster(year);
			expect(weekday(easter)).toBe(0);
			const md = easter[1] * 100 + easter[2];
			expect(md >= 322 && md <= 425).toBe(true);
		}
	});
});

describe('orthodoxEaster', () => {
	it.each([
		[2024, '2024-05-05'],
		[2025, '2025-04-20'],
		[2026, '2026-04-12'],
		[2027, '2027-05-02'],
		[2028, '2028-04-16'],
		[2029, '2029-04-08']
	])('%i -> %s', (year, expected) => {
		expect(formatCalendarDate(orthodoxEaster(year))).toBe(expected);
	});

	it('is a Sunday never before Western Easter', () => {
		for (let year = 1900; year <= 2099; year++) {
			const o = orthodoxEaster(year);
			expect(weekday(o)).toBe(0);
			expect(formatCalendarDate(o) >= formatCalendarDate(westernEaster(year))).toBe(true);
		}
	});

	it('rejects years outside the 13-day Julian offset range', () => {
		expect(() => orthodoxEaster(2100)).toThrow(RangeError);
	});
});

describe('addDays', () => {
	it('crosses month and leap-year boundaries', () => {
		expect(formatCalendarDate(addDays([2028, 2, 28], 1))).toBe('2028-02-29');
		expect(formatCalendarDate(addDays([2027, 2, 28], 1))).toBe('2027-03-01');
		expect(formatCalendarDate(addDays([2026, 1, 1], -1))).toBe('2025-12-31');
	});
});

describe('public-holidays.json', () => {
	it('is exactly the generated output for 2026-2029', () => {
		expect(holidays).toEqual(generateHolidays(2026, 2029));
	});

	it('covers all 27 EU member states every year', () => {
		expect(COUNTRY_HOLIDAYS).toHaveLength(27);
		for (const year of [2026, 2027, 2028, 2029]) {
			const flags = new Set(
				holidays.filter((e) => e.date.startsWith(`${year}-`)).map((e) => e.emoji)
			);
			expect(flags.size).toBe(27);
		}
	});

	it('lists shared holidays under every country that keeps them', () => {
		const christmas = holidays.filter(
			(e) => e.date === '2026-12-25' && e.title.endsWith('Christmas Day')
		);
		expect(christmas).toHaveLength(27);
	});

	it('has no duplicate (emoji, date) pairs', () => {
		const keys = holidays.map((e) => `${e.emoji} ${e.date}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('names the country in every title', () => {
		for (const e of holidays) {
			const country = COUNTRY_HOLIDAYS.find((c) => c.emoji === e.emoji)!.country;
			expect(e.title.startsWith(`${country}: `)).toBe(true);
		}
	});

	it('places Easter-relative holidays at the computed offsets', () => {
		for (const year of [2026, 2027, 2028, 2029]) {
			const e = (offset: number) => formatCalendarDate(addDays(westernEaster(year), offset));
			const o = (offset: number) => formatCalendarDate(addDays(orthodoxEaster(year), offset));
			expect(dateOf('Denmark', 'Maundy Thursday', year)).toEqual([e(-3)]);
			expect(dateOf('Germany', 'Good Friday', year)).toEqual([e(-2)]);
			expect(dateOf('Austria', 'Easter Monday', year)).toEqual([e(1)]);
			expect(dateOf('Austria', 'Ascension Day', year)).toEqual([e(39)]);
			expect(dateOf('Austria', 'Whit Monday', year)).toEqual([e(50)]);
			expect(dateOf('Austria', 'Corpus Christi', year)).toEqual([e(60)]);
			expect(dateOf('Greece', 'Clean Monday', year)).toEqual([o(-48)]);
			expect(dateOf('Greece', 'Orthodox Good Friday', year)).toEqual([o(-2)]);
			expect(dateOf('Cyprus', 'Kataklysmos', year)).toEqual([o(50)]);
		}
	});

	it('fixes the review findings for specific dates', () => {
		expect(dateOf('Austria', 'Ascension Day', 2026)).toEqual(['2026-05-14']);
		expect(dateOf('Austria', 'Corpus Christi', 2028)).toEqual(['2028-06-15']);
		expect(dateOf('Austria', 'Easter Monday', 2029)).toEqual(['2029-04-02']);
		expect(dateOf('Austria', 'Good Friday', 2026)).toEqual([]);
		expect(dateOf('Cyprus', 'Dormition of the Theotokos', 2026)).toEqual(['2026-08-15']);
		expect(dateOf('Netherlands', "King's Day", 2026)).toEqual(['2026-04-27']);
		expect(dateOf('Malta', 'Sette Giugno', 2027)).toEqual(['2027-06-07']);
		expect(dateOf('Bulgaria', 'Culture and Literacy Day', 2027)).toEqual(['2027-05-24']);
		expect(dateOf('Croatia', 'Statehood Day', 2026)).toEqual(['2026-05-30']);
		expect(dateOf('Ireland', 'May Bank Holiday', 2028)).toEqual(['2028-05-01']);
		expect(dateOf('Ireland', 'October Bank Holiday', 2029)).toEqual(['2029-10-29']);
		expect(dateOf('Finland', 'Midsummer Day', 2029)).toEqual(['2029-06-23']);
		expect(dateOf('Sweden', "All Saints' Day", 2026)).toEqual(['2026-10-31']);
		expect(dateOf('Ireland', "St. Brigid's Day", 2029)).toEqual(['2029-02-05']);
		expect(holidays.filter((e) => e.emoji === '🇨🇿' && e.date === '2027-05-08')).toHaveLength(1);
	});
});
