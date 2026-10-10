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
	/** Operating margin (operating income / revenue) as a fraction; null without revenue. */
	margin: number | null;
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
 * Conversion uses the fiscal-year rate ending at each quarter (the rate the build used),
 * so a company shown in its reporting currency reproduces its filed figures.
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
			margin: revenue > 0 ? operatingIncome / revenue : null,
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

/** The trail's latest point at or before `qi`; undefined before its first point. */
export function latestUpTo(trail: Trail, qi: number): TrailPoint | undefined {
	let latest: TrailPoint | undefined;
	for (const p of trail.points) {
		if (p.qi > qi) break;
		latest = p;
	}
	return latest;
}

/** Whether a point can be placed on the chart (positive revenue for the log axis, a margin). */
export function isDrawable(p: TrailPoint): boolean {
	return p.revenue > 0 && p.margin !== null;
}

/** A trail as drawn at quarter `qi`. */
export interface DrawnTrail {
	trail: Trail;
	/** Every point up to `qi`, drawable or not: undrawable ones break the line. */
	path: TrailPoint[];
	/** Drawable points up to `qi`: markers and hit-testing. */
	points: TrailPoint[];
	head: TrailPoint | null;
	/** True once the company's dataset has ended before `qi`. */
	ended: boolean;
}

export function drawTrail(trail: Trail, qi: number): DrawnTrail {
	const path = trailUpTo(trail, qi);
	const points = path.filter(isDrawable);
	const last = trail.points[trail.points.length - 1];
	return {
		trail,
		path,
		points,
		head: points.length > 0 ? points[points.length - 1] : null,
		ended: last !== undefined && last.qi < qi
	};
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

/**
 * Lowest revenue the default x axis reaches (millions in the display currency).
 * Pre-revenue filings (Tesla FY2007: USD 0.073m) would otherwise stretch the axis
 * across extra decades for one point; points below are pinned to the left edge.
 */
export const REVENUE_FLOOR = 10;

/** The revenue axis domain: {@link logExtent} with its lower bound raised to `floor`. */
export function revenueDomain(
	values: Iterable<number>,
	floor = REVENUE_FLOOR
): [number, number] | null {
	const extent = logExtent(values);
	if (!extent) return null;
	const lo = Math.max(extent[0], floor);
	return [lo, Math.max(extent[1], lo * 10)];
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

export interface LinearScale {
	(value: number): number;
	domain: readonly [number, number];
	range: [number, number];
}

/** Linear scale mapping `domain` onto `range`. */
export function linearScale(
	domain: readonly [number, number],
	range: [number, number]
): LinearScale {
	const [d0, d1] = domain;
	const span = d1 - d0 || 1;
	const scale = ((value: number) =>
		range[0] + ((value - d0) / span) * (range[1] - range[0])) as LinearScale;
	scale.domain = domain;
	scale.range = range;
	return scale;
}

/** Fixed operating-margin axis (fractions): -200% to +100%, so it never rescales. */
export const MARGIN_DOMAIN = [-2, 1] as const;

export type Clip = 'low' | 'high' | null;

/** Clamp a margin into {@link MARGIN_DOMAIN}, reporting which edge (if any) it was pinned to. */
export function clampMargin(margin: number): { value: number; clipped: Clip } {
	const [lo, hi] = MARGIN_DOMAIN;
	if (margin < lo) return { value: lo, clipped: 'low' };
	if (margin > hi) return { value: hi, clipped: 'high' };
	return { value: margin, clipped: null };
}

/** Ticks every 50% across a margin domain; 0% (break-even) is the major tick. */
export function percentTicks(
	domain: readonly [number, number]
): { value: number; major: boolean }[] {
	const ticks: { value: number; major: boolean }[] = [];
	for (let k = Math.ceil(domain[0] * 2); k <= Math.floor(domain[1] * 2); k++) {
		ticks.push({ value: k / 2, major: k === 0 });
	}
	return ticks;
}

/** Percentage label for a fraction, e.g. `−150%`, `12.4%`. */
export function formatPercent(fraction: number, digits = 0): string {
	const pct = fraction * 100;
	const text = Math.abs(pct).toLocaleString('en-US', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
	return `${pct < 0 && Number(text.replace(/,/g, '')) !== 0 ? '−' : ''}${text}%`;
}

/** Number of distinct per-company colours; larger selections colour by industry. */
export const PALETTE_SIZE = 12;

export type ColorMode = 'company' | 'industry';

export function colorMode(visibleCount: number): ColorMode {
	return visibleCount <= PALETTE_SIZE ? 'company' : 'industry';
}

/**
 * CSS colour per company id. Small selections get one palette slot per company; larger
 * ones share their industry's slot. Without `previous`, slots follow name order over the
 * visible set. With `previous` (the last company-mode slots, 1-based), companies that
 * held a slot keep it and newcomers take the lowest free slots in name order, so ticking
 * a company on or off never recolours the others.
 */
export function assignColors(
	trails: readonly Trail[],
	previous: ReadonlyMap<string, number> = new Map()
): { colors: Map<string, string>; slots: Map<string, number> } {
	const colors = new Map<string, string>();
	if (colorMode(trails.length) === 'industry') {
		for (const t of trails) {
			colors.set(t.company.id, `var(--series-${typeSlot(t.company.type) + 1})`);
		}
		return { colors, slots: new Map(previous) };
	}
	const sorted = [...trails].sort(
		(a, b) =>
			a.company.name.localeCompare(b.company.name) || a.company.id.localeCompare(b.company.id)
	);
	const slots = new Map<string, number>();
	const taken = new Set<number>();
	for (const t of sorted) {
		const slot = previous.get(t.company.id);
		if (slot !== undefined && slot >= 1 && slot <= PALETTE_SIZE && !taken.has(slot)) {
			slots.set(t.company.id, slot);
			taken.add(slot);
		}
	}
	let next = 1;
	for (const t of sorted) {
		if (slots.has(t.company.id)) continue;
		while (taken.has(next)) next++;
		slots.set(t.company.id, next);
		taken.add(next);
	}
	for (const t of sorted) colors.set(t.company.id, `var(--cseries-${slots.get(t.company.id)})`);
	return { colors, slots };
}

const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', GBP: '£' };

const MONEY_UNITS = [
	{ divisor: 1e6, unit: 'T' },
	{ divisor: 1e3, unit: 'B' },
	{ divisor: 1, unit: 'M' }
] as const;

/** Compact money label for a value in millions, e.g. `€1.2B`, `$350M`, `£2.4T`. */
export function formatMoney(millions: number, currency: Currency): string {
	const sign = millions < 0 ? '−' : '';
	const abs = Math.abs(millions);
	let u = MONEY_UNITS.findIndex((m) => abs >= m.divisor);
	if (u === -1) u = MONEY_UNITS.length - 1;
	const round = (value: number) => {
		const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
		return Number(value.toFixed(digits));
	};
	let rounded = round(abs / MONEY_UNITS[u].divisor);
	// Rounding can carry into the next unit (999.6M -> 1000M): promote to 1B instead.
	if (rounded >= 1000 && u > 0) {
		u -= 1;
		rounded = round(abs / MONEY_UNITS[u].divisor);
	}
	return `${sign}${SYMBOL[currency]}${rounded}${MONEY_UNITS[u].unit}`;
}

export type SegmentKind = 'solid' | 'gap' | 'clipped';

export interface Segment {
	kind: SegmentKind;
	d: string;
}

/**
 * Split a trail into SVG path segments in (revenue, operating margin) space.
 * Consecutive points join a segment of the same kind; points in a data gap
 * form `gap` segments; segments touching an off-scale margin are `clipped`
 * (drawn pinned to the axis edge); points without positive revenue
 * (undrawable on the log x axis) break the line.
 */
export function trailSegments(
	points: readonly TrailPoint[],
	x: (v: number) => number,
	y: (v: number) => number
): Segment[] {
	const segments: Segment[] = [];
	let current: { kind: SegmentKind; coords: string[] } | null = null;
	let prev: { point: TrailPoint; xy: string; clipped: boolean } | null = null;
	const flush = () => {
		if (current && current.coords.length > 1) {
			segments.push({ kind: current.kind, d: 'M' + current.coords.join('L') });
		}
		current = null;
	};
	for (const p of points) {
		if (!(p.revenue > 0) || p.margin === null) {
			flush();
			prev = null;
			continue;
		}
		const m = clampMargin(p.margin);
		const xy = `${x(p.revenue).toFixed(1)},${y(m.value).toFixed(1)}`;
		const clipped = m.clipped !== null;
		// A segment's kind is decided by its far endpoint: gap points sit inside gaps,
		// and the anchor closing a gap still belongs to the gap. Clipping wins over gaps.
		const kind: SegmentKind =
			clipped || (prev?.clipped ?? false)
				? 'clipped'
				: p.gap || (prev?.point.gap ?? false)
					? 'gap'
					: 'solid';
		if (prev && current && current.kind === kind) {
			current.coords.push(xy);
		} else if (prev) {
			const prevXy = prev.xy;
			flush();
			current = { kind, coords: [prevXy, xy] };
		} else {
			flush();
			current = { kind, coords: [xy] };
		}
		prev = { point: p, xy, clipped };
	}
	flush();
	return segments;
}

/** A point under the pointer or pinned, as drawn right now. */
export interface Hit {
	trail: Trail;
	point: TrailPoint;
}

/** What a hover or pin refers to, independent of currency and the current trail set. */
export interface HitSelection {
	companyId: string;
	quarter: string;
}

/**
 * The drawn point a selection refers to in the current trails, or null when that
 * company is no longer drawn or the quarter is not on screen (e.g. the slider moved
 * before it). Re-resolving on every change keeps the tooltip in the current currency.
 */
export function resolveHit(
	drawn: readonly { trail: Trail; points: readonly TrailPoint[] }[],
	sel: HitSelection | null
): Hit | null {
	if (!sel) return null;
	const d = drawn.find((entry) => entry.trail.company.id === sel.companyId);
	const point = d?.points.find((p) => p.quarter === sel.quarter);
	return d && point ? { trail: d.trail, point } : null;
}

/** Hit radius around a point, in chart units. */
export const HIT_RADIUS = 14;

/**
 * Squared-distance penalty for interpolated points (except a trail's head), so an anchor
 * or head wins a tie against a faint interpolated point at the same distance. It only
 * breaks near-ties: it never lets a farther anchor beat a clearly closer point.
 */
export const INTERPOLATED_BIAS = 4;

/**
 * The drawn point nearest to (`px`, `py`) within {@link HIT_RADIUS}, or null. `x` maps
 * revenue and `y` maps a margin (clamped to the axis, as drawn) to chart coordinates.
 */
export function nearestHit(
	drawn: readonly Pick<DrawnTrail, 'trail' | 'points' | 'head'>[],
	px: number,
	py: number,
	x: (revenue: number) => number,
	y: (margin: number) => number
): Hit | null {
	let best: Hit | null = null;
	let bestDist = HIT_RADIUS * HIT_RADIUS;
	for (const d of drawn) {
		for (const p of d.points) {
			const dx = x(p.revenue) - px;
			const dy = y(clampMargin(p.margin ?? 0).value) - py;
			const bias = p.quality === 'interpolated' && p !== d.head ? INTERPOLATED_BIAS : 0;
			const dist = dx * dx + dy * dy + bias;
			if (dist < bestDist) {
				bestDist = dist;
				best = { trail: d.trail, point: p };
			}
		}
	}
	return best;
}

/** Tooltip anchor in percent of the chart box, flipped away from the right and bottom edges. */
export function tooltipPlacement(
	tx: number,
	ty: number,
	width: number,
	height: number
): { left: number; top: number; flipX: boolean; flipY: boolean } {
	return {
		left: (tx / width) * 100,
		top: (ty / height) * 100,
		flipX: tx > width * 0.6,
		flipY: ty > height * 0.55
	};
}

/** A filing backing a drawn point. */
export interface PointSource {
	quarter: string;
	source?: string;
	sourceUrl?: string;
}

/**
 * The filings behind `point`: the point itself for an anchor, or the two anchors an
 * interpolated point was derived from.
 */
export function pointSources(trail: Trail, point: TrailPoint): PointSource[] {
	if (point.quality !== 'interpolated') {
		return [{ quarter: point.quarter, source: point.source, sourceUrl: point.sourceUrl }];
	}
	return [point.from, point.to]
		.map((q) => trail.points.find((p) => p.quarter === q))
		.filter((p): p is TrailPoint => p !== undefined)
		.map((p) => ({ quarter: p.quarter, source: p.source, sourceUrl: p.sourceUrl }));
}
