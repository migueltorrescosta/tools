/**
 * Quantile groups of an input (`pd.qcut(x, q, duplicates="drop")`), the mean
 * loss and optimal decision per group, and the input's density and deciles.
 */

import { pyRepr, roundHalfEven } from './format';
import { linspace, nextUp, quantileSorted, sortedCopy } from './numeric';

export interface QuantileGroups {
	/** Distinct bin edges, ascending; `edges.length - 1` groups (at least 1). */
	edges: Float64Array;
	/** Group of each row, 0-based. */
	codes: Uint8Array;
	/** Number of groups. */
	count: number;
	/** Interval labels as pandas prints them, e.g. `(9789.999, 9934.0]`. */
	labels: string[];
}

/** The probabilities `pd.qcut` asks for with an integer `q`. */
export function qcutProbabilities(q: number): Float64Array {
	const p = linspace(0, 1, q + 1);
	for (let i = 0; i < p.length; i++) if (q * p[i] !== i) p[i] = nextUp(p[i]);
	return p;
}

/** Quantile bin edges of a sorted column, duplicates dropped (pandas rules). */
export function qcutEdges(sorted: Float64Array, q: number): Float64Array {
	const raw = Array.from(qcutProbabilities(q), (p) => quantileSorted(sorted, p));
	if (raw.length === 2) return Float64Array.from(raw);
	const unique: number[] = [];
	for (const e of raw) if (!unique.includes(e)) unique.push(e);
	return Float64Array.from(unique);
}

/**
 * `pd.qcut(column, q, duplicates="drop")`: right-closed intervals between the
 * linear-interpolated quantiles, the lowest edge included. A constant column,
 * where pandas would leave every row unassigned, becomes one group.
 */
export function qcut(column: Float64Array, q: number, sorted?: Float64Array): QuantileGroups {
	if (!Number.isInteger(q) || q < 1 || q > 254)
		throw new RangeError(`bins must be 1–254, got ${q}`);
	const edges = qcutEdges(sorted ?? sortedCopy(column), q);
	const n = column.length;
	const codes = new Uint8Array(n);
	const count = Math.max(1, edges.length - 1);
	if (edges.length > 1) {
		const first = edges[0];
		const last = edges.length - 1;
		for (let i = 0; i < n; i++) {
			const x = column[i];
			// ids = number of edges strictly below x; the lowest edge maps to 1.
			let id = 0;
			while (id <= last && edges[id] < x) id++;
			if (x === first) id = 1;
			codes[i] = Math.min(Math.max(id, 1), last) - 1;
		}
	}
	return { edges, codes, count, labels: intervalLabels(edges) };
}

function roundFrac(x: number, precision: number): number {
	if (!Number.isFinite(x) || x === 0) return x;
	const whole = Math.trunc(x);
	const digits =
		whole === 0 ? -Math.floor(Math.log10(Math.abs(x - whole))) - 1 + precision : precision;
	return around(x, digits);
}

/** `np.around(x, digits)`. */
function around(x: number, digits: number): number {
	if (digits >= 0) {
		const f = 10 ** digits;
		return roundHalfEven(x * f) / f;
	}
	const f = 10 ** -digits;
	return roundHalfEven(x / f) * f;
}

function inferPrecision(base: number, edges: Float64Array): number {
	for (let precision = base; precision < 20; precision++) {
		const levels = new Set(Array.from(edges, (b) => roundFrac(b, precision)));
		if (levels.size === edges.length) return precision;
	}
	return base;
}

/** pandas' interval labels for qcut edges (precision 3, lowest edge nudged down). */
export function intervalLabels(edges: Float64Array): string[] {
	if (edges.length < 2) return edges.length === 1 ? [`[${pyRepr(edges[0])}]`] : [];
	const precision = inferPrecision(3, edges);
	const breaks = Array.from(edges, (b) => roundFrac(b, precision));
	breaks[0] = breaks[0] - 10 ** -precision;
	const labels: string[] = [];
	for (let g = 0; g + 1 < breaks.length; g++) {
		labels.push(`(${pyRepr(breaks[g])}, ${pyRepr(breaks[g + 1])}]`);
	}
	return labels;
}

export interface GroupTable {
	/** Number of quantile groups asked for. */
	bins: number;
	edges: Float64Array;
	/** Groups that hold at least one row (pandas `observed=True`). */
	groups: {
		/** Index into the qcut groups. */
		group: number;
		label: string;
		/** Rows in the group. */
		count: number;
		/** Mean loss per decision, model order. */
		meanLoss: Float64Array;
		/** Decision with the smallest mean loss, first on ties. */
		optimal: number;
	}[];
}

