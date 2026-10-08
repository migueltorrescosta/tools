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

const MEP_POSITIONS = new Set(['MEP', 'MdEP']);

export function isMep(p: Politician): boolean {
	return MEP_POSITIONS.has(p.position);
}

// Parse date string to year (number)
// Handles: "DD/MM/YYYY", "MM/YYYY", "YYYY"
export function parseDate(dateStr: string): number {
	const parts = dateStr.split('/');
	if (parts.length === 3) return parseInt(parts[2]);
	if (parts.length === 2) return parseInt(parts[1]);
	return parseInt(dateStr);
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

export function computeStats(politicians: Politician[]) {
	const byCountry = (flag: string) => politicians.filter((p) => p.country === flag).length;
	return {
		total: politicians.length,
		meps: politicians.filter(isMep).length,
		netherlands: byCountry('🇳🇱'),
		germany: byCountry('🇩🇪'),
		cyprus: byCountry('🇨🇾'),
		greece: byCountry('🇬🇷'),
		romania: byCountry('🇷🇴'),
		portugal: byCountry('🇵🇹'),
		italy: byCountry('🇮🇹'),
		france: byCountry('🇫🇷')
	};
}

export type Timeline = { minYear: number; maxYear: number; yearRange: number };

export function timelineRange(politicians: Politician[]): Timeline {
	const minYear = Math.min(...politicians.map((p) => parseDate(p.startDate)));
	const maxYear = Math.max(...politicians.map((p) => parseDate(p.endDate)));
	return { minYear, maxYear, yearRange: maxYear - minYear + 1 };
}

// Bar position and width as percentages of the timeline
export function barGeometry(p: Politician, t: Timeline): { left: number; width: number } {
	const start = parseDate(p.startDate);
	const end = parseDate(p.endDate);
	return {
		left: ((start - t.minYear) / t.yearRange) * 100,
		width: ((end - start + 1) / t.yearRange) * 100
	};
}
