import { describe, it, expect } from 'vitest';
import electedOfficials from './elected_officials.json';
import { COUNTRY_COLORS, DATA_AS_OF, isFormer, parseDate, type Politician } from '$lib/volt';

const officials: Politician[] = electedOfficials;
const FIELDS = ['name', 'startDate', 'endDate', 'position', 'location', 'country', 'url'] as const;
const STRICT_DATE = /^(\d{2}\/)?(\d{2}\/)?\d{4}$/;

describe('elected_officials.json schema', () => {
	it('is a non-empty list', () => {
		expect(officials.length).toBeGreaterThan(0);
	});

	describe.each(officials.map((p, i) => [`#${i} ${p.name}`, p] as const))('%s', (_, p) => {
		it('has exactly the 7 fields, all non-empty strings', () => {
			expect(Object.keys(p).sort()).toEqual([...FIELDS].sort());
			for (const f of FIELDS) {
				expect(typeof p[f], f).toBe('string');
				expect(p[f].trim(), f).not.toBe('');
			}
		});

		it('has strictly formatted dates with end >= start', () => {
			expect(p.startDate).toMatch(STRICT_DATE);
			expect(p.endDate).toMatch(STRICT_DATE);
			expect(parseDate(p.endDate)).toBeGreaterThanOrEqual(parseDate(p.startDate));
		});

		it('links over https', () => {
			expect(p.url).toMatch(/^https:\/\//);
		});

		it('uses a country with a known colour', () => {
			expect(Object.keys(COUNTRY_COLORS)).toContain(p.country);
		});
	});
});

describe('Dutch municipal councillors', () => {
	const COUNCIL_POSITIONS = new Set(['Gemeenteraadslid', 'Fractievoorzitter']);
	const nlCouncil = officials.filter(
		(p) => p.country === '🇳🇱' && COUNCIL_POSITIONS.has(p.position)
	);
	const current = nlCouncil.filter((p) => !isFormer(p, parseDate(DATA_AS_OF)));

	// Kiesraad (GR20260318) credits Volt with 25 seats in 23 municipalities. Volt and the DNPP
	// count 26 in 24 by adding the joint Connect-Volt list's seat in Wageningen, which is not
	// a Volt list and whose holder sources disagree on; it is left out.
	it('holds the 25 Volt seats elected on 18 March 2026 in 23 municipalities', () => {
		const elected2026 = nlCouncil.filter((p) => p.startDate === '01/04/2026');
		expect(elected2026).toHaveLength(25);
		expect(new Set(elected2026.map((p) => p.location)).size).toBe(23);
		expect(current).toEqual(elected2026);
		for (const p of elected2026) expect(p.endDate, p.name).toBe('2030');
	});

	it('keeps the 15 councillors of 2022-2026 as former mandates', () => {
		const term2022 = nlCouncil.filter((p) => p.startDate === '2022');
		expect(term2022).toHaveLength(15);
		for (const p of term2022) expect(isFormer(p, parseDate(DATA_AS_OF)), p.name).toBe(true);
	});

	it('gives every councillor a distinct person-specific link', () => {
		const urls = nlCouncil.map((p) => p.url);
		expect(new Set(urls).size).toBe(urls.length);
	});
});

describe('duplicates', () => {
	it('has no two entries for the same person, office and start date', () => {
		const keys = officials.map((p) => [p.name, p.position, p.location, p.startDate].join('|'));
		const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
		expect(dupes).toEqual([]);
	});
});
