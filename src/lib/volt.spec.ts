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
		expect(t.minYear).toBe(2019);
		expect(Math.floor(t.maxYear)).toBe(2032);
	});

	it('places a bar within the timeline', () => {
		const t = { minYear: 2019, maxYear: 2032, yearRange: 14 };
		const { left, width } = barGeometry(person({ startDate: '16/07/2024', endDate: '2029' }), t);
		expect(left).toBeGreaterThanOrEqual(0);
		expect(left + width).toBeLessThanOrEqual(100);
	});
});
