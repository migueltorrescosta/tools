import { describe, it, expect } from 'vitest';
import {
	loadDataset,
	validateDataset,
	type Company,
	type Dataset
} from '$lib/company-trends/schema';
import { convert, convertFromEur, convertToEur, type FxTable } from '$lib/company-trends/fx';
import {
	deriveExpenses,
	interpolateSeries,
	logInterp,
	quarterIndex,
	quarterLabel,
	quarterRange,
	type CompanyPoint
} from '$lib/company-trends/series';
import { companyTypes, filterCompanies, type FilterState } from '$lib/company-trends/filter';
import bundled from './data/companies.json';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fx: FxTable = {
	base: 'EUR',
	rates: { '2000Q1': { USD: 1.07, GBP: 0.62 } }
};

const reported = (
	quarter: string,
	revenue: number,
	operatingIncome: number,
	source = 'annual report'
): CompanyPoint => ({
	quarter,
	revenue,
	operatingIncome,
	quality: 'reported',
	source,
	sourceUrl: 'https://example.com/annual-report.pdf'
});

const validDataset: Dataset = {
	meta: {
		generated: '2026-10-06',
		units: 'EUR millions',
		fxMethodology: 'ECB quarterly average reference rates',
		fxSource: 'https://data.ecb.europa.eu/data/datasets/EXR'
	},
	fx: {
		base: 'EUR',
		rates: {
			'2000Q1': { USD: 1.07, GBP: 0.62 },
			'2000Q2': { USD: 1.08, GBP: 0.63 }
		}
	},
	companies: [
		{
			id: 'acme',
			name: 'Acme SE',
			type: 'software',
			reportingCurrency: 'EUR',
			country: 'DE',
			points: [reported('2000Q1', 100, 10), reported('2000Q2', 110, 12)]
		}
	]
};

const clone = (): Dataset => JSON.parse(JSON.stringify(validDataset)) as Dataset;

// ---------------------------------------------------------------------------
// Quarter helpers
// ---------------------------------------------------------------------------

