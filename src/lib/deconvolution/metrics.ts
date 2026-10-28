/**
 * Error metrics for deconvolution estimates on a common grid.
 */
import type { Dist, Grid, GridEstimate } from './types';
import { discretise } from './grid';

/** `d` as cell masses on `grid` (via `discretise`), renormalised to sum 1. */
export function truthOnGrid(d: Dist, grid: Grid): GridEstimate {
	const mass = discretise(d, grid);
	let sum = 0;
	for (let j = 0; j < mass.length; j++) sum += mass[j];
	if (sum === 0) return { grid, mass: new Float64Array(grid.m) };
	const out = new Float64Array(grid.m);
	for (let j = 0; j < grid.m; j++) out[j] = mass[j] / sum;
	return { grid, mass: out };
}

/** Wasserstein-1 distance h·Σ|F_a − F_b| between two estimates on the same grid (throws if the grids differ). */
export function wasserstein1(a: GridEstimate, b: GridEstimate): number {
	if (a.grid.x0 !== b.grid.x0 || a.grid.h !== b.grid.h || a.grid.m !== b.grid.m) {
		throw new Error('Grids differ');
	}
	const { h, m } = a.grid;
	let sum = 0;
	let ca = 0;
	let cb = 0;
	for (let j = 0; j < m; j++) {
		ca += a.mass[j];
		cb += b.mass[j];
		sum += Math.abs(ca - cb);
	}
	return sum * h;
}

/** L1 distance Σ|m_a − m_b| between cell masses (twice the total variation; works for discrete truths too). */
export function l1(a: GridEstimate, b: GridEstimate): number {
	if (a.grid.x0 !== b.grid.x0 || a.grid.h !== b.grid.h || a.grid.m !== b.grid.m) {
		throw new Error('Grids differ');
	}
	const { m } = a.grid;
	let sum = 0;
	for (let j = 0; j < m; j++) {
		sum += Math.abs(a.mass[j] - b.mass[j]);
	}
	return sum;
}
