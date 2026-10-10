import { describe, it, expect } from 'vitest';
import electedOfficials from '$lib/data/elected_officials.json';
import {
	BAR_TEXT_COLOR,
	barGeometry,
	computeStats,
	contrastRatio,
	COUNTRIES,
	countryColor,
	countryLabel,
	DATA_AS_OF,
	describeMandate,
	EU_FLAG,
	FALLBACK_COLOR,
	filterGroups,
	fractionalYear,
	groupByCountry,
	isFormer,
	isGroupEntry,
	isMep,
	parseDate,
	summaryBars,
	timelinePercent,
	timelineRange,
	type Politician
} from './volt';

const officials: Politician[] = electedOfficials;

function person(overrides: Partial<Politician>): Politician {
	return {
		name: 'Test Person',
		startDate: '2024',
		endDate: '2029',
		position: 'Stadtrat',
		location: 'Köln',
		country: '🇩🇪',
		url: 'https://example.org',
		...overrides
	};
}

describe('parseDate', () => {
	it('reads the year from YYYY, MM/YYYY and DD/MM/YYYY', () => {
		expect(Math.floor(parseDate('2029'))).toBe(2029);
		expect(Math.floor(parseDate('10/2023'))).toBe(2023);
		expect(Math.floor(parseDate('16/07/2024'))).toBe(2024);
	});

	it('keeps month and day precision as a fractional year', () => {
		expect(parseDate('2029')).toBe(2029);
		expect(parseDate('03/2026')).toBeCloseTo(2026 + 2 / 12, 6);
		expect(parseDate('16/07/2024')).toBeCloseTo(2024.541, 3);
		expect(parseDate('02/07/2019')).toBeGreaterThan(2019.5);
	});

	it.each(['present', '', '2029-07-15', '15.07.2029', '7/2029', '13/2029', '32/01/2029', '29'])(
		'rejects malformed date %j instead of returning NaN or a bogus year',
		(s) => {
			expect(() => parseDate(s)).toThrow(/Invalid date/);
		}
	);
});

describe('groupByCountry', () => {
	it('groups by country then location, latest start first', () => {
		const groups = groupByCountry([
			person({ name: 'A', location: 'Bonn', startDate: '2020' }),
			person({ name: 'B', location: 'Köln', startDate: '2025' }),
			person({ name: 'C', location: 'Bonn', startDate: '2021' }),
			person({ name: 'D', country: '🇳🇱', location: 'Delft' })
		]);
		expect(Object.keys(groups).sort()).toEqual(['🇩🇪', '🇳🇱'].sort());
		expect(groups['🇩🇪'].map((g) => g.location)).toEqual(['Köln', 'Bonn']);
		expect(groups['🇩🇪'][1].politicians.map((p) => p.name)).toEqual(['A', 'C']);
	});
});

describe('filterGroups', () => {
	it('returns exactly the European Parliament members for the EU filter', () => {
		const result = filterGroups(officials, EU_FLAG);
		expect(Object.keys(result)).toEqual([EU_FLAG]);
		const meps = result[EU_FLAG].flatMap((g) => g.politicians);
		expect(meps).toHaveLength(5);
		expect(meps.every(isMep)).toBe(true);
		expect(meps.every((p) => p.location === 'European Parliament')).toBe(true);
	});

	it('returns an empty list for a country with no entries instead of undefined', () => {
		expect(() => filterGroups(officials, '🇧🇪')).not.toThrow();
		expect(filterGroups(officials, '🇧🇪')).toEqual({ '🇧🇪': [] });
	});

	it('returns only the chosen country', () => {
		const result = filterGroups(officials, '🇩🇪');
		expect(Object.keys(result)).toEqual(['🇩🇪']);
		const people = result['🇩🇪'].flatMap((g) => g.politicians);
		expect(people.length).toBe(officials.filter((p) => p.country === '🇩🇪').length);
	});

	it('returns every country for all', () => {
		const all = Object.values(filterGroups(officials, 'all')).flatMap((gs) =>
			gs.flatMap((g) => g.politicians)
		);
		expect(all).toHaveLength(officials.length);
	});
});

describe('computeStats', () => {
	it('per-country counts sum to the total', () => {
		const { total, meps, byCountry } = computeStats(officials);
		expect(meps).toBe(5);
		expect(Object.values(byCountry).reduce((a, b) => a + b, 0)).toBe(total);
	});

	it('counts named people only, not council group placeholder rows', () => {
		const stats = computeStats(officials);
		const groups = officials.filter(isGroupEntry);
		expect(stats.groupEntries).toBe(groups.length);
		expect(stats.total).toBe(officials.length - groups.length);
		expect(stats.byCountry['🇷🇴']).toBe(2);
	});

	it('counts a country outside the known list and keeps it filterable', () => {
		const data = [person({}), person({ name: 'B', country: '🇧🇪', location: 'Brussels' })];
		const stats = computeStats(data);
		expect(stats.byCountry).toEqual({ '🇩🇪': 1, '🇧🇪': 1 });
		const bars = summaryBars(stats);
		expect(bars.map((b) => b.filter)).toContain('🇧🇪');
		expect(filterGroups(data, '🇧🇪')['🇧🇪']).toHaveLength(1);
	});
});

describe('summaryBars', () => {
	const bars = summaryBars(computeStats(officials));

	it('has All first, MEPs last and one bar per country in the data, sorted by label', () => {
		expect(bars[0].filter).toBe('all');
		expect(bars.at(-1)?.filter).toBe(EU_FLAG);
		const countries = bars.slice(1, -1);
		expect(new Set(countries.map((b) => b.filter))).toEqual(
			new Set(officials.map((p) => p.country))
		);
		const labels = countries.map((b) => b.label);
		expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
	});

	it('country bars sum to the All bar', () => {
		const countries = bars.slice(1, -1);
		expect(countries.reduce((a, b) => a + b.count, 0)).toBe(bars[0].count);
	});

	it('never offers a country filter with no rows', () => {
		for (const bar of bars.slice(1, -1)) {
			expect(filterGroups(officials, bar.filter)[bar.filter].length).toBeGreaterThan(0);
		}
	});
});

