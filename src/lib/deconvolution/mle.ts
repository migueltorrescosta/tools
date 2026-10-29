/**
 * Parametric maximum likelihood for Z = X + Y: every free parameter of the
 * chosen X and Y families is fitted jointly, with 95% intervals from the
 * observed information and a check that the data can separate them.
 * No DOM or Svelte imports.
 */
import { moments } from '$lib/stats';
import { makeDist } from './dist';
import { defaultParams, family, validateParams } from './families';
import {
	atomMass,
	chooseGrid,
	gridResolves,
	isDiscreteZ,
	likelihoodGrid,
	logLikelihood,
	modelWindow,
	zAtoms,
	zDensityOnGrid
} from './grid';
import {
	BAD,
	fitCore,
	toFree,
	fromFree,
	type Identifiability,
	type ParamEstimate,
	type Problem,
	type Slot
} from './fitcore';
import type { DistSpec, FamilyId, Grid, Role, SimpleSpec } from './types';

export { IDENTIFIABILITY_LIMIT, type Identifiability, type ParamEstimate } from './fitcore';

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

/** Grid nodes while searching, and for the polish and curvature at the optimum. */
const SEARCH_NODES = 1024;
const FINAL_NODES = 2048;
/** The Jeffreys prior's grid over the model's own range (heavy tails make it wide, so it is capped). */
const INFO_NODES = { baseNodes: 1024, maxNodes: 4096 };

/** A slot with its index in its spec's params (−1 for a mixture weight). */
type Slot1 = Slot & { index: number };

/** Parameters with a flat prior on the free scale in a Bayesian fit: locations, and a uniform's width. */
export const flatParam = (id: FamilyId, index: number) =>
	index === family(id).location || (id === 'uniform' && index === 1);

export interface Model1 {
	x: DistSpec;
	y: SimpleSpec;
}

function slots(x: DistSpec, y: SimpleSpec, fixedY: boolean[] = []): Slot1[] {
	const out: Slot1[] = [];
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
				fitted: p.domain !== 'count' && !fixed(index),
				flat: flatParam(spec.family, index)
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
function encode(all: Slot1[], x: DistSpec, y: SimpleSpec): number[] {
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
function decode(all: Slot1[], theta: readonly number[], x0: DistSpec, y0: SimpleSpec) {
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

/** The model as the fitting core sees it; also the Bayesian fit's (`bayes.ts`). */
export function mleProblem({ data, x, y, fixedY }: MleInput): Problem<Model1, Grid> & {
	slots: Slot1[];
} {
	const all = slots(x, y, fixedY);
	const valid = (s: Model1) => specsValid(s.x, s.y);
	const startModels: Model1[] = [];
	if (specsValid(x, y)) {
		startModels.push({ x, y });
		const ms = momentStart(data, x, y);
		if (ms && specsValid(ms, y)) startModels.push({ x: ms, y });
	} else {
		const def: DistSpec =
			x.family === 'mixture' ? x : { family: x.family, params: defaultParams(x.family) };
		startModels.push({ x: def, y: { family: y.family, params: defaultParams(y.family) } });
	}
	return {
		slots: all,
		encode: (s) => encode(all, s.x, s.y),
		decode: (theta) => decode(all, theta, x, y),
		valid,
		grid: (s, final) =>
			likelihoodGrid(makeDist(s.x, 'signal'), makeDist(s.y, 'noise'), data, {
				baseNodes: final ? FINAL_NODES : SEARCH_NODES
			}),
		nll: (s, grid) => objective(data, s.x, s.y, grid),
		infoGrid: (s) => {
			const X = makeDist(s.x, 'signal');
			const Y = makeDist(s.y, 'noise');
			// A discrete Z is integer-valued (the discrete families count from 0): one node per integer.
			if (isDiscreteZ(X, Y)) {
				const { x } = zAtoms(X, Y);
				const lo = Math.floor(x[0]);
				return { x0: lo, h: 1, m: Math.ceil(x[x.length - 1]) - lo + 1 };
			}
			return chooseGrid(...modelWindow(X, Y, 1e-4), X, Y, INFO_NODES);
		},
		cells: (s, grid) => {
			const X = makeDist(s.x, 'signal');
			const Y = makeDist(s.y, 'noise');
			if (isDiscreteZ(X, Y)) {
				const atoms = zAtoms(X, Y);
				return Float64Array.from({ length: grid.m }, (_, k) => atomMass(atoms, grid.x0 + k));
			}
			return zDensityOnGrid(X, Y, grid).map((f) => f * grid.h);
		},
		values: (s) =>
			all.map((slot) => {
				if (slot.domain === 'weight')
					return (s.x as Extract<DistSpec, { family: 'mixture' }>).components[slot.component!]
						.weight;
				const spec =
					slot.role === 'noise'
						? s.y
						: s.x.family === 'mixture'
							? s.x.components[slot.component!]
							: s.x;
				return spec.params[slot.index];
			}),
		starts: startModels,
		n: data.length,
		sd: Math.sqrt(moments(data).variance)
	};
}

export function fitMle(input: MleInput): MleResult {
	const { y, seed, starts = 6 } = input;
	const problem = mleProblem(input);
	const all = problem.slots;
	const r = fitCore(problem, seed, starts);
	// The noise's location is held at 0 by definition, not by the fit: leave it out.
	const yLocation = family(y.family).location;
	const { fit, ...rest } = r;
	return {
		...rest,
		x: fit.x,
		y: fit.y,
		params: r.params.filter((_, i) => !(all[i].role === 'noise' && all[i].index === yLocation))
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
