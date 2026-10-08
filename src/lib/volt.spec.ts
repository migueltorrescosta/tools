import { describe, it, expect } from 'vitest';
import electedOfficials from '$lib/data/elected_officials.json';
import {
	barGeometry,
	computeStats,
	EU_FLAG,
	filterGroups,
	groupByCountry,
	isMep,
	parseDate,
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
		const { total, meps, ...perCountry } = computeStats(officials);
		expect(total).toBe(officials.length);
		expect(meps).toBe(5);
		expect(Object.values(perCountry).reduce((a, b) => a + b, 0)).toBe(total);
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
