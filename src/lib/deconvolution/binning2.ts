/**
 * Bins a 2D sample into a bins × bins grid of equal cells over its bounding box,
 * keeping non-empty cells; small samples are returned as is with weight 1.
 */
export function binData2(
	x: Float64Array,
	y: Float64Array,
	maxPoints = 1000,
	bins = 40
): { x: Float64Array; y: Float64Array; c: Float64Array } {
	const n = x.length;
	if (n !== y.length) throw new Error('x and y must have the same length');
	if (n <= maxPoints) {
		const xOut = new Float64Array(n);
		const yOut = new Float64Array(n);
		const c = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			xOut[i] = x[i];
			yOut[i] = y[i];
			c[i] = 1;
		}
		return { x: xOut, y: yOut, c };
	}

	let xlo = Infinity;
	let xhi = -Infinity;
	let ylo = Infinity;
	let yhi = -Infinity;
	for (let i = 0; i < n; i++) {
		const xi = x[i];
		const yi = y[i];
		if (xi < xlo) xlo = xi;
		if (xi > xhi) xhi = xi;
		if (yi < ylo) ylo = yi;
		if (yi > yhi) yhi = yi;
	}

	const xwidth = xhi - xlo;
	const ywidth = yhi - ylo;

	// Degenerate axis: use one bin on that axis
	const xbins = xwidth === 0 ? 1 : bins;
	const ybins = ywidth === 0 ? 1 : bins;

	const hx = xwidth === 0 ? 1 : xwidth / xbins;
	const hy = ywidth === 0 ? 1 : ywidth / ybins;

	const counts = new Float64Array(xbins * ybins);
	for (let i = 0; i < n; i++) {
		const xi = x[i];
		const yi = y[i];
		let xi_idx: number;
		let yi_idx: number;
		if (xwidth === 0) {
			xi_idx = 0;
		} else {
			xi_idx = Math.min(xbins - 1, Math.floor((xi - xlo) / hx));
		}
		if (ywidth === 0) {
			yi_idx = 0;
		} else {
			yi_idx = Math.min(ybins - 1, Math.floor((yi - ylo) / hy));
		}
		counts[yi_idx * xbins + xi_idx]++;
	}

	let nonEmpty = 0;
	for (let i = 0; i < counts.length; i++) if (counts[i] > 0) nonEmpty++;

	const xOut = new Float64Array(nonEmpty);
	const yOut = new Float64Array(nonEmpty);
	const c = new Float64Array(nonEmpty);
	let j = 0;
	for (let yi = 0; yi < ybins; yi++) {
		for (let xi = 0; xi < xbins; xi++) {
			const idx = yi * xbins + xi;
			if (counts[idx] > 0) {
				xOut[j] = xwidth === 0 ? xlo : xlo + (xi + 0.5) * hx;
				yOut[j] = ywidth === 0 ? ylo : ylo + (yi + 0.5) * hy;
				c[j] = counts[idx];
				j++;
			}
		}
	}
	return { x: xOut, y: yOut, c };
}
