/**
 * The Kiefer–Wolfowitz NPMLE of a 2D signal on a 64 × 64 support grid, with
 * the same solver as 1D (`solveNpmle`); peaks of D are found among each
 * point's 8 neighbours. No DOM or Svelte imports.
 */
import { binData2 } from './binning2';
import type { Dist2, Grid2, GridEstimate2 } from './dist2';
import { dataBox } from './grid2';
import { solveNpmle, type NpmleOptions } from './npmle';

/** `atoms` × `atoms` equally spaced support points over the data's box. */
export function supportGrid2(xs: ArrayLike<number>, ys: ArrayLike<number>, atoms = 64): Grid2 {
	const [a, b, c, d] = dataBox(xs, ys);
	return {
		x0: a,
		hx: (b - a) / (atoms - 1),
		mx: atoms,
		y0: c,
		hy: (d - c) / (atoms - 1),
		my: atoms
	};
}

/** Row-major n × m matrix L[i·m + j] = f_Y(z_i − a_j), support points row-major by y. */
export function likelihoodMatrix2(
	px: Float64Array,
	py: Float64Array,
	y: Dist2,
	g: Grid2
): Float64Array {
	const pdf = y.pdf;
	if (pdf === null) throw new Error('The noise must be continuous');
	const m = g.mx * g.my;
	const L = new Float64Array(px.length * m);
	for (let i = 0; i < px.length; i++)
		for (let j = 0; j < g.my; j++) {
			const dy = py[i] - (g.y0 + j * g.hy);
			for (let k = 0; k < g.mx; k++) L[i * m + j * g.mx + k] = pdf(px[i] - (g.x0 + k * g.hx), dy);
		}
	return L;
}

/** As `likelihoodMatrix2`, with each point's own normal noise covariance [σx², ρσxσy, σy²]. */
export function likelihoodMatrix2PerPoint(
	px: Float64Array,
	py: Float64Array,
	cov: Float64Array[],
	g: Grid2
): Float64Array {
	const m = g.mx * g.my;
	const L = new Float64Array(px.length * m);
	for (let i = 0; i < px.length; i++) {
		const [a, b, c] = cov[i];
		const d = a * c - b * b;
		const k = 1 / (2 * Math.PI * Math.sqrt(d));
		for (let j = 0; j < g.my; j++) {
			const v = py[i] - (g.y0 + j * g.hy);
			for (let q = 0; q < g.mx; q++) {
				const u = px[i] - (g.x0 + q * g.hx);
				L[i * m + j * g.mx + q] = k * Math.exp((-0.5 * (c * u * u - 2 * b * u * v + a * v * v)) / d);
			}
		}
	}
	return L;
}

/** The likelihood matrix and counts of a 2D sample: binned, or one row per point with its own covariance. */
export function npmleSystem2(
	xs: Float64Array,
	ys: Float64Array,
	y: Dist2,
	g: Grid2,
	cov?: Float64Array[]
): [Float64Array, Float64Array] {
	if (cov) return [likelihoodMatrix2PerPoint(xs, ys, cov, g), new Float64Array(xs.length).fill(1)];
	const b = binData2(xs, ys);
	return [likelihoodMatrix2(b.x, b.y, y, g), b.c];
}

/** The (up to) 8 grid neighbours of support point j. */
export const gridNeighbours =
	({ mx, my }: Grid2) =>
	(j: number): number[] => {
		const x = j % mx;
		const y = (j - x) / mx;
		const out: number[] = [];
		for (let dy = -1; dy <= 1; dy++)
			for (let dx = -1; dx <= 1; dx++) {
				if ((dx || dy) && x + dx >= 0 && x + dx < mx && y + dy >= 0 && y + dy < my)
					out.push((y + dy) * mx + x + dx);
			}
		return out;
	};

export interface Npmle2Input extends Omit<NpmleOptions, 'neighbours'> {
	xs: Float64Array;
	ys: Float64Array;
	y: Dist2;
	/** Each point's own noise covariance [σx², ρσxσy, σy²] (per-point errors). */
	cov?: Float64Array[];
	grid?: Grid2;
}

export interface Npmle2Result extends GridEstimate2 {
	logLik: number;
	iterations: number;
	gap: number;
	converged: boolean;
}

export function fitNpmle2({ xs, ys, y, cov, grid, ...options }: Npmle2Input): Npmle2Result {
	const g = grid ?? supportGrid2(xs, ys);
	const [L, c] = npmleSystem2(xs, ys, y, g, cov);
	return {
		grid: g,
		...solveNpmle(L, c, g.mx * g.my, { ...options, neighbours: gridNeighbours(g) })
	};
}
