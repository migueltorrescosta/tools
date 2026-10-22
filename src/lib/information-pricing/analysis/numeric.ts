/**
 * Numeric kernels shared by the analysis: summation, quantiles, linspace and a
 * stable argsort. Each mirrors NumPy's arithmetic order so results match the
 * reference implementation to the last bit where practical.
 */

import type { Scenarios } from '../types';

/**
 * Row-major opportunity-loss matrix, `n × D`: entry `i * D + d` is
 * `optimal[i] - rewards[d][i]`. One allocation shared by the analyses.
 */
export function lossMatrix(s: Scenarios): Float64Array {
	const n = s.n;
	const D = s.rewards.length;
	const out = new Float64Array(n * D);
	for (let d = 0; d < D; d++) {
		const r = s.rewards[d];
		for (let i = 0, k = d; i < n; i++, k += D) out[k] = s.optimal[i] - r[i];
	}
	return out;
}

/** NumPy's pairwise float64 sum of `n` values starting at `offset`, `stride` apart. */
export function pairwiseSum(a: ArrayLike<number>, offset: number, n: number, stride = 1): number {
	if (n < 8) {
		let res = -0;
		for (let i = 0; i < n; i++) res += a[offset + i * stride];
		return res;
	}
	if (n <= 128) {
		let r0 = a[offset];
		let r1 = a[offset + stride];
		let r2 = a[offset + 2 * stride];
		let r3 = a[offset + 3 * stride];
		let r4 = a[offset + 4 * stride];
		let r5 = a[offset + 5 * stride];
		let r6 = a[offset + 6 * stride];
		let r7 = a[offset + 7 * stride];
		const end = n - (n % 8);
		let i = 8;
		for (; i < end; i += 8) {
			const p = offset + i * stride;
			r0 += a[p];
			r1 += a[p + stride];
			r2 += a[p + 2 * stride];
			r3 += a[p + 3 * stride];
			r4 += a[p + 4 * stride];
			r5 += a[p + 5 * stride];
			r6 += a[p + 6 * stride];
			r7 += a[p + 7 * stride];
		}
		let res = r0 + r1 + (r2 + r3) + (r4 + r5 + (r6 + r7));
		for (; i < n; i++) res += a[offset + i * stride];
		return res;
	}
	let n2 = Math.floor(n / 2);
	n2 -= n2 % 8;
	return pairwiseSum(a, offset, n2, stride) + pairwiseSum(a, offset + n2 * stride, n - n2, stride);
}

/** `np.linspace(start, stop, num)` with NumPy's arithmetic. */
export function linspace(start: number, stop: number, num: number): Float64Array {
	const y = new Float64Array(num);
	if (num === 0) return y;
	if (num === 1) {
		y[0] = start;
		return y;
	}
	const div = num - 1;
	const delta = stop - start;
	const step = delta / div;
	for (let i = 0; i < num; i++) y[i] = (step === 0 ? (i / div) * delta : i * step) + start;
	y[num - 1] = stop;
	return y;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** The next float64 above `x` (`np.nextafter(x, +inf)` for finite x). */
export function nextUp(x: number): number {
	if (Number.isNaN(x) || x === Infinity) return x;
	if (x === 0) return Number.MIN_VALUE;
	f64[0] = x;
	if (x > 0) {
		if (u32[0] === 0xffffffff) {
			u32[0] = 0;
			u32[1]++;
		} else u32[0]++;
	} else if (u32[0] === 0) {
		u32[0] = 0xffffffff;
		u32[1]--;
	} else u32[0]--;
	return f64[0];
}

/** The float64 next to `x` towards zero. */
export function nextTowardZero(x: number): number {
	if (x === 0 || !Number.isFinite(x)) return x;
	f64[0] = x;
	if (u32[0] === 0) {
		u32[0] = 0xffffffff;
		u32[1]--;
	} else u32[0]--;
	return f64[0];
}

/**
 * `np.quantile(x, q)` with the default linear method, given `x` sorted
 * ascending (the partition NumPy uses yields the same order statistics).
 */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
	const n = sorted.length;
	if (n === 0) return NaN;
	const v = (n - 1) * q;
	let prev: number;
	let next: number;
	let prevIndex = Math.floor(v);
	if (v >= n - 1) {
		prev = next = n - 1;
		prevIndex = -1;
	} else if (v < 0) {
		prev = next = 0;
		prevIndex = 0;
	} else {
		prev = prevIndex;
		next = prevIndex + 1;
	}
	const t = v - prevIndex;
	const a = sorted[prev];
	const b = sorted[next];
	const diff = b - a;
	return t >= 0.5 ? b - diff * (1 - t) : a + diff * t;
}

