import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	buildDataset,
	buildFxTable,
	formatFiled,
	quarterOfPeriodEnd,
	roundSignificant,
	type SourceCompany,
	type SourceFx
} from '$lib/company-trends/build';
import { validateDataset } from '$lib/company-trends/schema';
import bundled from './data/companies.json';

const SOURCES = 'src/routes/company-trends/data/sources';

function readSources(): { fx: SourceFx; companies: SourceCompany[] } {
	const fx = JSON.parse(readFileSync(join(SOURCES, 'fx.json'), 'utf8')) as SourceFx;
	const companies = readdirSync(join(SOURCES, 'companies'))
		.sort()
		.map((f) => JSON.parse(readFileSync(join(SOURCES, 'companies', f), 'utf8')) as SourceCompany);
	return { fx, companies };
}

describe('quarterOfPeriodEnd', () => {
	it.each([
		['2025-09-27', '2025Q3'],
		['2024-12-28', '2024Q4'],
		['2024-12-31', '2024Q4'],
		['2000-01-02', '1999Q4'],
		['2000-01-30', '2000Q1'],
		['2023-07-05', '2023Q2'],
		['2023-07-08', '2023Q3']
	])('places a fiscal year ending %s in %s', (iso, quarter) => {
		expect(quarterOfPeriodEnd(iso)).toBe(quarter);
	});

	it('rejects a malformed date', () => {
		expect(() => quarterOfPeriodEnd('2024-13-40')).toThrow(/2024-13-40/);
	});
});

describe('roundSignificant', () => {
	it('keeps six significant digits across magnitudes', () => {
		expect(roundSignificant(0.0738291, 6)).toBe(0.0738291);
		expect(roundSignificant(0.07382915, 6)).toBe(0.0738292);
		expect(roundSignificant(123456.78, 6)).toBe(123457);
		expect(roundSignificant(-79.93349, 6)).toBe(-79.9335);
		expect(roundSignificant(0, 6)).toBe(0);
	});
});

describe('formatFiled', () => {
	it('groups thousands and keeps every filed decimal', () => {
		expect(formatFiled(18796)).toBe('18,796');
		expect(formatFiled(0.073)).toBe('0.073');
		expect(formatFiled(-1234567.891)).toBe('-1,234,567.891');
	});
});

describe('buildDataset', () => {
	const fx: SourceFx = {
		rates: {
			'2006Q2': { USD: 1.0, GBP: 0.5 },
			'2006Q3': { USD: 1.2, GBP: 0.6 },
			'2006Q4': { USD: 1.4, GBP: 0.7 },
			'2007Q1': { USD: 1.6, GBP: 0.8 }
		}
	};
	const source = (anchors: SourceCompany['anchors']): SourceCompany => ({
		id: 'x',
		name: 'X',
		type: 'tech',
		reportingCurrency: 'USD',
		country: 'US',
		anchors
	});
	const anchor = (periodEnd: string, revenue: number, operatingIncome: number) => ({
		periodEnd,
		currency: 'USD' as const,
		revenue,
		operatingIncome,
		quality: 'reported' as const,
		source: 'Form 10-K'
	});

	it('converts with the fiscal-year mean rate and preserves the filed margin', () => {
		// Tesla FY2007: revenue 0.073, operating loss 79.933 (margin about -1095x)
		const out = buildDataset(fx, [source([anchor('2007-03-31', 0.073, -79.933)])], {
			generated: '2026-01-01'
		});
		const p = out.companies[0].points[0];
		expect(p.quarter).toBe('2007Q1');
		expect(p.revenue).toBeCloseTo(0.073 / 1.3, 6);
		expect((p.operatingIncome as number) / (p.revenue as number)).toBeCloseTo(-79.933 / 0.073, 2);
		expect(p.source).toBe(
			'Form 10-K (FY ending 2007-03-31: revenue USD 0.073m, operating income USD -79.933m)'
		);
	});

	it('drops anchors after untilYear and companies left without points', () => {
		const out = buildDataset(fx, [source([anchor('2007-03-31', 10, 1)])], {
			untilYear: 2006,
			generated: '2026-01-01'
		});
		expect(out.companies).toEqual([]);
	});

	it('rejects a missing or non-integer untilYear instead of keeping every anchor', () => {
		// `--until` with no value or a typo reaches buildDataset as Number(...) = NaN
		for (const untilYear of [Number.NaN, Number('20x5'), 2020.5]) {
			expect(() =>
				buildDataset(fx, [source([anchor('2007-03-31', 10, 1)])], {
					untilYear,
					generated: '2026-01-01'
				})
			).toThrow(/untilYear/);
		}
	});

	it('throws when the fiscal year lacks a rate instead of averaging fewer quarters', () => {
		expect(() =>
			buildDataset(fx, [source([anchor('2006-12-31', 10, 1)])], { generated: '2026-01-01' })
		).toThrow(/2006Q1/);
	});

	it('rounds output rates to five decimals', () => {
		expect(buildFxTable({ rates: { '2000Q1': { USD: 0.9864523077, GBP: 0.61442 } } })).toEqual({
			base: 'EUR',
			rates: { '2000Q1': { USD: 0.98645, GBP: 0.61442 } }
		});
	});
});

describe('companies.json', () => {
	it('matches a rebuild from the sources', () => {
		const { fx, companies } = readSources();
		const rebuilt = buildDataset(fx, companies, { generated: bundled.meta.generated });
		expect(JSON.parse(JSON.stringify(rebuilt))).toEqual(bundled);
	});

	it('is a valid dataset whose points all start in 2000 or later', () => {
		expect(validateDataset(bundled)).toEqual([]);
		for (const c of bundled.companies) {
			for (const p of c.points) expect(Number(p.quarter.slice(0, 4))).toBeGreaterThanOrEqual(2000);
		}
	});
});
