import { describe, it, expect } from 'vitest';
import holidaysData from './data/events/public-holidays.json';
import {
	COUNTRY_HOLIDAYS,
	DE_FACTO_MARKER,
	addDays,
	appliesIn,
	formatCalendarDate,
	generateHolidays,
	holidayLabel,
	orthodoxEaster,
	westernEaster,
	weekday
} from './holidays';
import type { TimelineEvent } from './timelines';

const holidays = holidaysData as TimelineEvent[];

const YEARS = [2026, 2027, 2028, 2029];

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

describe('holiday validity ranges', () => {
	it('treats validFrom and validTo as inclusive years', () => {
		expect(appliesIn(undefined, 1900)).toBe(true);
		expect(appliesIn({ validFrom: 2026 }, 2025)).toBe(false);
		expect(appliesIn({ validFrom: 2026 }, 2026)).toBe(true);
		expect(appliesIn({ validTo: 2023 }, 2023)).toBe(true);
		expect(appliesIn({ validTo: 2023 }, 2024)).toBe(false);
	});

	it('emits a ranged holiday only inside its range', () => {
		const prayer = (from: number, to: number) =>
			generateHolidays(from, to).filter((e) => e.title === 'Denmark: Great Prayer Day');
		expect(prayer(2023, 2023).map((e) => e.date)).toEqual(['2023-05-05']);
		expect(prayer(2024, 2029)).toEqual([]);
		const francis = generateHolidays(2025, 2026).filter((e) => e.title.includes('St. Francis'));
		expect(francis.map((e) => e.date)).toEqual(['2026-10-04']);
		const austria = generateHolidays(2018, 2019).filter((e) => e.title === 'Austria: Good Friday');
		expect(austria.map((e) => e.date)).toEqual(['2018-03-30']);
	});

	it('applies recent statutory changes in the published years', () => {
		for (const year of YEARS) {
			expect(dateOf('Denmark', 'Great Prayer Day', year)).toEqual([]);
			expect(dateOf('Italy', "St. Francis of Assisi's Day", year)).toEqual([`${year}-10-04`]);
			expect(dateOf('Poland', 'Christmas Eve', year)).toEqual([`${year}-12-24`]);
			expect(dateOf('Slovakia', 'Constitution Day', year)).toEqual([]);
			expect(dateOf('Slovakia', 'Struggle for Freedom and Democracy Day', year)).toEqual([]);
			const suspended = year === 2026;
			expect(dateOf('Slovakia', 'Victory over Fascism Day', year)).toEqual(
				suspended ? [] : [`${year}-05-08`]
			);
			expect(dateOf('Slovakia', 'Our Lady of Sorrows', year)).toEqual(
				suspended ? [] : [`${year}-09-15`]
			);
		}
	});
});

