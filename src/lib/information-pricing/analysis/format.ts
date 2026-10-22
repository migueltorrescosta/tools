/**
 * Python-compatible number formatting: `repr(float)`, `f"{x:.Nf}"`,
 * `f"{x:.Ng}"` and `round(x)`, so labels match the reference implementation
 * (half-to-even on exact ties, where JavaScript rounds half away from zero).
 */

import { nextTowardZero } from './numeric';

const view = new DataView(new ArrayBuffer(8));

/** Whether `x · 10^digits` sits exactly halfway between two integers. */
export function isHalfway(x: number, digits: number): boolean {
	if (!Number.isFinite(x) || x === 0) return false;
	view.setFloat64(0, x);
	const hi = view.getUint32(0);
	const lo = view.getUint32(4);
	const exponentBits = (hi >>> 20) & 0x7ff;
	let mantissa = BigInt(hi & 0xfffff) * 4294967296n + BigInt(lo);
	let exponent: number;
	if (exponentBits === 0) exponent = -1074;
	else {
		mantissa += 1n << 52n;
		exponent = exponentBits - 1075;
	}
	// 2 · x · 10^digits must be an odd integer.
	let num = mantissa;
	let den = 1n;
	const e = exponent + 1;
	if (e >= 0) num <<= BigInt(e);
	else den <<= BigInt(-e);
	if (digits >= 0) num *= 10n ** BigInt(digits);
	else den *= 10n ** BigInt(-digits);
	if (num % den !== 0n) return false;
	return (num / den) % 2n === 1n;
}

function lastDigitOdd(s: string): boolean {
	const mantissa = s.split('e')[0];
	const digit = mantissa.charCodeAt(mantissa.length - 1) - 48;
	return digit % 2 === 1;
}

/** Python `round(x)`: nearest integer, ties to even. */
export function roundHalfEven(x: number): number {
	if (!Number.isFinite(x)) return x;
	const floor = Math.floor(x);
	const diff = x - floor;
	if (diff < 0.5) return floor;
	if (diff > 0.5) return floor + 1;
	return floor % 2 === 0 ? floor : floor + 1;
}

/** Python `f"{x:.{digits}f}"`. */
export function pyFixed(x: number, digits: number): string {
	if (Number.isNaN(x)) return 'nan';
	if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
	if (Math.abs(x) >= 1e21)
		return BigInt(x).toString() + (digits > 0 ? '.' + '0'.repeat(digits) : '');
	let s = x.toFixed(digits);
	if (isHalfway(x, digits) && lastDigitOdd(s)) s = nextTowardZero(x).toFixed(digits);
	if (Object.is(x, -0) || (x < 0 && !s.startsWith('-'))) s = '-' + s;
	return s;
}

/** `f"{x:.{digits}f}".rstrip("0").rstrip(".")`, the loss table format. */
export function pyFixedTrimmed(x: number, digits: number): string {
	const s = pyFixed(x, digits);
	if (!s.includes('.')) return s;
	return s.replace(/0+$/, '').replace(/\.$/, '');
}

function exponential(x: number, digits: number): string {
	const exponent = Number(x.toExponential().split('e')[1]);
	let s = x.toExponential(digits);
	if (isHalfway(x, digits - exponent) && lastDigitOdd(s))
		s = nextTowardZero(x).toExponential(digits);
	return s;
}

/** Python `f"{x:.{precision}g}"`. */
export function pyGeneral(x: number, precision = 6): string {
	if (Number.isNaN(x)) return 'nan';
	if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
	const p = Math.max(precision, 1);
	if (x === 0) return Object.is(x, -0) ? '-0' : '0';
	const s = exponential(x, p - 1);
	const exponent = Number(s.split('e')[1]);
	if (exponent >= -4 && exponent < p) {
		const fixed = pyFixed(x, p - 1 - exponent);
		return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
	}
	let mantissa = s.split('e')[0];
	if (mantissa.includes('.')) mantissa = mantissa.replace(/0+$/, '').replace(/\.$/, '');
	const sign = exponent < 0 ? '-' : '+';
	return `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

/** Python `repr(float)`: shortest round-trip digits, Python's layout. */
export function pyRepr(x: number): string {
	if (Number.isNaN(x)) return 'nan';
	if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
	if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
	const [mantissa, exp] = x.toExponential().split('e');
	const exponent = Number(exp);
	const negative = mantissa.startsWith('-');
	const digits = mantissa.replace('-', '').replace('.', '');
	const sign = negative ? '-' : '';
	if (exponent >= -4 && exponent < 16) {
		if (exponent < 0) return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
		const intPart = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0');
		const frac = digits.slice(exponent + 1);
		return `${sign}${intPart}.${frac || '0'}`;
	}
	const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
	return `${sign}${m}e${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

/** Python `str(round(x))` for finite x, an en dash otherwise (tree savings labels). */
export function pyRoundString(x: number): string {
	if (!Number.isFinite(x)) return '–';
	const r = roundHalfEven(x);
	if (Math.abs(r) >= 1e21) return BigInt(r).toString();
	return Object.is(r, -0) ? '0' : String(r);
}
