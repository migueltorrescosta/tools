// Build src/routes/company-trends/data/companies.json from the curated sources.
//
// Sources (native currency, one anchor per fiscal year, each with source label + URL):
//   src/routes/company-trends/data/sources/companies/<id>.json
//   src/routes/company-trends/data/sources/fx.json   (ECB quarterly average rates)
//
// Rules:
// - An anchor is placed at the quarter containing its fiscal-year end (shifted back one
//   week so 52/53-week years ending in the first days of a quarter stay in the prior one).
// - Values are fiscal-year (trailing-twelve-month) totals, converted to EUR with the mean
//   of the ECB quarterly average rates over the fiscal year's quarters (from 2000Q1 on).
// - Only anchors in 2000Q1..2026Q4 are kept; quarters are never extrapolated.
//
// Usage: node scripts/build-company-trends.mjs [--until <year>]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'src/routes/company-trends/data';
const SOURCES = join(DATA, 'sources');

const untilArg = process.argv.indexOf('--until');
const untilYear = untilArg === -1 ? 9999 : Number(process.argv[untilArg + 1]);

const fxSource = JSON.parse(readFileSync(join(SOURCES, 'fx.json'), 'utf8'));
const rates = {};
for (const [quarter, entry] of Object.entries(fxSource.rates)) {
	rates[quarter] = { USD: round(entry.USD, 5), GBP: round(entry.GBP, 5) };
}

function round(value, digits) {
	const f = 10 ** digits;
	return Math.round(value * f) / f;
}

function quarterIndex(label) {
	const m = /^(\d{4})Q([1-4])$/.exec(label);
	return (Number(m[1]) - 2000) * 4 + Number(m[2]) - 1;
}

function quarterLabel(index) {
	return `${2000 + Math.floor(index / 4)}Q${(index % 4) + 1}`;
}

function quarterOfPeriodEnd(iso) {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - 7);
	return `${date.getUTCFullYear()}Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** Mean foreign-units-per-EUR rate over the four quarters ending at `quarter`. */
function fiscalYearRate(quarter, currency) {
	const end = quarterIndex(quarter);
	const values = [];
	for (let i = Math.max(0, end - 3); i <= end; i++) {
		const rate = rates[quarterLabel(i)]?.[currency];
		if (rate === undefined) throw new Error(`missing ${currency} rate for ${quarterLabel(i)}`);
		values.push(rate);
	}
	return values.reduce((a, b) => a + b, 0) / values.length;
}

const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

const companies = [];
for (const file of readdirSync(join(SOURCES, 'companies')).sort()) {
	const raw = JSON.parse(readFileSync(join(SOURCES, 'companies', file), 'utf8'));
	const points = new Map();
	for (const a of raw.anchors) {
		const quarter = quarterOfPeriodEnd(a.periodEnd);
		const year = Number(quarter.slice(0, 4));
		if (year < 2000 || year > untilYear || year > 2026) continue;
		const rate = a.currency === 'EUR' ? 1 : fiscalYearRate(quarter, a.currency);
		points.set(quarter, {
			quarter,
			revenue: round(a.revenue / rate, 1),
			operatingIncome: round(a.operatingIncome / rate, 1),
			quality: a.quality,
			source: `${a.source} (FY ending ${a.periodEnd}: revenue ${a.currency} ${fmt(a.revenue)}m, operating income ${a.currency} ${fmt(a.operatingIncome)}m)`,
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

const dataset = {
	meta: {
		generated: new Date().toISOString().slice(0, 10),
		units:
			'EUR millions, fiscal-year (trailing twelve months) totals placed at the fiscal year-end quarter',
		fxMethodology:
			'ECB quarterly average euro reference rates (foreign currency units per EUR), hardcoded. USD/GBP fiscal-year figures are converted to EUR with the mean of the quarterly rates over the fiscal year; display in USD/GBP reconverts each quarter at that quarter’s rate. Rates taken from the ECB EXR series (Q.USD.EUR.SP00.A, Q.GBP.EUR.SP00.A) via the DBnomics mirror of the ECB Data Portal.',
		fxSource: 'https://data.ecb.europa.eu/data/datasets/EXR'
	},
	fx: { base: 'EUR', rates },
	companies
};

writeFileSync(join(DATA, 'companies.json'), JSON.stringify(dataset, null, '\t') + '\n');
console.log(
	`companies.json: ${companies.length} companies, ${companies.reduce((n, c) => n + c.points.length, 0)} anchors`
);
