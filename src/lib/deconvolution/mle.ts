/**
 * Parametric maximum likelihood for Z = X + Y: every free parameter of the
 * chosen X and Y families is fitted jointly, with 95% intervals from the
 * observed information and a check that the data can separate them.
 * No DOM or Svelte imports.
 */
import { nelderMead } from '$lib/minimise';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { defaultParams, family, validateParams } from './families';
import { gridResolves, likelihoodGrid, logLikelihood } from './grid';
import { invertSymmetric, symmetricEigen } from './linalg';
import type { Domain, DistSpec, FamilyId, Grid, Role, SimpleSpec } from './types';

export interface MleInput {
	data: Float64Array;
	/** Starting values: its params. */
	x: DistSpec;
	/** Starting values: its params. */
	y: SimpleSpec;
	/** Per Y parameter: true holds it at its given value. */
	fixedY?: boolean[];
	seed: number;
	/** Nelder–Mead starts (default 6): the given params, a moment-matched start, then random perturbations. */
	starts?: number;
}

export interface ParamEstimate {
	role: Role;
	/** Mixture component index, or null for a simple spec. */
	component: number | null;
	/** e.g. `sigma`, or `weight` for a mixture weight. */
	key: string;
	label: string;
	value: number;
	/** 95% interval; NaN when the information matrix isn't positive definite (and for weights). */
	lower: number;
	upper: number;
	fitted: boolean;
}

export interface Identifiability {
	/** λmax/λmin of the scaled observed information (unit diagonal); Infinity when λmin ≤ 0. */
	conditionNumber: number;
	/** conditionNumber > IDENTIFIABILITY_LIMIT. */
	flat: boolean;
	/** When flat: parameters whose |component| in the eigenvector of λmin is at least 0.2 of the largest, with its sign. */
	direction: { role: Role; component: number | null; key: string; label: string; weight: number }[];
	/**
	 * Fitted parameters that ended at the edge of their range: within 1e-3 of 0 or 1,
	 * or a positive one below 1e-3 of the data's standard deviation. A flat direction
	 * often runs into such an edge, where the curvature no longer shows it.
	 */
	boundary: { role: Role; component: number | null; key: string; label: string }[];
}

export interface MleResult {
	x: DistSpec;
	y: SimpleSpec;
	params: ParamEstimate[];
	logLik: number;
	/** Number of fitted parameters. */
	k: number;
	n: number;
	/** 2k − 2ℓ */
	aic: number;
	/** k ln n − 2ℓ */
	bic: number;
	identifiability: Identifiability;
}

export const IDENTIFIABILITY_LIMIT = 1e6;
/** Objective value for parameters that are invalid or give no finite likelihood. */
const BAD = 1e300;
const HESSIAN_STEP = 1e-3;
/** Grid nodes while searching, and for the polish and curvature at the optimum. */
const SEARCH_NODES = 1024;
const FINAL_NODES = 2048;

/** One parameter's place: which spec, which index, and whether it is fitted. */
interface Slot {
	role: Role;
	component: number | null;
	index: number;
	key: string;
	label: string;
	domain: Domain | 'weight';
	fitted: boolean;
}

const sigmoid = (u: number) => 1 / (1 + Math.exp(-u));
const toFree = (domain: Domain, v: number): number => {
	if (domain === 'positive') return Math.log(v);
	if (domain === 'unit' || domain === 'unitClosed') {
		const p = Math.min(1 - 1e-6, Math.max(1e-6, v));
		return Math.log(p / (1 - p));
	}
	return v;
};
const fromFree = (domain: Domain, u: number): number => {
	if (domain === 'positive') return Math.exp(u);
	if (domain === 'unit' || domain === 'unitClosed') return sigmoid(u);
	return u;
};

function slots(x: DistSpec, y: SimpleSpec, fixedY: boolean[] = []): Slot[] {
	const out: Slot[] = [];
	const add = (
		role: Role,
		component: number | null,
		spec: SimpleSpec,
		fixed: (i: number) => boolean
	) =>
		family(spec.family).params.forEach((p, index) =>
			out.push({
				role,
				component,
				index,
				key: p.key,
				label: p.label,
				domain: p.domain,
				fitted: p.domain !== 'count' && !fixed(index)
			})
		);
	if (x.family === 'mixture') {
		x.components.forEach((c, i) => add('signal', i, c, () => false));
		x.components.forEach((_, i) =>
			out.push({
				role: 'signal',
				component: i,
				index: -1,
				key: 'weight',
				label: 'w',
				domain: 'weight',
				fitted: i > 0
			})
		);
	} else add('signal', null, x, () => false);
	const fy = family(y.family);
	add('noise', null, y, (i) => i === fy.location || !!fixedY[i]);
	return out;
}

