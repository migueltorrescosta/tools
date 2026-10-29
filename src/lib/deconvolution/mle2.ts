/**
 * Parametric maximum likelihood in 2D, on the shared fitting core
 * (`fitcore.ts`): every free parameter of the 2D signal and noise is fitted
 * jointly, with intervals and the identifiability checks. No DOM or Svelte imports.
 */
import { moments } from '$lib/stats';
import {
	BAD,
	fitCore,
	fromFree,
	toFree,
	type CoreResult,
	type Problem,
	type Slot
} from './fitcore';
import { family } from './families';
import {
	FRINGE2_PARAMS,
	GAUSS2_PARAMS,
	makeDist2,
	validate2,
	type Grid2,
	type Noise2Spec,
	type Spec2
} from './dist2';
import {
	chooseGrid2,
	likelihoodGrid2,
	logLikelihood2,
	modelBox2,
	zDensityOnGrid2
} from './grid2';
import { flatParam, momentParams } from './mle';
import type { ParamSpec } from './types';

export interface Mle2Input {
	xs: Float64Array;
	ys: Float64Array;
	/** Starting values: its params. */
	x: Spec2;
	/** Starting values: its params. */
	y: Noise2Spec;
	/** Hold every noise parameter at its given value. */
	fixNoise?: boolean;
	seed: number;
	starts?: number;
}

export type Mle2Result = Omit<CoreResult<Model>, 'fit'> & { x: Spec2; y: Noise2Spec };

export interface Model2 {
	x: Spec2;
	y: Noise2Spec;
}
type Model = Model2;

/** Where a parameter lives: the signal or noise, the product axis or mixture component, its index (−1: weight). */
type Slot2 = Slot & { part: 'x' | 'y'; sub: 'x' | 'y' | number | null; index: number };

/**
 * Grids while searching (coarse) and for the polish and curvature at the
 * optimum. At most 32 and 128 nodes per axis keep the FFT at 64² and 256²:
 * one more node would double its size.
 */
const SEARCH = { baseNodes: 24, maxNodes: 32, nodesPerWidth: 3 };
const FINAL = { baseNodes: 96, maxNodes: 128 };
const AXIS = { x: 'x', y: 'y' } as const;

/** The params array a slot points into. */
function arrayOf(m: Model, s: Slot2): number[] {
	const spec = s.part === 'x' ? m.x : m.y;
	if (spec.family === 'mixture2') return spec.components[s.sub as number].params;
	if (spec.family === 'product') return spec[s.sub as 'x' | 'y'].params;
	return spec.params;
}

function slots(x: Spec2, y: Noise2Spec, fixNoise: boolean): Slot2[] {
	const out: Slot2[] = [];
	const add = (
		part: 'x' | 'y',
		sub: Slot2['sub'],
		specs: readonly ParamSpec[],
		fitted: (i: number, p: ParamSpec) => boolean,
		suffix = '',
		flat: (i: number) => boolean = () => false
	) =>
		specs.forEach((p, index) =>
			out.push({
				role: part === 'x' ? 'signal' : 'noise',
				component: typeof sub === 'number' ? sub : null,
				key: typeof sub === 'string' ? `${sub}.${p.key}` : p.key,
				label: p.label + suffix,
				domain: p.domain,
				fitted: p.domain !== 'count' && fitted(index, p),
				flat: flat(index),
				part,
				sub,
				index
			})
		);
	const all = () => true;
	// μx and μy lead the Gaussian and fringe parameters.
	const centre = (i: number) => i < 2;
	if (x.family === 'gauss2') add('x', null, GAUSS2_PARAMS, all, '', centre);
	else if (x.family === 'fringe2') add('x', null, FRINGE2_PARAMS, all, '', centre);
	else if (x.family === 'product')
		for (const a of ['x', 'y'] as const) {
			const id = x[a].family;
			add('x', AXIS[a], family(id).params, all, ` (${a})`, (i) => flatParam(id, i));
		}
	else {
		x.components.forEach((_, c) => add('x', c, GAUSS2_PARAMS, all));
		x.components.forEach((_, c) =>
			out.push({
				role: 'signal',
				component: c,
				key: 'weight',
				label: 'w',
				domain: 'weight',
				fitted: c > 0,
				part: 'x',
				sub: c,
				index: -1
			})
		);
	}
	if (y.family === 'gauss2') add('y', null, GAUSS2_PARAMS, (i) => i >= 2 && !fixNoise);
	else
		for (const a of ['x', 'y'] as const) {
			const id = y[a].family;
			const f = family(id);
			add('y', AXIS[a], f.params, (i) => i !== f.location && !fixNoise, ` (${a})`, (i) =>
				flatParam(id, i)
			);
		}
	return out;
}

function encode(all: Slot2[], m: Model): number[] {
	const out: number[] = [];
	for (const s of all) {
		if (!s.fitted) continue;
		if (s.domain === 'weight') {
			const c = (m.x as Extract<Spec2, { family: 'mixture2' }>).components;
			out.push(Math.log(c[s.sub as number].weight / c[0].weight));
		} else out.push(toFree(s.domain, arrayOf(m, s)[s.index]));
	}
	return out;
}

