/**
 * The density of Z = X + Y on a 2D grid and the log-likelihood of a 2D
 * sample, the 2D counterpart of `grid.ts`: X as cell masses on the grid, Y
 * as cell masses on a grid of the same steps centred on 0 and twice as wide,
 * convolved by one circular 2D FFT; data points interpolate bilinearly.
 * No DOM or Svelte imports.
 */
import { convolve2, nextPow2 } from '$lib/fft';
import { DENSITY_FLOOR } from './grid';
import type { Dist2, Grid2 } from './dist2';

/** Nodes per axis when the distributions don't force a finer step, and the most allowed. */
export const BASE_NODES_2D = 96;
export const MAX_NODES_2D = 256;
/** Nodes per typical width of each distribution along each axis (by default). */
const NODES_PER_WIDTH = 8;

/** One axis of a grid over [lo, hi] fine enough for the given typical widths. */
function axis(lo: number, hi: number, widths: number[], base: number, max: number, per: number) {
	const span = hi > lo ? hi - lo : 1;
	const want = Math.min(span / (base - 1), ...widths.map((w) => w / per));
	const m = Math.min(max, Math.ceil(span / want) + 1);
	return { x0: lo, h: span / (m - 1), m };
}

/** A grid over a box that resolves X and Y on each axis. */
export function chooseGrid2(
	[xlo, xhi, ylo, yhi]: [number, number, number, number],
	X: Dist2,
	Y: Dist2,
	{ baseNodes = BASE_NODES_2D, maxNodes = MAX_NODES_2D, nodesPerWidth = NODES_PER_WIDTH } = {}
): Grid2 {
	const ax = axis(xlo, xhi, [X.scale[0], Y.scale[0]], baseNodes, maxNodes, nodesPerWidth);
	const ay = axis(ylo, yhi, [X.scale[1], Y.scale[1]], baseNodes, maxNodes, nodesPerWidth);
	return { x0: ax.x0, hx: ax.h, mx: ax.m, y0: ay.x0, hy: ay.h, my: ay.m };
}

/** A box around a 2D sample: its bounding box padded by 2% of each width. */
export function dataBox(
	xs: ArrayLike<number>,
	ys: ArrayLike<number>
): [number, number, number, number] {
	let [a, b, c, d] = [Infinity, -Infinity, Infinity, -Infinity];
	for (let i = 0; i < xs.length; i++) {
		a = Math.min(a, xs[i]);
		b = Math.max(b, xs[i]);
		c = Math.min(c, ys[i]);
		d = Math.max(d, ys[i]);
	}
	const px = 0.02 * (b - a) || 1;
	const py = 0.02 * (d - c) || 1;
	return [a - px, b + px, c - py, d + py];
}

/** A box holding all but about 2·eps of Z's mass. */
export function modelBox2(X: Dist2, Y: Dist2, eps = 1e-3): [number, number, number, number] {
	const x = X.box(eps);
	const y = Y.box(eps);
	return [x[0] + y[0], x[1] + y[1], x[2] + y[2], x[3] + y[3]];
}

/**
 * The grid for a sample's likelihood: its data box, widened to hold X's box
 * (all but 1e-6 of its mass) but never by more than the box's own size per side.
 */
export function likelihoodGrid2(
	X: Dist2,
	Y: Dist2,
	xs: ArrayLike<number>,
	ys: ArrayLike<number>,
	options: { baseNodes?: number; maxNodes?: number; nodesPerWidth?: number } = {}
): Grid2 {
	const [a, b, c, d] = dataBox(xs, ys);
	const [xa, xb, xc, xd] = X.box(1e-6);
	const w = b - a;
	const h = d - c;
	return chooseGrid2(
		[
			Math.max(a - w, Math.min(a, xa)),
			Math.min(b + w, Math.max(b, xb)),
			Math.max(c - h, Math.min(c, xc)),
			Math.min(d + h, Math.max(d, xd))
		],
		X,
		Y,
		options
	);
}

/** Density of Z = X + Y at each node of the grid (row-major by y). */
export function zDensityOnGrid2(X: Dist2, Y: Dist2, g: Grid2): Float64Array {
	const { mx, my, hx, hy } = g;
	const xs = X.masses(g);
	const ys = Y.masses({
		x0: -(mx - 1) * hx,
		hx,
		mx: 2 * mx - 1,
		y0: -(my - 1) * hy,
		hy,
		my: 2 * my - 1
	});
	// Outputs (mx − 1 … 2mx − 2) × (my − 1 … 2my − 2) are free of wrap-around on a 2m torus.
	const nx = nextPow2(2 * mx);
	const ny = nextPow2(2 * my);
	const conv = convolve2(xs, mx, my, ys, 2 * mx - 1, 2 * my - 1, nx, ny);
	const out = new Float64Array(mx * my);
	const cell = hx * hy;
	for (let j = 0; j < my; j++)
		for (let i = 0; i < mx; i++)
			out[j * mx + i] = Math.max(0, conv[(j + my - 1) * nx + i + mx - 1]) / cell;
	return out;
}

/** Bilinear interpolation of grid values at (x, y); 0 outside the grid. */
export function interpolate2(values: Float64Array, g: Grid2, x: number, y: number): number {
	const u = (x - g.x0) / g.hx;
	const v = (y - g.y0) / g.hy;
	if (!(u >= 0 && u <= g.mx - 1 && v >= 0 && v <= g.my - 1)) return 0;
	const i = Math.min(Math.floor(u), g.mx - 2);
	const j = Math.min(Math.floor(v), g.my - 2);
	const fu = u - i;
	const fv = v - j;
	const k = j * g.mx + i;
	return (
		(values[k] * (1 - fu) + values[k + 1] * fu) * (1 - fv) +
		(values[k + g.mx] * (1 - fu) + values[k + g.mx + 1] * fu) * fv
	);
}

/** f_Z at each point; `grid` defaults to `likelihoodGrid2`. */
export function zDensityAt2(
	X: Dist2,
	Y: Dist2,
	xs: ArrayLike<number>,
	ys: ArrayLike<number>,
	grid?: Grid2
): Float64Array {
	const g = grid ?? likelihoodGrid2(X, Y, xs, ys);
	const f = zDensityOnGrid2(X, Y, g);
	return Float64Array.from({ length: xs.length }, (_, i) => interpolate2(f, g, xs[i], ys[i]));
}

/** Σ wᵢ log f_Z(xᵢ, yᵢ), weights 1 when omitted. */
export function logLikelihood2(
	X: Dist2,
	Y: Dist2,
	xs: ArrayLike<number>,
	ys: ArrayLike<number>,
	{ grid, weights }: { grid?: Grid2; weights?: ArrayLike<number> } = {}
): number {
	const f = zDensityAt2(X, Y, xs, ys, grid);
	let s = 0;
	for (let i = 0; i < f.length; i++)
		s += (weights ? weights[i] : 1) * Math.log(Math.max(f[i], DENSITY_FLOOR));
	return s;
}

/** True when the grid's steps resolve X and Y (at least 3 nodes across each typical width). */
export function gridResolves2(g: Grid2, X: Dist2, Y: Dist2): boolean {
	return (
		Math.min(X.scale[0], Y.scale[0]) >= 3 * g.hx && Math.min(X.scale[1], Y.scale[1]) >= 3 * g.hy
	);
}