/** The free vector of the specs (weights as logits relative to the first component). */
function encode(all: Slot[], x: DistSpec, y: SimpleSpec): number[] {
	const theta: number[] = [];
	for (const s of all) {
		if (!s.fitted) continue;
		if (s.domain === 'weight') {
			const c = (x as Extract<DistSpec, { family: 'mixture' }>).components;
			theta.push(Math.log(c[s.component!].weight / c[0].weight));
			continue;
		}
		const spec = s.role === 'noise' ? y : x.family === 'mixture' ? x.components[s.component!] : x;
		theta.push(toFree(s.domain, spec.params[s.index]));
	}
	return theta;
}

/** Specs with the free vector applied on top of the starting specs. */
function decode(all: Slot[], theta: readonly number[], x0: DistSpec, y0: SimpleSpec) {
	const x = structuredClone(x0);
	const y = structuredClone(y0);
	let k = 0;
	const logits: number[] = [];
	for (const s of all) {
		if (s.domain === 'weight') {
			logits[s.component!] = s.fitted ? theta[k++] : 0;
			continue;
		}
		if (!s.fitted) continue;
		const spec = s.role === 'noise' ? y : x.family === 'mixture' ? x.components[s.component!] : x;
		spec.params[s.index] = fromFree(s.domain, theta[k++]);
	}
	if (x.family === 'mixture') {
		const top = Math.max(...logits);
		const e = logits.map((l) => Math.exp(l - top));
		const total = e.reduce((a, b) => a + b, 0);
		x.components.forEach((c, i) => (c.weight = e[i] / total));
	}
	return { x, y };
}

function specsValid(x: DistSpec, y: SimpleSpec): boolean {
	const simple = x.family === 'mixture' ? x.components : [x];
	return [...simple, y].every((s) => validateParams(s.family, s.params).length === 0);
}

/**
 * −log-likelihood of the specs on a fixed grid, or BAD. Parameters the grid
 * can't resolve get a grid of their own, so a fit can't exploit the step.
 */
function objective(data: Float64Array, x: DistSpec, y: SimpleSpec, grid: Grid | undefined): number {
	if (!specsValid(x, y)) return BAD;
	try {
		const X = makeDist(x, 'signal');
		const Y = makeDist(y, 'noise');
		const g = grid && gridResolves(grid, X, Y) ? grid : undefined;
		const ll = logLikelihood(X, Y, data, {
			grid: g ?? likelihoodGrid(X, Y, data, { baseNodes: SEARCH_NODES })
		});
		return Number.isFinite(ll) ? -ll : BAD;
	} catch {
		return BAD;
	}
}

function moments(data: Float64Array): { mean: number; variance: number } {
	let mean = 0;
	for (const v of data) mean += v;
	mean /= data.length;
	let variance = 0;
	for (const v of data) variance += (v - mean) ** 2;
	return { mean, variance: variance / data.length };
}

/**
 * Method-of-moments parameters for a family with this mean and variance
 * (each family's own shape parameters stay at their defaults where moments don't fix them).
 */
export function momentParams(id: FamilyId, mean: number, variance: number): number[] {
	const s = Math.sqrt(Math.max(variance, 1e-12));
	const p = defaultParams(id);
	const pos = mean > 0;
	switch (id) {
		case 'normal':
			return [mean, s];
		case 'laplace':
			return [mean, s / Math.SQRT2];
		case 'uniform':
			return [mean, s * Math.sqrt(12)];
		case 'exponential':
			return [pos ? mean : p[0]];
		case 'gamma':
			return pos ? [(mean * mean) / (s * s), (s * s) / mean] : p;
		case 'lognormal': {
			if (!pos) return p;
			const q = 1 + (s * s) / (mean * mean);
			return [mean / Math.sqrt(q), Math.sqrt(Math.log(q))];
		}
		case 'studentT':
			return [5, mean, s * Math.sqrt(3 / 5)];
		case 'cauchy':
			return [mean, s / 2];
		case 'fringe':
			return [mean, s, p[2], p[3], p[4]];
		case 'poisson':
			return [pos ? mean : p[0]];
		case 'binomial': {
			const n = Math.max(1, Math.ceil(mean + 4 * s));
			return [n, Math.min(0.99, Math.max(0.01, mean / n))];
		}
		case 'geometric':
			return [pos ? 1 / (1 + mean) : p[0]];
	}
}

