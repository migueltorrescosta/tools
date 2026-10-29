/**
 * The 2D estimation tasks a worker runs (see `estimate.ts` for 1D): the
 * parametric fit, the NPMLE and the Gaussian mixture on a shared 64 × 64
 * support grid, and bootstrap resamples. No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { binData2 } from './binning2';
import { makeDist2, type Grid2, type GridEstimate2, type Noise2Spec, type Spec2 } from './dist2';
import { fitGmm2, gmm2Spec } from './gmm2';
import { fitMle2, type Mle2Input, type Mle2Result } from './mle2';
import { dirichletGibbs, gridLogLik } from './npmle';
import { fitNpmle2, likelihoodMatrix2 } from './npmle2';

/** The 2D methods: kernel deconvolution and g-modeling stay 1D-only. */
export type Method2 = 'mle' | 'npmle' | 'gmm';
export type GridMethod2 = Exclude<Method2, 'mle'>;

export type Task2 =
	| { kind: 'mle2'; input: Mle2Input }
	| {
			kind: 'grid2';
			method: GridMethod2;
			xs: Float64Array;
			ys: Float64Array;
			y: Noise2Spec;
			grid: Grid2;
			seed: number;
	  }
	| {
			kind: 'bootstrap2';
			method: GridMethod2;
			xs: Float64Array;
			ys: Float64Array;
			y: Noise2Spec;
			grid: Grid2;
			seed: number;
			count: number;
	  }
	| {
			kind: 'posterior2';
			xs: Float64Array;
			ys: Float64Array;
			y: Noise2Spec;
			grid: Grid2;
			/** The chain's current masses; null starts from uniform. */
			mass: Float64Array | null;
			sweeps: number;
			seed: number;
	  };

export interface GridResult2 extends GridEstimate2 {
	method: GridMethod2;
	/** The sample's log-likelihood with X as the masses on the grid (the mixture: its own). */
	logLik: number;
	/** Free parameters of the Gaussian mixture. */
	k?: number;
	/** The Gaussian mixture's fitted X. */
	x?: Spec2;
	converged?: boolean;
}

export type TaskResult2 =
	| { kind: 'mle2'; result: Mle2Result }
	| { kind: 'grid2'; result: GridResult2 }
	| { kind: 'bootstrap2'; masses: Float64Array[] }
	/** The masses after each sweep. */
	| { kind: 'posterior2'; masses: Float64Array[] };

/** Why a 2D method can't run with this noise, or null when it can. */
export function unavailable2(method: Method2, y: Noise2Spec): string | null {
	if (method === 'gmm' && y.family !== 'gauss2')
		return 'The Gaussian mixture needs Gaussian noise.';
	return null;
}

/** `d` as cell masses on `grid`, renormalised to sum 1. */
export function truthOnGrid2(spec: Spec2, grid: Grid2): GridEstimate2 {
	const mass = makeDist2(spec, 'signal').masses(grid);
	const total = mass.reduce((s, v) => s + v, 0);
	return { grid, mass: total > 0 ? mass.map((v) => v / total) : mass };
}

/** Log-likelihood of a 2D sample with X as cell masses on the grid. */
export function sampleLogLik2(
	xs: Float64Array,
	ys: Float64Array,
	y: Noise2Spec,
	est: GridEstimate2
) {
	const b = binData2(xs, ys);
	return gridLogLik(likelihoodMatrix2(b.x, b.y, makeDist2(y, 'noise'), est.grid), b.c, est.mass);
}

function gridFit2(
	method: GridMethod2,
	xs: Float64Array,
	ys: Float64Array,
	y: Noise2Spec,
	grid: Grid2,
	seed: number
): GridResult2 {
	const Y = makeDist2(y, 'noise');
	if (method === 'npmle') {
		const r = fitNpmle2({ xs, ys, y: Y, grid });
		return { method, grid, mass: r.mass, logLik: r.logLik, converged: r.converged };
	}
	const { best } = fitGmm2({ xs, ys, noise: Y.cov!, seed });
	const x = gmm2Spec(best);
	return { method, ...truthOnGrid2(x, grid), logLik: best.logLik, k: 6 * best.k - 1, x };
}

/** Draws n pairs with replacement. */
function resample2(xs: Float64Array, ys: Float64Array, prng: Prng) {
	const n = xs.length;
	const a = new Float64Array(n);
	const b = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const k = prng.int(n);
		a[i] = xs[k];
		b[i] = ys[k];
	}
	return { a, b };
}

export function runTask2(task: Task2): TaskResult2 {
	switch (task.kind) {
		case 'mle2':
			return { kind: 'mle2', result: fitMle2(task.input) };
		case 'grid2':
			return {
				kind: 'grid2',
				result: gridFit2(task.method, task.xs, task.ys, task.y, task.grid, task.seed)
			};
		case 'bootstrap2': {
			const prng = new Prng(task.seed);
			const masses: Float64Array[] = [];
			for (let b = 0; b < task.count; b++) {
				const { a, b: c } = resample2(task.xs, task.ys, prng);
				masses.push(gridFit2(task.method, a, c, task.y, task.grid, task.seed + b).mass);
			}
			return { kind: 'bootstrap2', masses };
		}
		case 'posterior2': {
			const b = binData2(task.xs, task.ys);
			const L = likelihoodMatrix2(b.x, b.y, makeDist2(task.y, 'noise'), task.grid);
			const m = task.grid.mx * task.grid.my;
			const start = task.mass ?? new Float64Array(m).fill(1 / m);
			const masses = dirichletGibbs(L, b.c, m, start, task.sweeps, new Prng(task.seed));
			return { kind: 'posterior2', masses };
		}
	}
}