describe('de facto holidays', () => {
	const entries = COUNTRY_HOLIDAYS.flatMap((c) =>
		c.holidays.map((h) => ({ country: c.country, entry: h }))
	);

	it('marks every de facto day and no statutory one', () => {
		for (const { entry } of entries) {
			expect(holidayLabel(entry).endsWith(DE_FACTO_MARKER)).toBe(entry[2]?.deFacto === true);
		}
		for (const e of holidays) {
			const country = COUNTRY_HOLIDAYS.find((c) => c.emoji === e.emoji)!.country;
			for (const label of e.title.slice(country.length + 2).split(' / ')) {
				const entry = entries.find((x) => x.country === country && holidayLabel(x.entry) === label);
				expect(entry, `${e.title}`).toBeDefined();
			}
			const hasDeFacto = e.title.includes(DE_FACTO_MARKER);
			expect(/customary|collective agreements/.test(e.description)).toBe(hasDeFacto);
		}
	});

	it('includes the customary days on the right dates', () => {
		const marked = (name: string) => name + DE_FACTO_MARKER;
		expect(dateOf('Sweden', marked('Midsummer Eve'), 2026)).toEqual(['2026-06-19']);
		expect(dateOf('Finland', marked('Midsummer Eve'), 2029)).toEqual(['2029-06-22']);
		expect(dateOf('Sweden', marked('Christmas Eve'), 2026)).toEqual(['2026-12-24']);
		expect(dateOf('Finland', marked('Christmas Eve'), 2026)).toEqual(['2026-12-24']);
		expect(dateOf('Sweden', marked("New Year's Eve"), 2026)).toEqual(['2026-12-31']);
		expect(dateOf('Netherlands', marked('Liberation Day'), 2026)).toEqual(['2026-05-05']);
		expect(dateOf('Netherlands', 'Liberation Day', 2026)).toEqual([]);
		expect(dateOf('Cyprus', marked('Orthodox Holy Saturday'), 2026)).toEqual(['2026-04-11']);
		expect(dateOf('Cyprus', marked('Orthodox Easter Tuesday'), 2027)).toEqual(['2027-05-04']);
		expect(dateOf('Cyprus', marked('Christmas Eve'), 2028)).toEqual(['2028-12-24']);
	});

	it('does not duplicate a statutory day as de facto', () => {
		const keys = entries.map(({ country, entry }) => `${country} ${entry[0]}`);
		for (const { country, entry } of entries) {
			if (!entry[2]?.deFacto) continue;
			expect(keys.filter((k) => k === `${country} ${entry[0]}`)).toHaveLength(1);
		}
	});
});

describe('Sunday-only statutory feasts', () => {
	const westernEasterCountries = [
		'Croatia',
		'Denmark',
		'Estonia',
		'Finland',
		'Hungary',
		'Latvia',
		'Lithuania',
		'Poland',
		'Portugal',
		'Slovenia',
		'Sweden'
	];
	const westernPentecostCountries = [
		'Denmark',
		'Estonia',
		'Finland',
		'Hungary',
		'Latvia',
		'Poland',
		'Slovenia',
		'Sweden'
	];
	const orthodoxEasterCountries = ['Bulgaria', 'Cyprus', 'Romania'];
	const without = ['Germany', 'Greece', 'Italy', 'Netherlands', 'Austria', 'Spain', 'France'];

	it('places Easter Sunday per country by its computus', () => {
		for (const year of YEARS) {
			const w = formatCalendarDate(westernEaster(year));
			const o = formatCalendarDate(orthodoxEaster(year));
			for (const c of westernEasterCountries) expect(dateOf(c, 'Easter Sunday', year)).toEqual([w]);
			for (const c of orthodoxEasterCountries)
				expect(dateOf(c, 'Orthodox Easter Sunday', year)).toEqual([o]);
			for (const c of without) {
				expect(dateOf(c, 'Easter Sunday', year)).toEqual([]);
				expect(dateOf(c, 'Orthodox Easter Sunday', year)).toEqual([]);
			}
		}
		expect(dateOf('Bulgaria', 'Orthodox Easter Sunday', 2027)).toEqual(['2027-05-02']);
		expect(dateOf('Poland', 'Easter Sunday', 2027)).toEqual(['2027-03-28']);
	});

	it('places Pentecost Sunday 49 days after Easter', () => {
		for (const year of YEARS) {
			const w = formatCalendarDate(addDays(westernEaster(year), 49));
			for (const c of westernPentecostCountries)
				expect(dateOf(c, 'Pentecost Sunday', year)).toEqual([w]);
			expect(dateOf('Romania', 'Orthodox Pentecost Sunday', year)).toEqual([
				formatCalendarDate(addDays(orthodoxEaster(year), 49))
			]);
			for (const c of [...without, 'Croatia', 'Lithuania', 'Portugal'])
				expect(dateOf(c, 'Pentecost Sunday', year)).toEqual([]);
		}
	});

	it('only adds them on Sundays', () => {
		for (const e of holidays.filter((e) => /(Easter|Pentecost) Sunday/.test(e.title))) {
			const [y, m, d] = e.date.split('-').map(Number);
			expect(weekday([y, m, d])).toBe(0);
		}
	});
});
