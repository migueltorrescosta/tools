/**
 * 2D error metrics for deconvolution estimates on a common grid.
 * No DOM or Svelte imports.
 */
import type { GridEstimate2 } from './dist2';

/** Σ|m_a − m_b| (throws 'Grids differ' when the grids differ). */
export function l1_2(a: GridEstimate2, b: GridEstimate2): number {
	const ga = a.grid;
	const gb = b.grid;
	if (
		ga.x0 !== gb.x0 ||
		ga.hx !== gb.hx ||
		ga.mx !== gb.mx ||
		ga.y0 !== gb.y0 ||
		ga.hy !== gb.hy ||
		ga.my !== gb.my
	) {
		throw new Error('Grids differ');
	}
	const { mx, my } = ga;
	let sum = 0;
	for (let j = 0; j < my; j++) {
		const base = j * mx;
		for (let i = 0; i < mx; i++) {
			sum += Math.abs(a.mass[base + i] - b.mass[base + i]);
		}
	}
	return sum;
}

/** 1D W1 between two weighted point sets at the same positions. */
function w1_1d(pos: Float64Array, massA: Float64Array, massB: Float64Array): number {
	const m = pos.length;
	if (m === 0) return 0;
	// Positions are already sorted (we ensure this before calling)
	let sum = 0;
	let ca = 0;
	let cb = 0;
	for (let i = 0; i < m - 1; i++) {
		ca += massA[i];
		cb += massB[i];
		sum += Math.abs(ca - cb) * (pos[i + 1] - pos[i]);
	}
	return sum;
}

/**
 * Sliced Wasserstein-1: the mean over `directions` equally spaced angles θ in [0, π)
 * of the 1D W1 between the two mass distributions projected on (cos θ, sin θ),
 * each cell's mass placed at its centre (x0 + i·hx, y0 + j·hy).
 */
export function slicedW1(a: GridEstimate2, b: GridEstimate2, directions = 32): number {
	const ga = a.grid;
	const gb = b.grid;
	if (
		ga.x0 !== gb.x0 ||
		ga.hx !== gb.hx ||
		ga.mx !== gb.mx ||
		ga.y0 !== gb.y0 ||
		ga.hy !== gb.hy ||
		ga.my !== gb.my
	) {
		throw new Error('Grids differ');
	}

	const { x0, hx, mx, y0, hy, my } = ga;

	// Collect non-zero mass cells with their centers
	type Cell = { x: number; y: number; ma: number; mb: number };
	const cells: Cell[] = [];
	for (let j = 0; j < my; j++) {
		const base = j * mx;
		const yc = y0 + j * hy;
		for (let i = 0; i < mx; i++) {
			const idx = base + i;
			const ma = a.mass[idx];
			const mb = b.mass[idx];
			if (ma !== 0 || mb !== 0) {
				cells.push({ x: x0 + i * hx, y: yc, ma, mb });
			}
		}
	}

	if (cells.length === 0) return 0;

	let totalW1 = 0;
	for (let d = 0; d < directions; d++) {
		const theta = (Math.PI * d) / directions;
		const cos = Math.cos(theta);
		const sin = Math.sin(theta);

		// Project cell centers
		const proj = new Float64Array(cells.length);
		const massA = new Float64Array(cells.length);
		const massB = new Float64Array(cells.length);
		for (let k = 0; k < cells.length; k++) {
			const c = cells[k];
			proj[k] = c.x * cos + c.y * sin;
			massA[k] = c.ma;
			massB[k] = c.mb;
		}

		// Sort by projected position
		const indices = Array.from({ length: cells.length }, (_, i) => i);
		indices.sort((i, j) => proj[i] - proj[j]);

		const sortedProj = new Float64Array(cells.length);
		const sortedA = new Float64Array(cells.length);
		const sortedB = new Float64Array(cells.length);
		for (let k = 0; k < cells.length; k++) {
			const idx = indices[k];
			sortedProj[k] = proj[idx];
			sortedA[k] = massA[idx];
			sortedB[k] = massB[idx];
		}

		totalW1 += w1_1d(sortedProj, sortedA, sortedB);
	}

	return totalW1 / directions;
}