describe('quarter helpers', () => {
	it('maps quarter labels to absolute indices', () => {
		expect(quarterIndex('2000Q1')).toBe(0);
		expect(quarterIndex('2000Q4')).toBe(3);
		expect(quarterIndex('2001Q1')).toBe(4);
		expect(quarterIndex('2026Q2')).toBe(105);
	});

	it('maps absolute indices back to quarter labels', () => {
		expect(quarterLabel(0)).toBe('2000Q1');
		expect(quarterLabel(3)).toBe('2000Q4');
		expect(quarterLabel(105)).toBe('2026Q2');
	});

	it('rejects malformed quarter labels and negative indices', () => {
		expect(() => quarterIndex('2000Q5')).toThrow();
		expect(() => quarterIndex('2000')).toThrow();
		expect(() => quarterIndex('Q1')).toThrow();
		expect(() => quarterLabel(-1)).toThrow();
	});

	it('builds inclusive quarter ranges for the slider grid', () => {
		expect(quarterRange('2000Q4', '2001Q2')).toEqual(['2000Q4', '2001Q1', '2001Q2']);
		expect(quarterRange('2000Q1', '2000Q1')).toEqual(['2000Q1']);
		expect(quarterRange('2001Q1', '2000Q1')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Log-space interpolation and derivation
// ---------------------------------------------------------------------------

describe('log-space interpolation', () => {
	it('interpolates geometrically between positive endpoints', () => {
		expect(logInterp(100, 400, 0.5)).toBeCloseTo(200, 10);
		expect(logInterp(2, 8, 0.5)).toBeCloseTo(4, 10);
		expect(logInterp(100, 400, 0)).toBe(100);
		expect(logInterp(100, 400, 1)).toBe(400);
	});

	it('falls back to linear interpolation when an endpoint is not positive', () => {
		expect(logInterp(0, 100, 0.5)).toBe(50);
		expect(logInterp(-10, 30, 0.5)).toBe(10);
	});
});

describe('deriveExpenses', () => {
	it('is revenue minus operating income', () => {
		expect(deriveExpenses(100, 25)).toBe(75);
		expect(deriveExpenses(50, -10)).toBe(60);
	});
});

// ---------------------------------------------------------------------------
// Sparse -> quarterly series
// ---------------------------------------------------------------------------

describe('interpolateSeries', () => {
	const grid = ['2000Q1', '2000Q2', '2000Q3', '2000Q4'];
	const anchors: CompanyPoint[] = [
		reported('2000Q1', 100, 25, 'q1 filing'),
		reported('2000Q3', 400, 100, 'q3 filing')
	];

	it('fills gaps with log-interpolated points labeled interpolated', () => {
		const out = interpolateSeries(anchors, grid);
		expect(out.map((p) => p.quarter)).toEqual(['2000Q1', '2000Q2', '2000Q3']);

		const mid = out[1];
		expect(mid.revenue).toBeCloseTo(200, 10);
		// expenses: 75 -> 300, geometric mean 150, so operating income is 200 - 150 = 50
		expect(mid.operatingIncome).toBeCloseTo(50, 10);
		expect(mid.quality).toBe('interpolated');
		expect(mid.source).toBeUndefined();
	});

	it('keeps anchor values, quality and source untouched', () => {
		const out = interpolateSeries(anchors, grid);
		expect(out[0]).toEqual(anchors[0]);
		expect(out[2]).toEqual(anchors[1]);
	});

	it('does not extrapolate beyond the first or last anchor', () => {
		const lateAnchors: CompanyPoint[] = [
			reported('2000Q2', 100, 25, 'q2 filing'),
			reported('2000Q3', 400, 100, 'q3 filing')
		];
		const out = interpolateSeries(lateAnchors, ['2000Q1', ...grid, '2001Q1']);
		expect(out.map((p) => p.quarter)).toEqual(['2000Q2', '2000Q3']);
	});

	it('emits a lone anchor unchanged', () => {
		const out = interpolateSeries([anchors[0]], grid);
		expect(out).toEqual([anchors[0]]);
	});

	it('sorts anchors by quarter regardless of input order', () => {
		const out = interpolateSeries([anchors[1], anchors[0]], grid);
		expect(out.map((p) => p.quarter)).toEqual(['2000Q1', '2000Q2', '2000Q3']);
		expect(out[1].revenue).toBeCloseTo(200, 10);
	});
});

// ---------------------------------------------------------------------------
// FX conversion
// ---------------------------------------------------------------------------

describe('fx conversion', () => {
	it('converts EUR to a display currency at the quarter rate', () => {
		expect(convertFromEur(100, '2000Q1', 'USD', fx)).toBeCloseTo(107, 10);
		expect(convert(100, '2000Q1', 'EUR', 'USD', fx)).toBeCloseTo(107, 10);
	});

	it('converts a reporting currency back to EUR', () => {
		expect(convertToEur(107, '2000Q1', 'USD', fx)).toBeCloseTo(100, 10);
		expect(convert(107, '2000Q1', 'USD', 'EUR', fx)).toBeCloseTo(100, 10);
	});

	it('converts between two non-EUR currencies through the EUR pivot', () => {
		expect(convert(62, '2000Q1', 'GBP', 'USD', fx)).toBeCloseTo(107, 10);
	});

	it('treats EUR conversions as identity without needing a rate', () => {
		expect(convertToEur(50, '1999Q1', 'EUR', fx)).toBe(50);
		expect(convert(50, '1999Q1', 'EUR', 'EUR', fx)).toBe(50);
	});

	it('throws when the quarter has no rate for the currency', () => {
		expect(() => convertToEur(1, '1999Q1', 'USD', fx)).toThrow(/1999Q1/);
		expect(() => convertFromEur(1, '1999Q1', 'GBP', fx)).toThrow(/1999Q1/);
	});
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('filterCompanies', () => {
	const companies: Company[] = [
		{
			id: 'sap',
			name: 'SAP',
			type: 'software',
			reportingCurrency: 'EUR',
			country: 'DE',
			points: []
		},
		{
			id: 'shell',
			name: 'Shell',
			type: 'energy',
			reportingCurrency: 'EUR',
			country: 'NL',
			points: []
		},
		{
			id: 'msft',
			name: 'Microsoft',
			type: 'software',
			reportingCurrency: 'USD',
			country: 'US',
			points: []
		}
	];

	it('selects by company id', () => {
		const state: FilterState = { selectedIds: ['shell'], types: ['software', 'energy'] };
		expect(filterCompanies(companies, state).map((c) => c.id)).toEqual(['shell']);
	});

	it('selects by type', () => {
		const state: FilterState = { selectedIds: ['sap', 'shell', 'msft'], types: ['software'] };
		expect(filterCompanies(companies, state).map((c) => c.id)).toEqual(['sap', 'msft']);
	});

	it('intersects id selection with the type filter', () => {
		const state: FilterState = { selectedIds: ['sap', 'shell'], types: ['software'] };
		expect(filterCompanies(companies, state).map((c) => c.id)).toEqual(['sap']);
	});

	it('treats an empty allow-list as matching nothing', () => {
		expect(filterCompanies(companies, { selectedIds: [], types: ['software'] })).toEqual([]);
		expect(filterCompanies(companies, { selectedIds: ['sap'], types: [] })).toEqual([]);
	});

	it('lists distinct types in sorted order', () => {
		expect(companyTypes(companies)).toEqual(['energy', 'software']);
	});
});

// ---------------------------------------------------------------------------
// Dataset schema validation
// ---------------------------------------------------------------------------

describe('validateDataset', () => {
	it('accepts a valid dataset', () => {
		expect(validateDataset(validDataset)).toEqual([]);
	});

	it('rejects non-object datasets', () => {
		expect(validateDataset(null)).not.toEqual([]);
		expect(validateDataset('nope')).not.toEqual([]);
		expect(validateDataset([])).not.toEqual([]);
	});

	it('requires meta fields and an http fx source', () => {
		const broken = clone();
		broken.meta.units = '';
		broken.meta.fxSource = 'data.ecb.europa.eu';
		const errors = validateDataset(broken);
		expect(errors.some((e) => e.includes('meta.units'))).toBe(true);
		expect(errors.some((e) => e.includes('meta.fxSource'))).toBe(true);
	});

	it('requires fx base EUR and positive USD/GBP rates for every rate entry', () => {
		const broken = clone();
		broken.fx.base = 'USD' as Dataset['fx']['base'];
		broken.fx.rates['2000Q1'].USD = 0;
		delete broken.fx.rates['2000Q2'].GBP;
		const errors = validateDataset(broken);
		expect(errors.some((e) => e.includes('fx.base'))).toBe(true);
		expect(errors.some((e) => e.includes("fx.rates.'2000Q1'.USD"))).toBe(true);
		expect(errors.some((e) => e.includes("fx.rates.'2000Q2'.GBP"))).toBe(true);
	});

	it('rejects malformed quarter labels in the fx table', () => {
		const broken = clone();
		broken.fx.rates['2000Q9'] = { USD: 1, GBP: 1 };
		expect(validateDataset(broken).some((e) => e.includes("'2000Q9'"))).toBe(true);
	});

	it('rejects duplicate company ids', () => {
		const broken = clone();
		broken.companies.push({ ...broken.companies[0] });
		expect(validateDataset(broken).some((e) => e.includes('duplicate id'))).toBe(true);
	});

	it('rejects a company with missing fields, bad currency or no points', () => {
		const broken = clone();
		broken.companies[0].name = '';
		broken.companies[0].reportingCurrency =
			'JPY' as Dataset['companies'][number]['reportingCurrency'];
		broken.companies[0].points = [];
		const errors = validateDataset(broken);
		expect(errors.some((e) => e.includes('companies[0].name'))).toBe(true);
		expect(errors.some((e) => e.includes('companies[0].reportingCurrency'))).toBe(true);
		expect(errors.some((e) => e.includes('companies[0].points'))).toBe(true);
	});

	it('rejects invalid point values and unknown quality labels', () => {
		const broken = clone();
		broken.companies[0].points[0].revenue = -5;
		broken.companies[0].points[0].operatingIncome = Number.NaN;
		broken.companies[0].points[1].quality = 'estimate' as CompanyPoint['quality'];
		const errors = validateDataset(broken);
		expect(errors.some((e) => e.includes('companies[0].points[0].revenue'))).toBe(true);
		expect(errors.some((e) => e.includes('companies[0].points[0].operatingIncome'))).toBe(true);
		expect(errors.some((e) => e.includes('companies[0].points[1].quality'))).toBe(true);
	});

	it('requires a source on reported and estimated points only', () => {
		const broken = clone();
		delete broken.companies[0].points[0].source;
		expect(validateDataset(broken).some((e) => e.includes('companies[0].points[0].source'))).toBe(
			true
		);

		const estimated = clone();
		estimated.companies[0].points[1].quality = 'estimated';
		estimated.companies[0].points[1].source = 'press estimate';
		expect(validateDataset(estimated)).toEqual([]);

		const interpolated = clone();
		interpolated.companies[0].points[1].quality = 'interpolated';
		delete interpolated.companies[0].points[1].source;
		expect(validateDataset(interpolated)).toEqual([]);
	});

	it('requires an http(s) source URL on reported and estimated points', () => {
		const missing = clone();
		delete missing.companies[0].points[0].sourceUrl;
		expect(
			validateDataset(missing).some((e) => e.includes('companies[0].points[0].sourceUrl'))
		).toBe(true);

		const bad = clone();
		bad.companies[0].points[1].sourceUrl = 'ftp://example.com/x';
		expect(validateDataset(bad).some((e) => e.includes('companies[0].points[1].sourceUrl'))).toBe(
			true
		);

		const interpolated = clone();
		interpolated.companies[0].points[1].quality = 'interpolated';
		delete interpolated.companies[0].points[1].sourceUrl;
		expect(validateDataset(interpolated)).toEqual([]);
	});

	it('rejects duplicate or unsorted point quarters', () => {
		const dup = clone();
		dup.companies[0].points[1].quarter = '2000Q1';
		expect(validateDataset(dup).some((e) => e.includes('duplicate quarter'))).toBe(true);

		const unsorted = clone();
		unsorted.companies[0].points.reverse();
		expect(validateDataset(unsorted).some((e) => e.includes('out of order'))).toBe(true);
	});

	it('requires fx rates covering every point quarter', () => {
		const broken = clone();
		broken.companies[0].points.push({
			...broken.companies[0].points[1],
			quarter: '2010Q1'
		});
		expect(validateDataset(broken).some((e) => e.includes('2010Q1'))).toBe(true);
	});
});

describe('loadDataset', () => {
	it('returns the typed dataset and no errors for valid input', () => {
		const { dataset, errors } = loadDataset(validDataset);
		expect(errors).toEqual([]);
		expect(dataset.companies[0].id).toBe('acme');
	});

	it('returns validation errors for invalid input', () => {
		const { errors } = loadDataset({ nonsense: true });
		expect(errors.length).toBeGreaterThan(0);
	});
});

describe('bundled companies.json', () => {
	it('passes schema validation', () => {
		expect(validateDataset(bundled)).toEqual([]);
	});
});
