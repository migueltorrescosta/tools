/**
 * Number formatting and axis scales for the Information Pricing results.
 * Values arrive in native units; the page shows them in the analysis'
 * auto-scaled display unit.
 */
import { scaledValue } from '$lib/information-pricing/analysis';

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

/** A linear map from [d0, d1] onto [r0, r1]; a flat domain maps to the middle. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	if (!(d1 !== d0) || !Number.isFinite(d0) || !Number.isFinite(d1)) return () => (r0 + r1) / 2;
	const k = (r1 - r0) / (d1 - d0);
	return (v) => r0 + (v - d0) * k;
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

/** CSS colour of categorical slot `i` (0-based), cycling through the 12 data colours. */
export function dataColour(i: number): string {
	return `var(--data-${(((i % 12) + 12) % 12) + 1})`;
}

/** SVG path through points, skipping non-finite ones (a gap starts a new segment). */
export function linePath(xs: ArrayLike<number>, ys: ArrayLike<number>): string {
	let d = '';
	let pen = false;
	for (let i = 0; i < xs.length; i++) {
		const x = xs[i];
		const y = ys[i];
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
		pen = true;
	}
	return d;
}

/** Log-axis tick label: 0.01, 1, 100, 10k, 1M. */
export function formatLogTick(v: number): string {
	if (v >= 1000) return v.toLocaleString('en', { notation: 'compact' });
	return String(Number(v.toPrecision(3)));
}