/** Index of the first minimum (`np.argmin`, NaN-free input). */
export function argmin(a: ArrayLike<number>, offset = 0, n = a.length - offset): number {
	let best = 0;
	let value = a[offset];
	for (let i = 1; i < n; i++) {
		if (a[offset + i] < value) {
			value = a[offset + i];
			best = i;
		}
	}
	return best;
}

const SMALL_SORT = 1024;

/** Sortable unsigned keys of float64 bits (-0 folded into +0). */
function radixKeys(values: Float64Array): { lo: Uint32Array; hi: Uint32Array } {
	const n = values.length;
	const copy = new Float64Array(n);
	for (let i = 0; i < n; i++) copy[i] = values[i] + 0;
	const bits = new Uint32Array(copy.buffer);
	const lo = new Uint32Array(n);
	const hi = new Uint32Array(n);
	for (let i = 0; i < n; i++) {
		const l = bits[2 * i];
		const h = bits[2 * i + 1];
		if (h & 0x80000000) {
			hi[i] = ~h >>> 0;
			lo[i] = ~l >>> 0;
		} else {
			hi[i] = (h | 0x80000000) >>> 0;
			lo[i] = l;
		}
	}
	return { lo, hi };
}

/**
 * LSD radix sort on (hi, lo) keys, 16 bits per pass, carrying an optional
 * payload. Stable. Returns the sorted arrays (possibly the inputs, reused).
 */
function radixPasses(
	lo: Uint32Array,
	hi: Uint32Array,
	payload: Uint32Array | null
): { lo: Uint32Array; hi: Uint32Array; payload: Uint32Array | null } {
	const n = lo.length;
	const counts = new Uint32Array(4 * 65536);
	for (let i = 0; i < n; i++) {
		counts[lo[i] & 0xffff]++;
		counts[65536 + (lo[i] >>> 16)]++;
		counts[131072 + (hi[i] & 0xffff)]++;
		counts[196608 + (hi[i] >>> 16)]++;
	}
	let lo2: Uint32Array = new Uint32Array(n);
	let hi2: Uint32Array = new Uint32Array(n);
	let p2: Uint32Array | null = payload ? new Uint32Array(n) : null;
	for (let pass = 0; pass < 4; pass++) {
		const base = pass * 65536;
		const keys = pass >= 2 ? hi : lo;
		const shift = pass % 2 === 0 ? 0 : 16;
		if (counts[base + ((keys[0] >>> shift) & 0xffff)] === n) continue;
		let sum = 0;
		for (let b = 0; b < 65536; b++) {
			const c = counts[base + b];
			counts[base + b] = sum;
			sum += c;
		}
		for (let i = 0; i < n; i++) {
			const pos = counts[base + ((keys[i] >>> shift) & 0xffff)]++;
			lo2[pos] = lo[i];
			hi2[pos] = hi[i];
			if (payload) p2![pos] = payload[i];
		}
		[lo, lo2] = [lo2, lo];
		[hi, hi2] = [hi2, hi];
		if (payload) [payload, p2] = [p2, payload];
	}
	return { lo, hi, payload };
}

/**
 * Stable ascending argsort of float64 values (`np.argsort(kind="stable")`):
 * ties keep their input order, and -0 ties with +0. LSD radix sort on the
 * IEEE bits for large inputs. NaN-free input.
 */
export function argsortStable(values: Float64Array): Uint32Array {
	const n = values.length;
	const idx = new Uint32Array(n);
	for (let i = 0; i < n; i++) idx[i] = i;
	if (n <= SMALL_SORT) return idx.sort((a, b) => values[a] - values[b] || a - b);
	const { lo, hi } = radixKeys(values);
	return radixPasses(lo, hi, idx).payload!;
}

/** Ascending copy of a NaN-free column (radix sort; -0 becomes +0). */
export function sortedCopy(column: Float64Array): Float64Array {
	const n = column.length;
	if (n <= SMALL_SORT) return Float64Array.from(column, (v) => v + 0).sort();
	const keys = radixKeys(column);
	const sorted = radixPasses(keys.lo, keys.hi, null);
	const out = new Float64Array(n);
	const bits = new Uint32Array(out.buffer);
	for (let i = 0; i < n; i++) {
		const h = sorted.hi[i];
		if (h & 0x80000000) {
			bits[2 * i + 1] = (h & 0x7fffffff) >>> 0;
			bits[2 * i] = sorted.lo[i];
		} else {
			bits[2 * i + 1] = ~h >>> 0;
			bits[2 * i] = ~sorted.lo[i] >>> 0;
		}
	}
	return out;
}
