/**
 * Bins a 2D sample into a bins × bins grid of equal cells over its bounding box,
 * keeping non-empty cells; small samples are returned as is with weight 1.
 * A constant axis gets a single bin. No DOM or Svelte imports.
 */
export function binData2(
	x: Float64Array,
	y: Float64Array,
	maxPoints = 1000,
	bins = 40
): { x: Float64Array; y: Float64Array; c: Float64Array } {
	const n = x.length;
	if (n !== y.length) throw new Error('x and y must have the same length');
	if (n <= maxPoints) return { x: x.slice(), y: y.slice(), c: new Float64Array(n).fill(1) };
	let [xlo, xhi, ylo, yhi] = [Infinity, -Infinity, Infinity, -Infinity];
	for (let i = 0; i < n; i++) {
		xlo = Math.min(xlo, x[i]);
		xhi = Math.max(xhi, x[i]);
		ylo = Math.min(ylo, y[i]);
		yhi = Math.max(yhi, y[i]);
	}
	const xbins = xhi > xlo ? bins : 1;
	const ybins = yhi > ylo ? bins : 1;
	const hx = (xhi - xlo) / xbins || 1;
	const hy = (yhi - ylo) / ybins || 1;
	const counts = new Float64Array(xbins * ybins);
	for (let i = 0; i < n; i++) {
		const bx = Math.min(xbins - 1, Math.floor((x[i] - xlo) / hx));
		const by = Math.min(ybins - 1, Math.floor((y[i] - ylo) / hy));
		counts[by * xbins + bx]++;
	}
	const xs: number[] = [];
	const ys: number[] = [];
	const cs: number[] = [];
	for (let k = 0; k < counts.length; k++) {
		if (counts[k] === 0) continue;
		// A constant axis keeps its value; otherwise the cell's centre.
		xs.push(xbins === 1 ? xlo : xlo + ((k % xbins) + 0.5) * hx);
		ys.push(ybins === 1 ? ylo : ylo + (Math.floor(k / xbins) + 0.5) * hy);
		cs.push(counts[k]);
	}
	return { x: Float64Array.from(xs), y: Float64Array.from(ys), c: Float64Array.from(cs) };
}
