/**
 * One estimation task, as the page sends it to a worker: plain data in,
 * plain data out (distributions are rebuilt from their specs, since
 * functions can't cross `postMessage`). Also which methods apply to a noise.
 * No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { family } from './families';
import { fitGmm, gmmSpec } from './gmm';
import { cfHasZeros, fitKernel } from './kernel';
import { truthOnGrid } from './metrics';
import { compareFamilies, fitMle, type MleInput, type MleResult } from './mle';
import { fitGmodel } from './gmodel';
import { binData } from './binning';
import { fitNpmle, gridLogLik, likelihoodMatrix } from './npmle';
import { resample } from './sample';
import { runTask2, type Task2, type TaskResult2 } from './estimate2';
import type { DistSpec, FamilyId, Grid, GridEstimate, MethodId, SimpleSpec } from './types';

export type GridMethod = Exclude<MethodId, 'mle'>;

export interface GridOptions {
	df: number;
	c0: number;
	bandwidth: number | null;
	seed: number;
}

export type Task =
	| { kind: 'mle'; input: MleInput }
	| {
			kind: 'compare';
			data: Float64Array;
			y: SimpleSpec;
			families: FamilyId[];
			fixedY: boolean[];
			seed: number;
	  }
	| {
			kind: 'grid';
			method: GridMethod;
			data: Float64Array;
			y: SimpleSpec;
			grid: Grid;
			options: GridOptions;
	  }
	| {
			kind: 'bootstrap';
			method: GridMethod;
			data: Float64Array;
			y: SimpleSpec;
			grid: Grid;
			options: GridOptions;
			seed: number;
			count: number;
	  }
	| Task2;

export interface GridResult extends GridEstimate {
	method: GridMethod;
	/** Σ log Σⱼ mⱼ f_Y(zᵢ − aⱼ): the sample's log-likelihood with X on the grid. */
	logLik: number;
	/** Free parameters, for the methods that have a count (the Gaussian mixture). */
	k?: number;
	/** The fitted X, for the Gaussian mixture. */
	x?: DistSpec;
	/** Kernel bandwidth used. */
	bandwidth?: number;
	/** Kernel: share of the raw estimate that was negative and clipped. */
	negativeMass?: number;
	converged?: boolean;
}

export type TaskResult =
	| { kind: 'mle'; result: MleResult }
	| { kind: 'compare'; results: { family: FamilyId; result: MleResult }[] }
	| { kind: 'grid'; result: GridResult }
	| { kind: 'bootstrap'; masses: Float64Array[] }
	| TaskResult2;

/** Why a method can't run with this noise, or null when it can. */
export function unavailable(method: MethodId, y: SimpleSpec): string | null {
	const f = family(y.family);
	if (method === 'mle') return null;
	if (method === 'gmm')
		return y.family === 'normal' ? null : 'The Gaussian mixture needs normal noise.';
	if (f.discrete) return 'Needs a continuous noise.';
	// Of the continuous noises, only these have characteristic functions with zeros.
	if (method === 'kernel' && (y.family === 'uniform' || y.family === 'fringe')) {
		// Kernel deconvolution needs φ_Y ≠ 0; look well past any bandwidth's cutoff.
		const Y = makeDist(y, 'noise');
		const [lo, hi] = Y.range(0.5);
		const scale = Y.variance !== undefined ? Math.sqrt(Y.variance) : (hi - lo) / 2;
		if (cfHasZeros(Y, 50 / scale)) return 'This noise’s characteristic function has zeros.';
	}
	return null;
}

/** Log-likelihood of the sample with X given as cell masses on the grid. */
export function sampleLogLik(data: Float64Array, y: SimpleSpec, est: GridEstimate): number {
	const { z, c } = binData(data);
	return gridLogLik(likelihoodMatrix(z, makeDist(y, 'noise'), est.grid), c, est.mass);
}

function gridFit(
	method: GridMethod,
	data: Float64Array,
	y: SimpleSpec,
	grid: Grid,
	o: GridOptions
): GridResult {
	const Y = makeDist(y, 'noise');
	switch (method) {
		case 'npmle': {
			const r = fitNpmle({ data, y: Y, grid });
			return { method, grid: r.grid, mass: r.mass, logLik: r.logLik, converged: r.converged };
		}
		case 'gmodel': {
			const r = fitGmodel({ data, y: Y, grid, df: o.df, c0: o.c0 });
			return {
				method,
				grid: r.grid,
				mass: r.mass,
				logLik: sampleLogLik(data, y, r),
				converged: r.converged
			};
		}
		case 'kernel': {
			const r = fitKernel({
				data,
				y: Y,
				grid,
				bandwidth: o.bandwidth ?? undefined,
				gaussianNoise: y.family === 'normal'
			});
			return {
				method,
				grid: r.grid,
				mass: r.mass,
				logLik: sampleLogLik(data, y, r),
				bandwidth: r.bandwidth,
				negativeMass: r.negativeMass
			};
		}
		case 'gmm': {
			const sigma = y.params[1];
			const r = fitGmm({ data, noiseSigma: sigma, seed: o.seed });
			const x = gmmSpec(r.best);
			const est = truthOnGrid(makeDist(x, 'signal'), grid);
			return {
				method,
				grid,
				mass: est.mass,
				logLik: r.best.logLik,
				k: 3 * r.best.k - 1,
				x
			};
		}
	}
}

/** Runs one task (in a worker, or directly in specs). */
export function runTask(task: Task): TaskResult {
	switch (task.kind) {
		case 'mle2':
		case 'grid2':
		case 'bootstrap2':
			return runTask2(task);
		case 'mle':
			return { kind: 'mle', result: fitMle(task.input) };
		case 'compare':
			return {
				kind: 'compare',
				results: compareFamilies(task.data, task.y, task.families, task.seed, task.fixedY)
			};
		case 'grid':
			return {
				kind: 'grid',
				result: gridFit(task.method, task.data, task.y, task.grid, task.options)
			};
		case 'bootstrap': {
			const prng = new Prng(task.seed);
			const masses: Float64Array[] = [];
			for (let b = 0; b < task.count; b++) {
				const data = resample(task.data, prng);
				const options = { ...task.options, seed: task.options.seed + b };
				masses.push(gridFit(task.method, data, task.y, task.grid, options).mass);
			}
			return { kind: 'bootstrap', masses };
		}
	}
}
