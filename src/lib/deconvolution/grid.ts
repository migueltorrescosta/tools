/**
 * The density of Z = X + Y on a grid, and the log-likelihood of a sample of Z.
 *
 * X is discretised on the grid as cell masses (density × h, or point masses
 * split linearly between the two nearest nodes), Y the same on a grid of the
 * same step centred on 0 and twice as wide, and the two are convolved by FFT.
 * The density at a data point is linearly interpolated. When X and Y are both
 * discrete, Z is too and its pmf is computed exactly instead.
 * No DOM or Svelte imports.
 */
import { convolve } from '$lib/fft';
import type { Atoms, Dist, Grid } from './types';

/** Nodes used across the window when neither distribution forces a finer step. */
export const BASE_NODES = 8192;
/** Most nodes a grid may have; past this the step is coarser than asked (`resolved` false). */
export const MAX_NODES = 65536;
/** Nodes per typical width (the range holding half the mass) of each continuous part. */
const NODES_PER_WIDTH = 16;

export const gridPoints = ({ x0, h, m }: Grid): Float64Array =>
	Float64Array.from({ length: m }, (_, j) => x0 + j * h);

/** Width of the range holding half the mass of a continuous part; Infinity for a discrete one. */
function typicalWidth(d: Dist): number {
	if (d.pdf === null) return Infinity;
	const [lo, hi] = d.range(0.5);
	return hi - lo;
}

/**
 * A grid over [lo, hi] whose step resolves the continuous parts of X and Y.
 * `resolved` is false when that would need more than MAX_NODES nodes.
 */
export function chooseGrid(
	lo: number,
	hi: number,
	X: Dist,
	Y: Dist,
	{ baseNodes = BASE_NODES, maxNodes = MAX_NODES } = {}
): Grid & { resolved: boolean } {
	const width = hi > lo ? hi - lo : 1;
	const want = Math.min(
		width / (baseNodes - 1),
		typicalWidth(X) / NODES_PER_WIDTH,
		typicalWidth(Y) / NODES_PER_WIDTH
	);
	const m = Math.ceil(width / want) + 1;
	const resolved = m <= maxNodes;
	const nodes = Math.min(m, maxNodes);
	return { x0: lo, h: width / (nodes - 1), m: nodes, resolved };
}

/** A window around a sample: its range padded by 2% of the width each side. */
export function dataWindow(data: ArrayLike<number>): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < data.length; i++) {
		lo = Math.min(lo, data[i]);
		hi = Math.max(hi, data[i]);
	}
	const pad = 0.02 * (hi - lo) || 1;
	return [lo - pad, hi + pad];
}

/** A window holding all but about 2·eps of Z's mass (from the ranges of X and Y). */
export function modelWindow(X: Dist, Y: Dist, eps = 1e-3): [number, number] {
	const [xl, xh] = X.range(eps);
	const [yl, yh] = Y.range(eps);
	return [xl + yl, xh + yh];
}

/**
 * The grid `zDensityAt` uses for a sample: the sample's `dataWindow`, widened
 * to hold X's range (all but 1e-9 of its mass), but never by more than the
 * sample's width on either side, so heavy-tailed X keeps a fine step.
 */
export function likelihoodGrid(
	X: Dist,
	Y: Dist,
	data: ArrayLike<number>,
	options: { baseNodes?: number; maxNodes?: number } = {}
) {
	const [lo, hi] = dataWindow(data);
	const [xl, xh] = X.range(1e-9);
	const w = hi - lo;
	return chooseGrid(
		Math.max(lo - w, Math.min(lo, xl)),
		Math.min(hi + w, Math.max(hi, xh)),
		X,
		Y,
		options
	);
}

