/**
 * 2D error metrics for deconvolution estimates on a common grid.
 * No DOM or Svelte imports.
 */
import type { GridEstimate2 } from './dist2';

/** Throws 'Grids differ' unless both estimates share one grid. */
function sameGrid(a: GridEstimate2, b: GridEstimate2): void {
	const [g, h] = [a.grid, b.grid];
	if (
		g.x0 !== h.x0 ||
		g.hx !== h.hx ||
		g.mx !== h.mx ||
		g.y0 !== h.y0 ||
		g.hy !== h.hy ||
		g.my !== h.my
	)
		throw new Error('Grids differ');
}

/** Σ|m_a − m_b| (throws 'Grids differ' when the grids differ). */
export function l1_2(a: GridEstimate2, b: GridEstimate2): number {
	sameGrid(a, b);
	let sum = 0;
	for (let k = 0; k < a.mass.length; k++) sum += Math.abs(a.mass[k] - b.mass[k]);
	return sum;
}

/**
 * Sliced Wasserstein-1: the mean over `directions` equally spaced angles θ in [0, π)
 * of the 1D W1 between the two mass distributions projected on (cos θ, sin θ),
 * each cell's mass placed at its centre (x0 + i·hx, y0 + j·hy).
 */
export function slicedW1(a: GridEstimate2, b: GridEstimate2, directions = 32): number {
	sameGrid(a, b);
	const { x0, hx, mx, y0, hy } = a.grid;
	// Only cells holding mass in either estimate matter.
	const cells: number[] = [];
	for (let k = 0; k < a.mass.length; k++) if (a.mass[k] !== 0 || b.mass[k] !== 0) cells.push(k);
	if (cells.length === 0) return 0;
	const proj = new Float64Array(a.mass.length);
	let total = 0;
	for (let d = 0; d < directions; d++) {
		const theta = (Math.PI * d) / directions;
		const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
		for (const k of cells)
			proj[k] = (x0 + (k % mx) * hx) * cos + (y0 + Math.floor(k / mx) * hy) * sin;
		const order = [...cells].sort((p, q) => proj[p] - proj[q]);
		// W1 in 1D: ∫|F_a − F_b|, accumulated in projected order.
		let fa = 0;
		let fb = 0;
		for (let r = 0; r < order.length - 1; r++) {
			fa += a.mass[order[r]];
			fb += b.mass[order[r]];
			total += Math.abs(fa - fb) * (proj[order[r + 1]] - proj[order[r]]);
		}
	}
	return total / directions;
}
