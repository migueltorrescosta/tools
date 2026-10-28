/**
 * Shared types for the Deconvolution tool: distribution families, built
 * distributions and estimator results. We observe Z = X + Y with X (the
 * signal) independent of Y (the noise). No DOM or Svelte imports.
 */
import type { Prng } from '$lib/prng';

export type FamilyId =
	| 'normal'
	| 'laplace'
	| 'uniform'
	| 'exponential'
	| 'gamma'
	| 'lognormal'
	| 'studentT'
	| 'cauchy'
	| 'fringe'
	| 'poisson'
	| 'binomial'
	| 'geometric';

/** X is the signal, Y the noise. The noise never has a free location (see `makeDist`). */
export type Role = 'signal' | 'noise';

/**
 * A parameter's domain, which also fixes how fits move it:
 * `real` as is, `positive` on a log scale, `unit` (0 < v < 1) and
 * `unitClosed` (0 ≤ v ≤ 1) on a logit scale; `count` (a whole number ≥ 0) is held fixed.
 */
export type Domain = 'real' | 'positive' | 'unit' | 'unitClosed' | 'count';

export interface ParamSpec {
	/** Stable key used in state and CSV, e.g. `sigma`. */
	key: string;
	/** Short label shown next to the field, e.g. `σ`. */
	label: string;
	default: number;
	domain: Domain;
}

export interface ParamError {
	/** Parameter index the message belongs to, or -1 for the whole distribution. */
	index: number;
	message: string;
}

/** Point masses in increasing `x` order. */
export interface Atoms {
	x: Float64Array;
	p: Float64Array;
}

/** Atoms below this mass are dropped when a discrete support is enumerated. */
export const ATOM_EPS = 1e-12;

/**
 * One distribution family. Continuous families define `pdf`, discrete ones `atoms`.
 * All methods assume valid parameters (see `validateParams` in `families.ts`).
 */
export interface Family {
	id: FamilyId;
	/** Display name, e.g. `Normal`. */
	name: string;
	discrete: boolean;
	params: readonly ParamSpec[];
	/** Index of a pure location parameter; held at 0 in the noise role. */
	location?: number;
	/** Checks beyond each parameter's domain, e.g. uniform low < high. */
	validate?(params: readonly number[]): ParamError[];
	pdf?(x: number, params: readonly number[]): number;
	/** Support points holding at least 1 − eps of the mass, with their masses. */
	atoms?(params: readonly number[], eps: number): Atoms;
	/** Characteristic function E[e^{itX}] as [re, im]. */
	cf(t: number, params: readonly number[]): [number, number];
	/** Undefined when the mean doesn't exist (Cauchy, t with ν ≤ 1). */
	mean(params: readonly number[]): number | undefined;
	/** Undefined when the variance doesn't exist or is infinite. */
	variance(params: readonly number[]): number | undefined;
	/** An interval holding at least 1 − eps of the mass (need not be tight; within 2× is fine). */
	range(params: readonly number[], eps: number): [number, number];
	sampler(params: readonly number[]): (prng: Prng) => number;
}

export interface SimpleSpec {
	family: FamilyId;
	params: number[];
}

export interface MixtureSpec {
	family: 'mixture';
	/** 2–3 components, all continuous or all discrete; weights are normalised. */
	components: (SimpleSpec & { weight: number })[];
}

export type DistSpec = SimpleSpec | MixtureSpec;

/** A built distribution: a continuous part, point masses, or (never both) one of them. */
export interface Dist {
	/** Density, or null for a discrete distribution. */
	pdf: ((x: number) => number) | null;
	/** Empty for a continuous distribution. */
	atoms: Atoms;
	cf(t: number): [number, number];
	range(eps: number): [number, number];
	mean: number | undefined;
	sampler: (prng: Prng) => number;
}

/** A uniform grid `x_j = x0 + j·h`, j = 0 … m − 1. */
export interface Grid {
	x0: number;
	h: number;
	m: number;
}

/** A density estimate on a grid, as cell masses (sums to 1). */
export interface GridEstimate {
	grid: Grid;
	/** Mass of each grid cell; `mass[j] / h` is the density at `x_j`. */
	mass: Float64Array;
}

export type MethodId = 'mle' | 'npmle' | 'gmodel' | 'kernel' | 'gmm';
