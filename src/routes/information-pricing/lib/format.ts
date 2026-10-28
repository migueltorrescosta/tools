/**
 * Number formatting and axis scales for the Information Pricing results.
 * Values arrive in native units; the page shows them in the analysis'
 * auto-scaled display unit.
 */
import { scaledValue } from '$lib/information-pricing/analysis';
import { linear } from '$lib/plot';

export { dataColour, linear, linePath } from '$lib/plot';

/** A display-unit number with about three significant digits and thousands separators. */
export function formatNumber(v: number): string {
	if (!Number.isFinite(v)) return '–';
	const a = Math.abs(v);
	const digits = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a === 0 ? 0 : 3;
	return v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** Formats native values in the display unit: `fmt(12345)` → `12.3 k€`. */
export interface Money {
	exponent: number;
	unit: string;
	/** Native value → display-unit number. */
	scale: (v: number) => number;
	/** Native value → text with the unit. */
	format: (v: number) => string;
}

export function money(exponent: number, unit: string): Money {
	const scale = (v: number) => scaledValue(v, exponent);
	return {
		exponent,
		unit,
		scale,
		format: (v) => (unit ? `${formatNumber(scale(v))} ${unit}` : formatNumber(scale(v)))
	};
}

/** A log10 map from [d0, d1] (both > 0) onto [r0, r1]; values at or below d0 land on r0. */
export function logScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const l0 = Math.log10(d0);
	const l1 = Math.log10(d1);
	const map = linear(l0, l1, r0, r1);
	return (v) => map(Math.log10(Math.max(v, d0)));
}

/** Decade ticks covering [lo, hi], at most about `max` of them. */
export function logTicks(lo: number, hi: number, max = 6): number[] {
	if (!(lo > 0) || !(hi >= lo)) return [];
	const a = Math.floor(Math.log10(lo));
	const b = Math.ceil(Math.log10(hi));
	const every = Math.max(1, Math.ceil((b - a) / max));
	const out: number[] = [];
	for (let e = a; e <= b; e += every) out.push(10 ** e);
	return out;
}

/** Log-axis domain for positive values: decades around the smallest positive and largest value. */
export function logDomain(values: Iterable<number>): [number, number] {
	let lo = Infinity;
	let hi = 0;
	for (const v of values) {
		if (v > 0 && v < lo) lo = v;
		if (v > hi) hi = v;
	}
	if (!(hi > 0)) return [0.1, 1];
	if (!Number.isFinite(lo)) lo = hi;
	return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))];
}

/** CSS colour of random input `i` (0-based, model order), cycling through the 9 input colours. */
export function inputColour(i: number): string {
	return `var(--input-${(((i % 9) + 9) % 9) + 1})`;
}

/** Log-axis tick label: 0.01, 1, 100, 10k, 1M. */
export function formatLogTick(v: number): string {
	if (v >= 1000) return v.toLocaleString('en', { notation: 'compact' });
	return String(Number(v.toPrecision(3)));
}

/** Short tick label for small plots: 0.25, 1,200, 35k, 350M. */
export function compactTick(v: number, digits = 3): string {
	if (v === 0) return '0';
	return v.toLocaleString('en', { notation: 'compact', maximumSignificantDigits: digits });
}

/**
 * Policy-tree edge labels for a split's ascending thresholds, in the axes' compact
 * format: `≤ 5.06M`, `2.37 to 3.37`, `> 3.37`. Adds digits until neighbours differ.
 */
export function thresholdLabels(thresholds: readonly number[]): string[] {
	let t = thresholds.map((v) => compactTick(v));
	for (let d = 4; d <= 8 && new Set(t).size < t.length; d++)
		t = thresholds.map((v) => compactTick(v, d));
	const last = t.length;
	return Array.from({ length: last + 1 }, (_, c) =>
		c === 0 ? `≤ ${t[0]}` : c === last ? `> ${t[last - 1]}` : `${t[c - 1]} to ${t[c]}`
	);
}

/** Exact power of ten, `pow10(-2)` → 0.01 (no `10 ** -2` rounding). */
const pow10 = (k: number) => Number(`1e${k}`);

/** The decade of a positive finite `v`: the k with 10^k ≤ v < 10^(k+1), exact on powers of 10. */
function decadeOf(v: number): number {
	let k = Math.floor(Math.log10(v));
	// log10 can land a hair off on exact powers; fix the decade against the real powers.
	if (pow10(k) > v) k--;
	else if (pow10(k + 1) <= v) k++;
	return k;
}

/** Savings at or below this share of the EVPI are rounding noise, not savings. */
export const NOISE = 1e-6;

/**
 * Log y bounds for the value-of-information chart, tight around the data (all
 * in display units): the top is the next power of 10 above the EVPI (one up
 * when the EVPI is itself a power of 10), the bottom the largest power of 10
 * at or below the smallest positive savings, and at least one decade between
 * them. Savings under a millionth of the EVPI are rounding noise (a tie
 * between decisions sums to ±1e-14, not 0) and count as zero. With no positive
 * savings the bottom is one decade below the EVPI's.
 * `voiBounds(66.7, [3.2, 41])` → `[1, 100]`. Null when the EVPI isn't positive and finite.
 */