/** A start whose X matches the data's moments after removing Y's (simple X only). */
function momentStart(data: Float64Array, x: DistSpec, y: SimpleSpec): DistSpec | null {
	if (x.family === 'mixture') return null;
	const Y = makeDist(y, 'noise');
	if (Y.mean === undefined) return null;
	const { mean, variance } = moments(data);
	const vx = Math.max(variance - (Y.variance ?? 0), 0.05 * variance);
	const params = momentParams(x.family, mean - Y.mean, vx);
	// Whole-number parameters (binomial n) stay as given.
	family(x.family).params.forEach((p, i) => {
		if (p.domain === 'count') params[i] = x.params[i];
	});
	return { family: x.family, params };
}

/** Central-difference Hessian of `f` at `theta`. */
function hessian(f: (t: number[]) => number, theta: number[]): number[][] {
	const d = theta.length;
	const h = HESSIAN_STEP;
	const f0 = f(theta);
	const at = (i: number, di: number, j: number, dj: number) => {
		const t = [...theta];
		t[i] += di;
		t[j] += dj;
		return f(t);
	};
	const H = Array.from({ length: d }, () => new Array<number>(d).fill(0));
	for (let i = 0; i < d; i++) {
		H[i][i] = (at(i, h, i, 0) - 2 * f0 + at(i, -h, i, 0)) / (h * h);
		for (let j = i + 1; j < d; j++) {
			H[i][j] = H[j][i] =
				(at(i, h, j, h) - at(i, h, j, -h) - at(i, -h, j, h) + at(i, -h, j, -h)) / (4 * h * h);
		}
	}
	return H;
}