function decode(all: Slot2[], theta: readonly number[], m0: Model): Model {
	const m = structuredClone(m0);
	const logits: number[] = [];
	let k = 0;
	for (const s of all) {
		if (s.domain === 'weight') logits[s.sub as number] = s.fitted ? theta[k++] : 0;
		else if (s.fitted) arrayOf(m, s)[s.index] = fromFree(s.domain, theta[k++]);
	}
	if (m.x.family === 'mixture2') {
		const top = Math.max(...logits);
		const e = logits.map((l) => Math.exp(l - top));
		const total = e.reduce((a, b) => a + b, 0);
		m.x.components.forEach((c, i) => (c.weight = e[i] / total));
	}
	return m;
}

const valid = (m: Model) => validate2(m.x).length === 0 && validate2(m.y).length === 0;

/** A start whose signal matches the data's moments after removing the noise's. */
function momentStart(xs: Float64Array, ys: Float64Array, m: Model): Model | null {
	const Y = makeDist2(m.y, 'noise');
	if (!Y.mean || !Y.cov) return null;
	const mx = moments(xs);
	const my = moments(ys);
	let cxy = 0;
	for (let i = 0; i < xs.length; i++) cxy += (xs[i] - mx.mean) * (ys[i] - my.mean);
	cxy /= xs.length;
	const vx = Math.max(mx.variance - Y.cov[0], 0.05 * mx.variance);
	const vy = Math.max(my.variance - Y.cov[2], 0.05 * my.variance);
	const rho = Math.max(-0.9, Math.min(0.9, (cxy - Y.cov[1]) / Math.sqrt(vx * vy)));
	const meanX = mx.mean - Y.mean[0];
	const meanY = my.mean - Y.mean[1];
	const out = structuredClone(m);
	if (out.x.family === 'gauss2') out.x.params = [meanX, meanY, Math.sqrt(vx), Math.sqrt(vy), rho];
	else if (out.x.family === 'fringe2')
		out.x.params = [meanX, meanY, Math.sqrt(vx), Math.sqrt(vy), rho, ...out.x.params.slice(5)];
	else if (out.x.family === 'product') {
		for (const [a, mean, v] of [
			['x', meanX, vx],
			['y', meanY, vy]
		] as const) {
			const spec = out.x[a];
			const params = momentParams(spec.family, mean, v);
			family(spec.family).params.forEach((p, i) => {
				if (p.domain === 'count') params[i] = spec.params[i];
			});
			spec.params = params;
		}
	} else return null;
	return out;
}

/** The 2D model as the fitting core sees it; also the Bayesian fit's (`bayes.ts`). */
export function mle2Problem({ xs, ys, x, y, fixNoise = false }: Mle2Input): Problem<
	Model,
	Grid2
> & { slots: Slot2[] } {
	const all = slots(x, y, fixNoise);
	const m0: Model = { x, y };
	const startModels = [m0];
	const ms = valid(m0) ? momentStart(xs, ys, m0) : null;
	if (ms && valid(ms)) startModels.push(ms);
	const nll = (m: Model, grid: Grid2 | undefined) => {
		if (!valid(m)) return BAD;
		try {
			const X = makeDist2(m.x, 'signal');
			const Y = makeDist2(m.y, 'noise');
			// Each phase keeps its own capped grid (coarse search, finer polish), even where it
			// can't resolve a narrow noise: masses are capped at total 1, so this can't inflate ℓ.
			const g = grid ?? likelihoodGrid2(X, Y, xs, ys, SEARCH);
			const ll = logLikelihood2(X, Y, xs, ys, { grid: g });
			return Number.isFinite(ll) ? -ll : BAD;
		} catch {
			return BAD;
		}
	};
	return {
		slots: all,
		encode: (m) => encode(all, m),
		decode: (theta) => decode(all, theta, m0),
		valid,
		grid: (m, final) =>
			likelihoodGrid2(
				makeDist2(m.x, 'signal'),
				makeDist2(m.y, 'noise'),
				xs,
				ys,
				final ? FINAL : SEARCH
			),
		nll,
		infoGrid: (m) => {
			const X = makeDist2(m.x, 'signal');
			const Y = makeDist2(m.y, 'noise');
			return chooseGrid2(modelBox2(X, Y, 1e-4), X, Y, SEARCH);
		},
		cells: (m, g) =>
			zDensityOnGrid2(makeDist2(m.x, 'signal'), makeDist2(m.y, 'noise'), g).map(
				(f) => f * g.hx * g.hy
			),
		values: (m) =>
			all.map((s) =>
				s.domain === 'weight'
					? (m.x as Extract<Spec2, { family: 'mixture2' }>).components[s.sub as number].weight
					: arrayOf(m, s)[s.index]
			),
		starts: startModels,
		n: xs.length,
		sd: Math.sqrt(Math.min(moments(xs).variance, moments(ys).variance))
	};
}

export function fitMle2(input: Mle2Input): Mle2Result {
	const { seed, starts = 2 } = input;
	const problem = mle2Problem(input);
	const all: Slot2[] = problem.slots;
	const m0: Model = { x: input.x, y: input.y };
	const r = fitCore(problem, seed, starts);
	// Parameters held at 0 by definition (the noise's locations) aren't reported.
	const shown = all.map(
		(s) =>
			!(
				s.part === 'y' &&
				((m0.y.family === 'gauss2' && s.index < 2) ||
					(m0.y.family === 'product' &&
						s.index === family(m0.y[s.sub as 'x' | 'y'].family).location))
			)
	);
	const { fit, ...rest } = r;
	return { ...rest, x: fit.x, y: fit.y, params: r.params.filter((_, i) => shown[i]) };
}
