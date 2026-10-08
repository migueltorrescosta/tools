export type Politician = {
	name: string;
	startDate: string;
	endDate: string;
	position: string;
	location: string;
	country: string;
	url: string;
};

export type PositionGroup = {
	location: string;
	politicians: Politician[];
};

export type CountryGroups = Record<string, PositionGroup[]>;

export const EU_FLAG = '🇪🇺';

// Date the bundled data was last checked against official sources (DD/MM/YYYY)
export const DATA_AS_OF = '08/10/2026';

export type CountryInfo = { label: string; color: string };

// Single source of truth for country labels and bar colours. Every colour must
// reach WCAG AA (4.5:1) against BAR_TEXT_COLOR; volt.spec.ts enforces it.
export const BAR_TEXT_COLOR = '#000000';
export const COUNTRIES: Record<string, CountryInfo> = {
	'🇩🇪': { label: 'Germany', color: '#FFEA00' },
	'🇳🇱': { label: 'Netherlands', color: '#FF9933' },
	'🇬🇷': { label: 'Greece', color: '#3399FF' },
	'🇨🇾': { label: 'Cyprus', color: '#FF7733' },
	'🇷🇴': { label: 'Romania', color: '#5C8AE6' },
	'🇵🇹': { label: 'Portugal', color: '#00AC00' },
	'🇮🇹': { label: 'Italy', color: '#009999' },
	'🇫🇷': { label: 'France', color: '#FF4D5A' },
	[EU_FLAG]: { label: 'European Parliament', color: '#4477DD' }
};

export const FALLBACK_COLOR = '#AAAAAA';

export const COUNTRY_COLORS: Record<string, string> = Object.fromEntries(
	Object.entries(COUNTRIES).map(([flag, c]) => [flag, c.color])
);

export function countryLabel(flag: string): string {
	return COUNTRIES[flag]?.label ?? flag;
}

export function countryColor(flag: string): string {
	return COUNTRIES[flag]?.color ?? FALLBACK_COLOR;
}

function channel(c: number): number {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) throw new Error(`Invalid colour "${hex}": expected #RRGGBB`);
	const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(parseInt(h, 16)));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

// Rows standing for a list or group of councillors rather than a named person
const GROUP_ENTRY_RE = /candidates|^Volt /;

export function isGroupEntry(p: Politician): boolean {
	return GROUP_ENTRY_RE.test(p.name);
}

const MEP_POSITIONS = new Set(['MEP', 'MdEP']);

export function isMep(p: Politician): boolean {
	return MEP_POSITIONS.has(p.position);
}

// Parse date string to a fractional year: YYYY + (month-1)/12 + (day-1)/365.
// Handles: "DD/MM/YYYY", "MM/YYYY", "YYYY". A bare year is Jan 1 of that year,
// so an end date of "2029" is exclusive (the mandate runs until the start of 2029).
// Anything else (ISO dates, "present", "", "15.07.2029", month 13) throws.
const DATE_RE = /^(?:(\d{2})\/)?(?:(\d{2})\/)?(\d{4})$/;

export function parseDate(dateStr: string): number {
	const m = DATE_RE.exec(dateStr);
	if (!m) throw new Error(`Invalid date "${dateStr}": expected DD/MM/YYYY, MM/YYYY or YYYY`);
	// With one prefix group the regex fills the first; it is the month, not the day
	const [day, month] = m[2] !== undefined ? [+m[1], +m[2]] : [1, m[1] !== undefined ? +m[1] : 1];
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		throw new Error(`Invalid date "${dateStr}": day or month out of range`);
	}
	return +m[3] + (month - 1) / 12 + (day - 1) / 365;
}

// Group by country, then by location; locations sorted by latest start date
export function groupByCountry(politicians: Politician[]): CountryGroups {
	const groups: CountryGroups = {};
	for (const p of politicians) {
		if (!groups[p.country]) groups[p.country] = [];
		const existing = groups[p.country].find((g) => g.location === p.location);
		if (existing) {
			existing.politicians.push(p);
		} else {
			groups[p.country].push({ location: p.location, politicians: [p] });
		}
	}
	for (const key of Object.keys(groups)) {
		groups[key].sort((a, b) => {
			const aStart = Math.max(...a.politicians.map((p) => parseDate(p.startDate)));
			const bStart = Math.max(...b.politicians.map((p) => parseDate(p.startDate)));
			return bStart - aStart;
		});
	}
	return groups;
}