export function fitMle({ data, x, y, fixedY, seed, starts = 6 }: MleInput): MleResult {
	const all = slots(x, y, fixedY);
	const free = all.filter((s) => s.fitted);
	const n = data.length;
	const prng = new Prng(seed);
	const valid = specsValid(x, y);

	const candidates: number[][] = [];
	if (valid) candidates.push(encode(all, x, y));
	const ms = valid ? momentStart(data, x, y) : null;
	if (ms && specsValid(ms, y)) candidates.push(encode(all, ms, y));
	if (candidates.length === 0) {
		const def: DistSpec =
			x.family === 'mixture' ? x : { family: x.family, params: defaultParams(x.family) };
		const dy = { family: y.family, params: defaultParams(y.family) };
		candidates.push(encode(all, def, dy));
	}
	const base = candidates[0];
	while (candidates.length < starts) candidates.push(base.map((v) => v + 0.5 * prng.normal()));

	// Search on one fixed, coarser grid so the objective is smooth in θ.
	const startSpecs = decode(all, base, x, y);
	const searchGrid = specsValid(startSpecs.x, startSpecs.y)
		? likelihoodGrid(makeDist(startSpecs.x, 'signal'), makeDist(startSpecs.y, 'noise'), data, {
				baseNodes: SEARCH_NODES
			})
		: undefined;
	const searchObjective = (t: number[]) => {
		const s = decode(all, t, x, y);
		return objective(data, s.x, s.y, searchGrid);
	};

	let best = { x: base, f: Infinity };
	for (const start of candidates.slice(0, Math.max(1, starts))) {
		if (free.length === 0) {
			best = { x: start, f: searchObjective(start) };
			break;
		}
		const r = nelderMead(searchObjective, start, { maxIter: 400 * free.length });
		if (r.f < best.f) best = { x: r.x, f: r.f };
	}

	// Polish on the full grid at the optimum, then measure the curvature there.
	const at = decode(all, best.x, x, y);
	const finalGrid = specsValid(at.x, at.y)
		? likelihoodGrid(makeDist(at.x, 'signal'), makeDist(at.y, 'noise'), data, {
				baseNodes: FINAL_NODES
			})
		: undefined;
	const finalObjective = (t: number[]) => {
		const s = decode(all, t, x, y);
		return objective(data, s.x, s.y, finalGrid);
	};
	let theta = best.x;
	if (free.length) {
		const r = nelderMead(finalObjective, theta, { maxIter: 200 * free.length });
		if (r.f <= finalObjective(theta)) theta = r.x;
	}
	const fit = decode(all, theta, x, y);
	const nll = finalObjective(theta);
	const logLik = nll >= BAD ? -Infinity : -nll;

	const H = free.length ? hessian(finalObjective, theta) : [];
	const cov = free.length ? invertSymmetric(H) : null;
	// Collinearity on the scaled information H_ij/√(H_ii·H_jj), so the units and
	// transforms of the parameters don't decide which one looks flat.
	const scale = H.map((row, i) => (row[i] > 0 ? 1 / Math.sqrt(row[i]) : 0));
	const scaled = H.map((row, i) => row.map((v, j) => v * scale[i] * scale[j]));
	const { values, vectors } = symmetricEigen(scale.every((v) => v > 0) ? scaled : H);
	const lmin = values[0];
	const lmax = values[values.length - 1];
	const conditionNumber = free.length === 0 ? 1 : lmin > 0 ? lmax / lmin : Infinity;
	const flat = conditionNumber > IDENTIFIABILITY_LIMIT;
	const direction = flat
		? free
				.map((s, i) => ({
					role: s.role,
					component: s.component,
					key: s.key,
					label: s.label,
					weight: vectors[0][i]
				}))
				.filter(
					(d, _, all) => Math.abs(d.weight) >= 0.2 * Math.max(...all.map((a) => Math.abs(a.weight)))
				)
		: [];

	let k = 0;
	const params: ParamEstimate[] = all.map((s) => {
		const spec =
			s.role === 'noise'
				? fit.y
				: fit.x.family === 'mixture'
					? fit.x.components[s.component!]
					: fit.x;
		const value =
			s.domain === 'weight'
				? (fit.x as Extract<DistSpec, { family: 'mixture' }>).components[s.component!].weight
				: spec.params[s.index];
		let lower = NaN;
		let upper = NaN;
		if (s.fitted) {
			const i = k++;
			if (cov && s.domain !== 'weight' && cov[i][i] > 0) {
				const sd = Math.sqrt(cov[i][i]);
				lower = fromFree(s.domain, theta[i] - 1.96 * sd);
				upper = fromFree(s.domain, theta[i] + 1.96 * sd);
			}
		}
		return {
			role: s.role,
			component: s.component,
			key: s.key,
			label: s.label,
			value,
			lower,
			upper,
			fitted: s.fitted
		};
	});

	const sd = Math.sqrt(moments(data).variance);
	const boundary = params
		.filter((p, i) => {
			const s = all[i];
			if (!p.fitted || s.domain === 'weight') return false;
			if (s.domain === 'unit' || s.domain === 'unitClosed')
				return p.value < 1e-3 || p.value > 1 - 1e-3;
			return s.domain === 'positive' && p.value < 1e-3 * sd;
		})
		.map(({ role, component, key, label }) => ({ role, component, key, label }));

	const kFree = free.length;
	// The noise's location is held at 0 by definition, not by the fit: leave it out.
	const yLocation = family(y.family).location;
	return {
		x: fit.x,
		y: fit.y,
		params: params.filter((p, i) => !(p.role === 'noise' && all[i].index === yLocation)),
		logLik,
		k: kFree,
		n,
		aic: 2 * kFree - 2 * logLik,
		bic: kFree * Math.log(n) - 2 * logLik,
		identifiability: { conditionNumber, flat, direction, boundary }
	};
}

/** Every listed X family fitted with this noise (moment-matched starts), best BIC first. */
export function compareFamilies(
	data: Float64Array,
	y: SimpleSpec,
	families: FamilyId[],
	seed: number,
	fixedY?: boolean[]
): { family: FamilyId; result: MleResult }[] {
	const { mean, variance } = moments(data);
	const out: { family: FamilyId; result: MleResult }[] = [];
	for (const id of families) {
		const x: SimpleSpec = { family: id, params: momentParams(id, mean, variance) };
		if (validateParams(id, x.params).length) x.params = defaultParams(id);
		const result = fitMle({ data, x, y, fixedY, seed, starts: 2 });
		if (Number.isFinite(result.logLik)) out.push({ family: id, result });
	}
	return out.sort((a, b) => a.result.bic - b.result.bic);
}
