// Pure helpers behind scripts/build-company-trends.mjs, which only does the file I/O.
// The spec rebuilds companies.json from the sources with these to keep the two in sync.
//
// Rules:
// - An anchor is placed at the quarter containing its fiscal-year end (shifted back one
//   week so 52/53-week years ending in the first days of a quarter stay in the prior one).
// - Values are fiscal-year (trailing-twelve-month) totals, converted to EUR with the mean
//   of the ECB quarterly average rates over the fiscal year's four quarters (the FX
//   source starts at 1999Q1 so fiscal years ending in early 2000 average their 1999 quarters).
// - Only anchors in 2000Q1..2026Q4 are kept; quarters are never extrapolated.
import { fiscalYearRate, type Currency, type FxRate, type FxTable } from './fx.ts';
import type { Quality } from './series.ts';

/** One filed fiscal year in the company's reporting currency (millions). */
export interface SourceAnchor {
	periodEnd: string;
	currency: Currency;
	revenue: number;
	operatingIncome: number;
	quality: Quality;
	source: string;
	sourceUrl?: string;
}

export interface SourceCompany {
	id: string;
	name: string;
	type: string;
	reportingCurrency: Currency;
	country: string;
	notes?: string;
	anchors: SourceAnchor[];
}

export interface SourceFx {
	rates: Record<string, FxRate>;
}

export interface BuildOptions {
	/** Last calendar year of anchors to keep. */
	untilYear?: number;
	/** ISO date stored as meta.generated. */
	generated: string;
}

const LAST_YEAR = 2026;

/** Enough to keep thousand-precision filings and margins exact to well under 0.01%. */
export const SIGNIFICANT_DIGITS = 6;

/** Decimal digits kept for each FX rate in the output table. */
export const RATE_DECIMALS = 5;

export function round(value: number, digits: number): number {
	const f = 10 ** digits;
	return Math.round(value * f) / f;
}

/**
 * Round to `digits` significant digits. EUR values span 0.05 to 600,000 millions, so a
 * fixed number of decimals would wipe out small filings (Tesla FY2007 revenue USD 0.073m).
 */
export function roundSignificant(value: number, digits: number): number {
	if (value === 0 || !Number.isFinite(value)) return value;
	const decimals = digits - 1 - Math.floor(Math.log10(Math.abs(value)));
	return decimals > 0 ? round(value, decimals) : Math.round(value);
}

function quarterIndex(label: string): number {
	const m = /^(\d{4})Q([1-4])$/.exec(label);
	if (!m) throw new Error(`Invalid quarter label: ${label}`);
	return (Number(m[1]) - 2000) * 4 + Number(m[2]) - 1;
}

/** Quarter holding a fiscal year ending on `iso`, one week earlier for 52/53-week years. */
export function quarterOfPeriodEnd(iso: string): string {
	const date = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid period end: ${iso}`);
	date.setUTCDate(date.getUTCDate() - 7);
	return `${date.getUTCFullYear()}Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** A filed figure as filed: every digit kept, thousands separated. */
export function formatFiled(n: number): string {
	const [int, frac] = String(n).split('.');
	const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** The output FX table: every source quarter, rates rounded to RATE_DECIMALS. */
export function buildFxTable(source: SourceFx): FxTable {
	const rates: Record<string, FxRate> = {};
	for (const [quarter, entry] of Object.entries(source.rates)) {
		rates[quarter] = {
			USD: round(entry.USD as number, RATE_DECIMALS),
			GBP: round(entry.GBP as number, RATE_DECIMALS)
		};
	}
	return { base: 'EUR', rates };
}

/** Build the companies.json dataset from the curated sources. */
export function buildDataset(
	fxSource: SourceFx,
	sources: SourceCompany[],
	{ untilYear = 9999, generated }: BuildOptions
) {
	const fx = buildFxTable(fxSource);
	const companies = [];
	for (const raw of sources) {
		const points = new Map<string, Record<string, unknown> & { quarter: string }>();
		for (const a of raw.anchors) {
			const quarter = quarterOfPeriodEnd(a.periodEnd);
			const year = Number(quarter.slice(0, 4));
			if (year < 2000 || year > untilYear || year > LAST_YEAR) continue;
			const rate = a.currency === 'EUR' ? 1 : fiscalYearRate(quarter, a.currency, fx);
			points.set(quarter, {
				quarter,
				revenue: roundSignificant(a.revenue / rate, SIGNIFICANT_DIGITS),
				operatingIncome: roundSignificant(a.operatingIncome / rate, SIGNIFICANT_DIGITS),
				quality: a.quality,
				source: `${a.source} (FY ending ${a.periodEnd}: revenue ${a.currency} ${formatFiled(a.revenue)}m, operating income ${a.currency} ${formatFiled(a.operatingIncome)}m)`,
				sourceUrl: a.sourceUrl
			});
		}
		if (points.size === 0) continue;
		companies.push({
			id: raw.id,
			name: raw.name,
			type: raw.type,
			reportingCurrency: raw.reportingCurrency,
			country: raw.country,
			notes: raw.notes,
			points: [...points.values()].sort((a, b) => quarterIndex(a.quarter) - quarterIndex(b.quarter))
		});
	}
	companies.sort((a, b) => a.name.localeCompare(b.name));

	return {
		meta: {
			generated,
			units:
				'EUR millions, fiscal-year (trailing twelve months) totals placed at the fiscal year-end quarter',
			fxMethodology:
				'ECB quarterly average euro reference rates (foreign currency units per EUR), hardcoded. USD/GBP fiscal-year figures are converted to EUR with the mean of the quarterly rates over the fiscal year; display in USD/GBP reconverts each quarter with the same fiscal-year mean rate, so reporting-currency figures match the filings. Rates taken from the ECB EXR series (Q.USD.EUR.SP00.A, Q.GBP.EUR.SP00.A) via the DBnomics mirror of the ECB Data Portal.',
			fxSource: 'https://data.ecb.europa.eu/data/datasets/EXR'
		},
		fx,
		companies
	};
}