describe('countries', () => {
	it('labels known flags and falls back to the flag for unknown ones', () => {
		expect(countryLabel('🇩🇪')).toBe('Germany');
		expect(countryLabel('🇧🇪')).toBe('🇧🇪');
		expect(countryColor('🇧🇪')).toBe(FALLBACK_COLOR);
	});

	it.each([
		...Object.entries(COUNTRIES).map(([f, c]) => [c.label, c.color]),
		['fallback', FALLBACK_COLOR]
	])('%s bar colour meets WCAG AA (4.5:1) against the bar text', (_, color) => {
		expect(contrastRatio(color, BAR_TEXT_COLOR)).toBeGreaterThanOrEqual(4.5);
	});

	it('computes known contrast ratios', () => {
		expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
		expect(contrastRatio('#3366CC', '#000000')).toBeCloseTo(3.91, 2);
	});
});

describe('current and former mandates', () => {
	const asOf = parseDate(DATA_AS_OF);

	it('treats a mandate as former once its exclusive end date has passed', () => {
		expect(isFormer(person({ endDate: '2025' }), 2025)).toBe(true);
		expect(isFormer(person({ endDate: '2029' }), 2026.5)).toBe(false);
	});

	it('flags the ended Portuguese and Cypriot mandates as former as of the data date', () => {
		const former = officials.filter((p) => isFormer(p, asOf)).map((p) => p.name);
		expect(former).toContain('Inês Santos');
		expect(former).toContain('Alexandra Attalides');
		expect(former).not.toContain('Laurens Dassen');
	});

	it('has no mandate starting after the data date', () => {
		for (const p of officials) expect(parseDate(p.startDate), p.name).toBeLessThanOrEqual(asOf);
	});

	it('describes a mandate with its dates for tooltips and screen readers', () => {
		const p = person({ name: 'A', startDate: '16/07/2024', endDate: '2029' });
		expect(describeMandate(p, 2026)).toBe('A, Stadtrat, Köln: 16/07/2024 to 2029');
		expect(describeMandate(p, 2030)).toMatch(/\(former\)$/);
	});

	it('converts a calendar date to a fractional year on the parseDate scale', () => {
		expect(fractionalYear(new Date(2024, 6, 16))).toBeCloseTo(parseDate('16/07/2024'), 9);
	});

	it('places today on the timeline, or nowhere if outside it', () => {
		const t = { minYear: 2019, maxYear: 2032, yearRange: 14 };
		expect(timelinePercent(2026, t)).toBeCloseTo(50, 6);
		expect(timelinePercent(2040, t)).toBeNull();
		expect(timelinePercent(2010, t)).toBeNull();
	});
});

describe('data quality', () => {
	it('detects council group placeholder rows by name', () => {
		expect(isGroupEntry(person({ name: 'Volt Giroc candidates' }))).toBe(true);
		expect(isGroupEntry(person({ name: 'Volt Mantova' }))).toBe(true);
		expect(isGroupEntry(person({ name: 'Marian State' }))).toBe(false);
	});

	// Shared links accepted so far: Köln's is the council group's own team page. Adding new ones fails.
	const KNOWN_SHARED_URLS = ['https://voltkoeln.de/team'];

	it('does not let more than 3 rows share a link beyond the known list', () => {
		const counts = new Map<string, number>();
		for (const p of officials) counts.set(p.url, (counts.get(p.url) ?? 0) + 1);
		const shared = [...counts].filter(([, n]) => n > 3).map(([url]) => url);
		expect(shared.sort()).toEqual([...KNOWN_SHARED_URLS].sort());
	});
});

describe('timeline geometry', () => {
	it('spans the earliest start to the latest end', () => {
		const t = timelineRange([
			person({ startDate: '02/07/2019', endDate: '2029' }),
			person({ startDate: '03/2026', endDate: '2032' })
		]);
		expect(t).toEqual({ minYear: 2019, maxYear: 2032, yearRange: 14 });
	});

	it('places a bar within the timeline', () => {
		const t = { minYear: 2019, maxYear: 2032, yearRange: 14 };
		const { left, width } = barGeometry(person({ startDate: '16/07/2024', endDate: '2029' }), t);
		expect(left).toBeGreaterThanOrEqual(0);
		expect(left + width).toBeLessThanOrEqual(100);
	});

	it('draws a 16/07/2024 to 2029 mandate as ~4.46 years, not 6', () => {
		const t = { minYear: 2019, maxYear: 2032, yearRange: 14 };
		const { left, width } = barGeometry(person({ startDate: '16/07/2024', endDate: '2029' }), t);
		expect((width / 100) * t.yearRange).toBeCloseTo(4.459, 2);
		expect((left / 100) * t.yearRange).toBeCloseTo(5.541, 2);
	});

	it('draws 03/2026 to 2032 as 5.83 years and 2022 to 2026 as 4 years', () => {
		const t = { minYear: 2019, maxYear: 2032, yearRange: 14 };
		const years = (s: string, e: string) =>
			(barGeometry(person({ startDate: s, endDate: e }), t).width / 100) * t.yearRange;
		expect(years('03/2026', '2032')).toBeCloseTo(6 - 2 / 12, 6);
		expect(years('2022', '2026')).toBeCloseTo(4, 6);
	});
});