export function voiBounds(evpi: number, savings: Iterable<number>): [number, number] | null {
	if (!(evpi > 0) || !Number.isFinite(evpi)) return null;
	const top = decadeOf(evpi) + 1;
	const noise = evpi * NOISE;
	let least = Infinity;
	for (const v of savings) if (v > noise && v < least) least = v;
	const bottom = Number.isFinite(least) ? Math.min(decadeOf(least), top - 1) : top - 2;
	return [pow10(bottom), pow10(top)];
}

/**
 * Log bounds spanning three decades below the smallest power of 10 above
 * `max` (one up when `max` is itself a power of 10), as `voiBounds` tops out.
 * `logDecadeBounds(42)` → `[0.1, 100]`. Null when `max` isn't positive and finite.
 */
export function logDecadeBounds(max: number): [number, number] | null {
	if (!(max > 0) || !Number.isFinite(max)) return null;
	const top = decadeOf(max) + 1;
	return [pow10(top - 3), pow10(top)];
}

/** Powers of ten from `lo` to `hi`, both powers of ten. */
export function decades(lo: number, hi: number): number[] {
	const a = Math.round(Math.log10(lo));
	const b = Math.round(Math.log10(hi));
	return Array.from({ length: b - a + 1 }, (_, k) => pow10(a + k));
}

/**
 * Nudges label centres (pixels, any order) apart so neighbours sit at least `gap`
 * apart, staying within [lo, hi] when there is room. Returns the new centres in
 * the same order.
 */
export function spreadLabels(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
	const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const out = order.map(([y]) => Math.min(hi, Math.max(lo, y)));
	for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k], out[k - 1] + gap);
	// Pushed past the bottom: shift the tail back up, keeping the gaps.
	if (out.length && out[out.length - 1] > hi) {
		out[out.length - 1] = Math.max(hi, lo + gap * (out.length - 1));
		for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
	}
	const result = new Array<number>(ys.length);
	order.forEach(([, i], k) => (result[i] = out[k]));
	return result;
}

/** Dash patterns that tell the value-of-information lines apart (cycled). */
const DASHES = ['', '7 3', '2 2.5', '9 3 2 3', '4 4', '12 3 2 3 2 3'] as const;
/** Input `i`'s dash pattern, its lengths times `scale` (to keep step with a thicker stroke). */
export const dash = (i: number, scale = 1) =>
	DASHES[i % DASHES.length]
		.split(' ')
		.filter(Boolean)
		.map((n) => +(Number(n) * scale).toFixed(2))
		.join(' ');

/** A point label: text anchor position and alignment, in pixels. */
interface PlacedLabel {
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
}

/**
 * Places an 11 px high label of `width` pixels next to each point (pixels, radius 5),
 * trying right, left, above, below and then further out, and keeping the
 * first spot that clears the other points, the labels placed so far and the
 * frame `[x0, x1] × [y0, y1]`. A label with no free spot takes the right.
 * `y` is the text baseline. Returns one placement per point, in order.
 */
export function placeLabels(
	points: readonly { x: number; y: number; width: number }[],
	frame: { x0: number; x1: number; y0: number; y1: number }
): PlacedLabel[] {
	const height = 11;
	const radius = 5;
	type Box = [number, number, number, number];
	const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
	const taken: Box[] = points.map((p) => [p.x - radius, p.y - radius, p.x + radius, p.y + radius]);
	return points.map((p, i) => {
		const g = radius + 2;
		const candidates: PlacedLabel[] = [
			{ x: p.x + g, y: p.y + height / 2 - 1, anchor: 'start' },
			{ x: p.x - g, y: p.y + height / 2 - 1, anchor: 'end' },
			{ x: p.x, y: p.y - g, anchor: 'middle' },
			{ x: p.x, y: p.y + g + height - 1, anchor: 'middle' },
			...[-1, 1].flatMap((s) => [
				{ x: p.x + g, y: p.y + s * height + height / 2 - 1, anchor: 'start' as const },
				{ x: p.x - g, y: p.y + s * height + height / 2 - 1, anchor: 'end' as const }
			])
		];
		const box = (c: PlacedLabel): Box => {
			const left =
				c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - p.width : c.x - p.width / 2;
			return [left, c.y - height + 1, left + p.width, c.y + 1];
		};
		const fits = (b: Box) =>
			b[0] >= frame.x0 &&
			b[2] <= frame.x1 &&
			b[1] >= frame.y0 &&
			b[3] <= frame.y1 &&
			taken.every((t, k) => k === i || !overlaps(b, t));
		const pick = candidates.find((c) => fits(box(c))) ?? candidates[0];
		taken.push(box(pick));
		return pick;
	});
}
