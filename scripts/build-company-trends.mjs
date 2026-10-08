// Build src/routes/company-trends/data/companies.json from the curated sources.
//
// Sources (native currency, one anchor per fiscal year, each with source label + URL):
//   src/routes/company-trends/data/sources/companies/<id>.json
//   src/routes/company-trends/data/sources/fx.json   (ECB quarterly average rates)
//
// The build rules live in src/lib/company-trends/build.ts, which the spec also uses
// to check that companies.json is in sync with the sources. This file only does I/O.
//
// Usage: node scripts/build-company-trends.mjs [--until <year>]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataset } from '../src/lib/company-trends/build.ts';

const DATA = 'src/routes/company-trends/data';
const SOURCES = join(DATA, 'sources');

const untilArg = process.argv.indexOf('--until');
const untilYear = untilArg === -1 ? 9999 : Number(process.argv[untilArg + 1]);

const fxSource = JSON.parse(readFileSync(join(SOURCES, 'fx.json'), 'utf8'));
const sources = readdirSync(join(SOURCES, 'companies'))
	.sort()
	.map((file) => JSON.parse(readFileSync(join(SOURCES, 'companies', file), 'utf8')));

const dataset = buildDataset(fxSource, sources, {
	untilYear,
	generated: new Date().toISOString().slice(0, 10)
});

writeFileSync(join(DATA, 'companies.json'), JSON.stringify(dataset, null, '\t') + '\n');
console.log(
	`companies.json: ${dataset.companies.length} companies, ${dataset.companies.reduce((n, c) => n + c.points.length, 0)} anchors`
);