/**
 * Mean loss of every decision per quantile group of an input, and the
 * group's optimal decision (`optimal_decision_per_group(..., detailed=True)`).
 * Means use Kahan summation in row order, as pandas' groupby mean does.
 */
export function optimalDecisionPerGroup(
	column: Float64Array,
	loss: Float64Array,
	D: number,
	bins: number,
	sorted?: Float64Array
): GroupTable {
	const g = qcut(column, bins, sorted);
	const G = g.count;
	const sums = new Float64Array(G * D);
	const comp = new Float64Array(G * D);
	const counts = new Uint32Array(G);
	const n = column.length;
	for (let i = 0; i < n; i++) {
		const code = g.codes[i];
		counts[code]++;
		const base = code * D;
		const row = i * D;
		for (let d = 0; d < D; d++) {
			const y = loss[row + d] - comp[base + d];
			const t = sums[base + d] + y;
			const c = t - sums[base + d] - y;
			comp[base + d] = Number.isNaN(c) ? 0 : c;
			sums[base + d] = t;
		}
	}
	const groups: GroupTable['groups'] = [];
	for (let k = 0; k < G; k++) {
		if (counts[k] === 0) continue;
		const meanLoss = new Float64Array(D);
		let optimal = 0;
		for (let d = 0; d < D; d++) {
			meanLoss[d] = sums[k * D + d] / counts[k];
			if (meanLoss[d] < meanLoss[optimal]) optimal = d;
		}
		groups.push({ group: k, label: g.labels[k], count: counts[k], meanLoss, optimal });
	}
	return { bins, edges: g.edges, groups };
}

export interface InputDensity {
	min: number;
	max: number;
	/** 10th to 90th percentiles. */
	deciles: Float64Array;
	/** 200 evenly spaced points from min to max. */
	grid: Float64Array;
	/** Gaussian KDE at the grid points (zero for a constant column). */
	density: Float64Array;
	/** Kernel standard deviation (Scott's rule, as SciPy's `gaussian_kde`). */
	bandwidth: number;
}

const DENSITY_POINTS = 200;
const KDE_BINS = 2048;

/**
 * Density curve and deciles of an input. The KDE uses SciPy's defaults
 * (Gaussian kernel, Scott's bandwidth σ·n^(-1/5), σ with ddof 1) evaluated
 * on a linear binning of every row into 2048 bins, which matches the exact
 * KDE to well under 0.1 % at plot resolution and costs O(n).
 */
export function inputDensity(column: Float64Array, sorted?: Float64Array): InputDensity {
	const s = sorted ?? sortedCopy(column);
	const n = s.length;
	const min = s[0];
	const max = s[n - 1];
	const deciles = Float64Array.from(linspace(0.1, 0.9, 9), (p) => quantileSorted(s, p));
	const grid = linspace(min, max, DENSITY_POINTS);
	const density = new Float64Array(DENSITY_POINTS);
	let mean = 0;
	for (let i = 0; i < n; i++) mean += s[i];
	mean /= n;
	let ss = 0;
	for (let i = 0; i < n; i++) ss += (s[i] - mean) ** 2;
	const sigma = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
	const bandwidth = sigma * n ** -0.2;
	if (!(bandwidth > 0) || !(max > min)) return { min, max, deciles, grid, density, bandwidth };
	const weights = new Float64Array(KDE_BINS);
	const scale = (KDE_BINS - 1) / (max - min);
	for (let i = 0; i < n; i++) {
		const t = (s[i] - min) * scale;
		const j = Math.min(Math.floor(t), KDE_BINS - 2);
		const f = t - j;
		weights[j] += 1 - f;
		weights[j + 1] += f;
	}
	const step = (max - min) / (KDE_BINS - 1);
	const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
	const reach = Math.ceil((8 * bandwidth) / step);
	for (let k = 0; k < DENSITY_POINTS; k++) {
		const centre = (grid[k] - min) / step;
		const lo = Math.max(0, Math.floor(centre) - reach);
		const hi = Math.min(KDE_BINS - 1, Math.ceil(centre) + reach);
		let acc = 0;
		for (let j = lo; j <= hi; j++) {
			if (weights[j] === 0) continue;
			const z = ((j - centre) * step) / bandwidth;
			acc += weights[j] * Math.exp(-0.5 * z * z);
		}
		density[k] = acc * norm;
	}
	return { min, max, deciles, grid, density, bandwidth };
}