// 'all' returns every country; the EU flag returns MEPs grouped by location
export function filterGroups(politicians: Politician[], filter: string): CountryGroups {
	if (filter === EU_FLAG) {
		const mepsByLoc: Record<string, Politician[]> = {};
		for (const p of politicians) {
			if (isMep(p)) {
				if (!mepsByLoc[p.location]) mepsByLoc[p.location] = [];
				mepsByLoc[p.location].push(p);
			}
		}
		const result: PositionGroup[] = Object.entries(mepsByLoc).map(([location, politicians]) => ({
			location,
			politicians
		}));
		return { [EU_FLAG]: result };
	}
	const groups = groupByCountry(politicians);
	if (filter === 'all') return groups;
	return { [filter]: groups[filter] ?? [] };
}

export type Stats = {
	// Named individuals only; group placeholder rows are counted in groupEntries
	total: number;
	meps: number;
	groupEntries: number;
	byCountry: Record<string, number>;
};

export function computeStats(politicians: Politician[]): Stats {
	const people = politicians.filter((p) => !isGroupEntry(p));
	const byCountry: Record<string, number> = {};
	for (const p of politicians) byCountry[p.country] ??= 0;
	for (const p of people) byCountry[p.country]++;
	return {
		total: people.length,
		meps: people.filter(isMep).length,
		groupEntries: politicians.length - people.length,
		byCountry
	};
}

export type SummaryBar = { filter: string; label: string; flag: string; count: number };

// Filter buttons derived from the data: All, one per country present (by label), then MEPs
export function summaryBars(stats: Stats): SummaryBar[] {
	const countries = Object.entries(stats.byCountry)
		.map(([flag, count]) => ({ filter: flag, label: countryLabel(flag), flag, count }))
		.sort((a, b) => a.label.localeCompare(b.label));
	return [
		{ filter: 'all', label: 'All', flag: '🌍', count: stats.total },
		...countries,
		{ filter: EU_FLAG, label: 'MEPs', flag: EU_FLAG, count: stats.meps }
	];
}

// Fractional year of a calendar date, on the same scale as parseDate
export function fractionalYear(d: Date): number {
	return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365;
}

// A mandate is former once its (exclusive) end date has passed
export function isFormer(p: Politician, now: number): boolean {
	return parseDate(p.endDate) <= now;
}

export function describeMandate(p: Politician, now: number): string {
	const status = isFormer(p, now) ? ' (former)' : '';
	return `${p.name}, ${p.position}, ${p.location}: ${p.startDate} to ${p.endDate}${status}`;
}

export type Timeline = { minYear: number; maxYear: number; yearRange: number };

export function timelineRange(politicians: Politician[]): Timeline {
	const minYear = Math.floor(Math.min(...politicians.map((p) => parseDate(p.startDate))));
	const maxYear = Math.floor(Math.max(...politicians.map((p) => parseDate(p.endDate))));
	return { minYear, maxYear, yearRange: maxYear - minYear + 1 };
}

// Position of a fractional year as a percentage of the timeline, or null if outside it
export function timelinePercent(year: number, t: Timeline): number | null {
	const pct = ((year - t.minYear) / t.yearRange) * 100;
	return pct >= 0 && pct <= 100 ? pct : null;
}

// Bar position and width as percentages of the timeline; each year cell spans
// [minYear + i, minYear + i + 1), and the end date is exclusive
export function barGeometry(p: Politician, t: Timeline): { left: number; width: number } {
	const start = parseDate(p.startDate);
	const end = parseDate(p.endDate);
	return {
		left: ((start - t.minYear) / t.yearRange) * 100,
		width: ((end - start) / t.yearRange) * 100
	};
}
