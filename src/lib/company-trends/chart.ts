import { convertFromEur, type Currency, type FxTable } from './fx';
import type { Company } from './schema';
import { deriveExpenses, interpolateSeries, quarterIndex, type Quality } from './series';

/** Fixed type order: color follows the type, never its rank in the current filter. */
export const TYPE_ORDER = [
	'tech',
	'automotive',
	'energy',
	'retail',
	'consumer',
	'pharma',
	'industrial',
	'ai'
] as const;

/** Index into the categorical palette for a company type; unknown types share the last slot. */
export function typeSlot(type: string): number {
	const index = (TYPE_ORDER as readonly string[]).indexOf(type);
	return index === -1 ? TYPE_ORDER.length - 1 : index;
}

export interface TrailPoint {
	quarter: string;
	/** Absolute quarter index (2000Q1 = 0). */
	qi: number;
	/** Revenue in the display currency (millions). */
	revenue: number;
	/** Operating expenses (revenue - operating income) in the display currency (millions). */
	expenses: number;
	operatingIncome: number;
	quality: Quality;
	source?: string;
	sourceUrl?: string;
	/** For interpolated points: the anchors this point was derived from. */
	from?: string;
	to?: string;
	/** True when the point lies in a gap wider than the regular annual cadence. */
	gap: boolean;
}

export interface Trail {
	company: Company;
	points: TrailPoint[];
}

/** Anchors further apart than this (in quarters) mark the span between them as a data gap. */
export const ANNUAL_CADENCE = 4;

/**
 * Densify a company's anchors onto the quarter grid and convert to `currency`.
 * Conversion uses each quarter's own rate, so trails reflect FX moves too.
 */
export function buildTrail(
	company: Company,
	quarters: readonly string[],
	currency: Currency,
	fx: FxTable
): Trail {
	const anchors = company.points;
	const dense = interpolateSeries(anchors, quarters);
	const anchorIdx = anchors.map((a) => quarterIndex(a.quarter));
	const points = dense.map((p): TrailPoint => {
		const qi = quarterIndex(p.quarter);
		const revenue = convertFromEur(p.revenue, p.quarter, currency, fx);
		const operatingIncome = convertFromEur(p.operatingIncome, p.quarter, currency, fx);
		const base: TrailPoint = {
			quarter: p.quarter,
			qi,
			revenue,
			expenses: deriveExpenses(revenue, operatingIncome),
			operatingIncome,
			quality: p.quality,
			source: p.source,
			sourceUrl: p.sourceUrl,
			gap: false
		};
		if (p.quality !== 'interpolated') return base;
		let hi = anchorIdx.findIndex((ai) => ai > qi);
		if (hi <= 0) hi = anchorIdx.length - 1;
		const lo = hi - 1;
		return {
			...base,
			from: anchors[lo].quarter,
			to: anchors[hi].quarter,
			gap: anchorIdx[hi] - anchorIdx[lo] > ANNUAL_CADENCE
		};
	});
	return { company, points };
}

/** Points of a trail up to and including quarter index `qi`. */
export function trailUpTo(trail: Trail, qi: number): TrailPoint[] {
	return trail.points.filter((p) => p.qi <= qi);
}

export interface LogScale {
	(value: number): number;
	domain: [number, number];
	range: [number, number];
}

/** Base-10 log scale mapping `domain` (positive) onto `range`. */
export function logScale(domain: [number, number], range: [number, number]): LogScale {
	const [d0, d1] = domain;
	if (!(d0 > 0 && d1 > 0)) throw new Error('log scale domain must be positive');
	const l0 = Math.log10(d0);
	const span = Math.log10(d1) - l0 || 1;
	const scale = ((value: number) =>
		range[0] + ((Math.log10(value) - l0) / span) * (range[1] - range[0])) as LogScale;
	scale.domain = domain;
	scale.range = range;
	return scale;
}

/** Positive [min, max] across values, widened to whole decades; null when no positive values. */
export function logExtent(values: Iterable<number>): [number, number] | null {
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (!(v > 0) || !Number.isFinite(v)) continue;
		if (v < min) min = v;
		if (v > max) max = v;
	}
	if (min === Infinity) return null;
	const lo = 10 ** Math.floor(Math.log10(min));
	let hi = 10 ** Math.ceil(Math.log10(max));
	if (hi <= lo) hi = lo * 10;
	return [lo, hi];
}

/** Tick values at 1·10^k (major) and, when the domain spans few decades, 2 and 5 as well. */
export function logTicks(domain: [number, number]): { value: number; major: boolean }[] {
	const [lo, hi] = domain;
	const k0 = Math.floor(Math.log10(lo));
	const k1 = Math.ceil(Math.log10(hi));
	const dense = k1 - k0 <= 3;
	const ticks: { value: number; major: boolean }[] = [];
	for (let k = k0; k <= k1; k++) {
		for (const m of dense ? [1, 2, 5] : [1]) {
			const value = m * 10 ** k;
			if (value >= lo * (1 - 1e-9) && value <= hi * (1 + 1e-9)) {
				ticks.push({ value, major: m === 1 });
			}
		}
	}
	return ticks;
}

const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', GBP: '£' };

/** Compact money label for a value in millions, e.g. `€1.2B`, `$350M`, `£2.4T`. */
export function formatMoney(millions: number, currency: Currency): string {
	const sign = millions < 0 ? '−' : '';
	const abs = Math.abs(millions);
	let value: number;
	let unit: string;
	if (abs >= 1e6) {
		value = abs / 1e6;
		unit = 'T';
	} else if (abs >= 1e3) {
		value = abs / 1e3;
		unit = 'B';
	} else {
		value = abs;
		unit = 'M';
	}
	const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
	const text = Number(value.toFixed(digits)).toString();
	return `${sign}${SYMBOL[currency]}${text}${unit}`;
}

export type SegmentKind = 'solid' | 'gap';

export interface Segment {
	kind: SegmentKind;
	d: string;
}

/**
 * Split a trail into SVG path segments. Consecutive points join a segment of
 * the same kind; points in a data gap form `gap` segments; non-positive values
 * (undrawable on log axes) break the line.
 */
export function trailSegments(
	points: readonly TrailPoint[],
	x: (v: number) => number,
	y: (v: number) => number
): Segment[] {
	const segments: Segment[] = [];
	let current: { kind: SegmentKind; coords: string[] } | null = null;
	let prev: TrailPoint | null = null;
	const flush = () => {
		if (current && current.coords.length > 1) {
			segments.push({ kind: current.kind, d: 'M' + current.coords.join('L') });
		}
		current = null;
	};
	for (const p of points) {
		if (!(p.revenue > 0 && p.expenses > 0)) {
			flush();
			prev = null;
			continue;
		}
		const xy = `${x(p.revenue).toFixed(1)},${y(p.expenses).toFixed(1)}`;
		// A segment's kind is decided by its far endpoint: gap points sit inside gaps,
		// and the anchor closing a gap still belongs to the gap.
		const kind: SegmentKind = p.gap || (prev?.gap ?? false) ? 'gap' : 'solid';
		if (prev && current && current.kind === kind) {
			current.coords.push(xy);
		} else if (prev) {
			const prevXy = `${x(prev.revenue).toFixed(1)},${y(prev.expenses).toFixed(1)}`;
			flush();
			current = { kind, coords: [prevXy, xy] };
		} else {
			flush();
			current = { kind, coords: [xy] };
		}
		prev = p;
	}
	flush();
	return segments;
}
