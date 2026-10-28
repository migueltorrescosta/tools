/**
 * Bins a sample into equal-width bins, keeping only non-empty bins.
 * Used to compress large datasets for deconvolution.
 */
export function binData(
	data: Float64Array,
	maxPoints = 5000,
	bins = 2000
): { z: Float64Array; c: Float64Array } {
	const n = data.length;
	if (n <= maxPoints) {
		const z = new Float64Array(n);
		const c = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			z[i] = data[i];
			c[i] = 1;
		}
		return { z, c };
	}

	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < n; i++) {
		const v = data[i];
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}

	const width = hi - lo;
	if (width === 0) {
		const z = new Float64Array(1);
		const c = new Float64Array(1);
		z[0] = lo;
		c[0] = n;
		return { z, c };
	}

	const h = width / bins;
	const counts = new Float64Array(bins);
	for (let i = 0; i < n; i++) {
		const idx = Math.min(bins - 1, Math.floor((data[i] - lo) / h));
		counts[idx]++;
	}

	let nonEmpty = 0;
	for (let i = 0; i < bins; i++) if (counts[i] > 0) nonEmpty++;

	const z = new Float64Array(nonEmpty);
	const c = new Float64Array(nonEmpty);
	let j = 0;
	for (let i = 0; i < bins; i++) {
		if (counts[i] > 0) {
			z[j] = lo + (i + 0.5) * h;
			c[j] = counts[i];
			j++;
		}
	}
	return { z, c };
}
