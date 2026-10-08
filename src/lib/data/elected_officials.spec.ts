import { describe, it, expect } from 'vitest';
import electedOfficials from './elected_officials.json';
import { COUNTRY_COLORS, parseDate, type Politician } from '$lib/volt';

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