/** Cell masses of `d` on `grid` (mass outside the grid is dropped). */
export function discretise(d: Dist, { x0, h, m }: Grid): Float64Array {
	const out = new Float64Array(m);
	if (d.pdf) {
		for (let j = 0; j < m; j++) out[j] = d.pdf(x0 + j * h) * h;
	}
	const { x, p } = d.atoms;
	for (let k = 0; k < x.length; k++) {
		const u = (x[k] - x0) / h;
		const j = Math.floor(u);
		if (j < 0 || j > m - 1) continue;
		if (j === m - 1) {
			if (u === m - 1) out[j] += p[k];
			continue;
		}
		const f = u - j;
		out[j] += p[k] * (1 - f);
		out[j + 1] += p[k] * f;
	}
	return out;
}

/** Density of Z = X + Y at each node of `grid` (for a continuous Z). */
export function zDensityOnGrid(X: Dist, Y: Dist, grid: Grid): Float64Array {
	const { h, m } = grid;
	const xs = discretise(X, grid);
	const ys = discretise(Y, { x0: -(m - 1) * h, h, m: 2 * m - 1 });
	const conv = convolve(xs, ys);
	const out = new Float64Array(m);
	for (let j = 0; j < m; j++) out[j] = Math.max(0, conv[j + m - 1]) / h;
	return out;
}

/** Point masses of Z = X + Y for discrete X and Y. */
export function zAtoms(X: Dist, Y: Dist): Atoms {
	const map = new Map<number, number>();
	const ax = X.atoms;
	const ay = Y.atoms;
	for (let i = 0; i < ax.x.length; i++) {
		for (let k = 0; k < ay.x.length; k++) {
			const z = ax.x[i] + ay.x[k];
			map.set(z, (map.get(z) ?? 0) + ax.p[i] * ay.p[k]);
		}
	}
	const xs = [...map.keys()].sort((a, b) => a - b);
	return { x: Float64Array.from(xs), p: Float64Array.from(xs, (z) => map.get(z)!) };
}

/** Mass of the atom at `z` (within a 1e-9 relative tolerance), 0 if none. */
export function atomMass({ x, p }: Atoms, z: number): number {
	let lo = 0;
	let hi = x.length - 1;
	const tol = 1e-9 * Math.max(1, Math.abs(z));
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (x[mid] < z - tol) lo = mid + 1;
		else if (x[mid] > z + tol) hi = mid - 1;
		else return p[mid];
	}
	return 0;
}

/** Linear interpolation of grid values at `z`; 0 outside the grid. */
export function interpolate(values: Float64Array, { x0, h, m }: Grid, z: number): number {
	const u = (z - x0) / h;
	if (!(u >= 0 && u <= m - 1)) return 0;
	const j = Math.min(Math.floor(u), m - 2);
	const f = u - j;
	return values[j] * (1 - f) + values[j + 1] * f;
}

export const isDiscreteZ = (X: Dist, Y: Dist) => X.pdf === null && Y.pdf === null;

/**
 * f_Z at each point: the pmf for a discrete Z, otherwise the density.
 * `grid` defaults to `likelihoodGrid`.
 */
export function zDensityAt(X: Dist, Y: Dist, points: ArrayLike<number>, grid?: Grid): Float64Array {
	const out = new Float64Array(points.length);
	if (isDiscreteZ(X, Y)) {
		const atoms = zAtoms(X, Y);
		for (let i = 0; i < points.length; i++) out[i] = atomMass(atoms, points[i]);
		return out;
	}
	const g = grid ?? likelihoodGrid(X, Y, points);
	const f = zDensityOnGrid(X, Y, g);
	for (let i = 0; i < points.length; i++) out[i] = interpolate(f, g, points[i]);
	return out;
}

/** Floor on f_Z so one impossible point gives a large finite penalty, not −Infinity. */
export const DENSITY_FLOOR = 1e-300;

/** Σ wᵢ log f_Z(zᵢ), with weights 1 when `weights` is omitted. */
export function logLikelihood(
	X: Dist,
	Y: Dist,
	data: ArrayLike<number>,
	{ grid, weights }: { grid?: Grid; weights?: ArrayLike<number> } = {}
): number {
	const f = zDensityAt(X, Y, data, grid);
	let s = 0;
	for (let i = 0; i < f.length; i++)
		s += (weights ? weights[i] : 1) * Math.log(Math.max(f[i], DENSITY_FLOOR));
	return s;
}
