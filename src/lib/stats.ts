/** Small statistics helpers shared by the tools. No DOM or Svelte imports. */

/** Mean and variance (dividing by the total weight) of values with optional weights. */
export function moments(
	x: ArrayLike<number>,
	w?: ArrayLike<number>
): { mean: number; variance: number; n: number } {
	let n = 0;
	let s = 0;
	for (let i = 0; i < x.length; i++) {
		const c = w ? w[i] : 1;
		n += c;
		s += c * x[i];
	}
	const mean = s / n;
	let v = 0;
	for (let i = 0; i < x.length; i++) v += (w ? w[i] : 1) * (x[i] - mean) ** 2;
	return { mean, variance: v / n, n };
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
