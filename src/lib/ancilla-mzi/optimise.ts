/**
 * Optimisers: a projected L-BFGS with box bounds over the free controls,
 * Nelder–Mead and golden-section search for the small inner problems, and
 * the per-seed block-coordinate ascent of the Python engine (`optimise_seed`,
 * `finalise_controls`).
 */
import type { Prng } from '$lib/symbolic-regression/prng';
import type { BestResult, Budget, Role, SeedResult } from './types';
import { type CVec, outer, rectApply, vzeros } from './linalg';
import type { AncillaProblem } from './build';
import { qfiAndSld, qfiOfState, randomState, seesaw } from './qfi';
import { readouts } from './readouts';

// ---------------------------------------------------------------------------
// Bounded quasi-Newton
// ---------------------------------------------------------------------------

export interface LbfgsbOptions {
	maxIter?: number;
	/** Correction pairs kept. */
	memory?: number;
	/** Stop when the projected gradient's max norm is below this (scipy pgtol). */
	pgtol?: number;
	/** Stop when the relative reduction of f is below ftol (scipy factr · eps). */
	ftol?: number;
	/** Called after every evaluation of f. */
	onEval?: (evaluations: number, fBest: number) => void;
	/**
	 * Value and exact gradient (written into `g`) in one call; when given, it
	 * replaces the finite differences and is used at every trial point.
	 */
	fg?: (x: Float64Array, g: Float64Array) => number;
}

export interface LbfgsbResult {
	x: Float64Array;
	f: number;
	iterations: number;
	evaluations: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Minimise f over the box [lower, upper] by projected L-BFGS: the two-loop
 * direction on the variables that are not held at a bound, projected
 * backtracking with the Armijo condition, and forward-difference gradients
 * with step 1e-8 max(1, |x_i|) (backward at an upper bound), as scipy's
 * L-BFGS-B does by default.
 */
export function lbfgsb(
	f: (x: Float64Array) => number,
	x0: ArrayLike<number>,
	lower: ArrayLike<number>,
	upper: ArrayLike<number>,
	{
		maxIter = 40,
		memory = 10,
		pgtol = 1e-5,
		ftol = 2.220446049250313e-9,
		onEval,
		fg
	}: LbfgsbOptions = {}
): LbfgsbResult {
	const n = x0.length;
	let evaluations = 0;
	let fBest = Infinity;
	const evalF = (x: Float64Array, g?: Float64Array) => {
		const v = g && fg ? fg(x, g) : f(x);
		evaluations++;
		if (v < fBest) fBest = v;
		onEval?.(evaluations, fBest);
		return v;
	};
	const x = Float64Array.from(x0, (v, i) => clamp(v, lower[i], upper[i]));
	const grad = (xs: Float64Array, fx: number, out: Float64Array) => {
		if (fg) {
			evalF(xs, out);
			return out;
		}
		for (let i = 0; i < n; i++) {
			const xi = xs[i];
			let h = 1e-8 * Math.max(1, Math.abs(xi));
			if (xi + h > upper[i]) h = -h;
			xs[i] = xi + h;
			out[i] = (evalF(xs) - fx) / h;
			xs[i] = xi;
		}
		return out;
	};
	let g = new Float64Array(n);
	let fx = fg && n > 0 ? evalF(x, g) : evalF(x);
	if (n === 0) return { x, f: fx, iterations: 0, evaluations };
	if (!fg) grad(x, fx, g);
	const S: Float64Array[] = [];
	const Y: Float64Array[] = [];
	const atBound = (i: number, gi: number) =>
		(x[i] <= lower[i] && gi > 0) || (x[i] >= upper[i] && gi < 0);
	let iterations = 0;
	const d = new Float64Array(n);
	const xNew = new Float64Array(n);
	while (iterations < maxIter) {
		let pgMax = 0;
		const free = new Uint8Array(n);
		for (let i = 0; i < n; i++) {
			if (!atBound(i, g[i])) {
				free[i] = 1;
				pgMax = Math.max(pgMax, Math.abs(g[i]));
			}
		}
		if (pgMax < pgtol) break;
		iterations++;
		// two-loop recursion on the free variables
		const q = Float64Array.from(g, (v, i) => (free[i] ? v : 0));
		const dotF = (a: Float64Array, b: Float64Array) => {
			let s = 0;
			for (let i = 0; i < n; i++) if (free[i]) s += a[i] * b[i];
			return s;
		};
		const alpha: number[] = [];
		const rho: number[] = [];
		for (let k = S.length - 1; k >= 0; k--) {
			const sy = dotF(S[k], Y[k]);
			rho[k] = sy > 1e-300 ? 1 / sy : 0;
			alpha[k] = rho[k] * dotF(S[k], q);
			for (let i = 0; i < n; i++) if (free[i]) q[i] -= alpha[k] * Y[k][i];
		}
		if (S.length) {
			const k = S.length - 1;
			const yy = dotF(Y[k], Y[k]);
			const gamma = yy > 0 ? dotF(S[k], Y[k]) / yy : 1;
			for (let i = 0; i < n; i++) q[i] *= gamma > 0 ? gamma : 1;
		}
		for (let k = 0; k < S.length; k++) {
			const beta = rho[k] * dotF(Y[k], q);
			for (let i = 0; i < n; i++) if (free[i]) q[i] += (alpha[k] - beta) * S[k][i];
		}
		let gd = 0;
		for (let i = 0; i < n; i++) {
			d[i] = free[i] ? -q[i] : 0;
			gd += g[i] * d[i];
		}
		let first = S.length === 0;
		if (!(gd < 0)) {
			S.length = 0;
			Y.length = 0;
			first = true;
			for (let i = 0; i < n; i++) d[i] = free[i] ? -g[i] : 0;
		}
		// first step of unit length, then the quasi-Newton step
		let dNorm = 0;
		for (let i = 0; i < n; i++) dNorm = Math.max(dNorm, Math.abs(d[i]));
		let step = first ? Math.min(1, 1 / dNorm) : 1;
		let fNew = Infinity;
		let accepted = false;
		const gNew = new Float64Array(n);
		for (let tries = 0; tries < 30; tries++) {
			let decrease = 0;
			let moved = false;
			for (let i = 0; i < n; i++) {
				xNew[i] = clamp(x[i] + step * d[i], lower[i], upper[i]);
				decrease += g[i] * (xNew[i] - x[i]);
				if (xNew[i] !== x[i]) moved = true;
			}
			if (!moved) break;
			fNew = fg ? evalF(xNew, gNew) : evalF(xNew);
			if (fNew <= fx + 1e-4 * decrease) {
				accepted = true;
				break;
			}
			step *= 0.5;
		}
		if (!accepted) {
			if (S.length === 0) break;
			S.length = 0;
			Y.length = 0;
			continue;
		}
		if (!fg) grad(xNew, fNew, gNew);
		const s = Float64Array.from(xNew, (v, i) => v - x[i]);
		const y = Float64Array.from(gNew, (v, i) => v - g[i]);
		let sy = 0;
		let yy = 0;
		for (let i = 0; i < n; i++) {
			sy += s[i] * y[i];
			yy += y[i] * y[i];
		}
		if (sy > 2.2e-16 * yy) {
			S.push(s);
			Y.push(y);
			if (S.length > memory) {
				S.shift();
				Y.shift();
			}
		}
		const reduction = (fx - fNew) / Math.max(Math.abs(fx), Math.abs(fNew), 1);
		x.set(xNew);
		g = gNew;
		fx = fNew;
		if (reduction <= ftol) break;
	}
	return { x, f: fx, iterations, evaluations };
}

// ---------------------------------------------------------------------------
// One seed
// ---------------------------------------------------------------------------

export type SeedBudget = Pick<Budget, 'rounds' | 'maxIter' | 'seesawIter'>;

export interface SeedOutcome {
	qfi: number;
	params: Float64Array;
	psi: CVec;
	evaluations: number;
}

/** Seed 0: every control off; seed k > 0: N(0, 1) on the free entries, clipped to the bounds. */
export function seedParams(problem: AncillaProblem, seed: number, prng: Prng): Float64Array {
	const p = new Float64Array(problem.nParams);
	if (seed > 0) {
		for (const k of problem.free) p[k] = clamp(prng.normal(), -problem.bound[k], problem.bound[k]);
	}
	return p;
}

function uniformState(dim: number): CVec {
	const v = vzeros(dim);
	v.re.fill(1 / Math.sqrt(dim));
	return v;
}

/**
 * One seed of the block-coordinate ascent: see-saw from the product state
 * and two random inputs, then `rounds` × [L-BFGS over the controls at fixed
 * ψ, see-saw], stopping once a see-saw no longer improves the QFI.
 */
export function optimiseSeed(
	problem: AncillaProblem,
	params0: ArrayLike<number>,
	prng: Prng,
	budget: SeedBudget,
	onProgress?: (evaluations: number, best: number) => void,
	gradient: 'adjoint' | 'forward' = 'adjoint'
): SeedOutcome {
	const { iso, free, bound } = problem;
	let params = Float64Array.from(params0, (v, k) => clamp(v, -bound[k], bound[k]));
	let evaluations = 0;
	const starts = [uniformState(iso.cols), randomState(iso.cols, prng), randomState(iso.cols, prng)];
	const hold0 = problem.hold(params);
	const runs = starts.map((s) => seesaw(hold0, iso, s, budget.seesawIter));
	const first = runs.reduce((a, b) => (b.qfi > a.qfi ? b : a));
	let psi = first.psi;
	let qfi = first.qfi;
	for (const r of runs) evaluations += r.iterations;
	onProgress?.(evaluations, qfi);
	if (free.length === 0) return { qfi, params, psi, evaluations };
	const lower = free.map((k) => -bound[k]);
	const upper = free.map((k) => bound[k]);
	for (let round = 0; round < budget.rounds; round++) {
		const rho0 = outer(rectApply(iso, psi));
		const trial = Float64Array.from(params);
		const full = new Float64Array(problem.nParams);
		const set = (x: Float64Array) => {
			for (let i = 0; i < free.length; i++) trial[free[i]] = x[i];
		};
		const base = evaluations;
		const res = lbfgsb(
			(x) => {
				set(x);
				return -problem.objective(trial, rho0);
			},
			free.map((k) => params[k]),
			lower,
			upper,
			{
				maxIter: budget.maxIter,
				onEval: (n, fBest) => onProgress?.(base + n, Math.max(qfi, -fBest)),
				fg:
					gradient === 'adjoint'
						? (x, g) => {
								set(x);
								const v = problem.objective(trial, rho0, full);
								for (let i = 0; i < free.length; i++) g[i] = -full[free[i]];
								return -v;
							}
						: undefined
			}
		);
		evaluations += res.evaluations;
		const next = Float64Array.from(params);
		for (let i = 0; i < free.length; i++) next[free[i]] = res.x[i];
		const ss = seesaw(problem.hold(next), iso, psi, budget.seesawIter);
		evaluations += ss.iterations;
		if (!(ss.qfi > qfi + 1e-12)) break;
		params = next;
		psi = ss.psi;
		qfi = ss.qfi;
		onProgress?.(evaluations, qfi);
	}
	return { qfi, params, psi, evaluations };
}

export interface FinaliseOptions {
	/** Wall-clock cap on the see-saw polish. */
	polishMs?: number;
	/** Iteration cap on the see-saw polish. */
	polishIter?: number;
	/** Nelder–Mead starts per readout. */
	readoutStarts?: number;
}

const now = () => performance.now();

/**
 * Polish a seed's optimum by the see-saw (capped at `polishIter` iterations
 * and `polishMs`), re-evaluate it at 2M steps, flag saturated controls and
 * compute its readouts on the 2M-step state.
 */
export function finaliseBest(
	problem: AncillaProblem,
	seed: SeedResult,
	prng: Prng,
	{ polishMs = 800, polishIter = 2000, readoutStarts = 4 }: FinaliseOptions = {}
): BestResult {
	const { iso } = problem;
	const params = Float64Array.from(seed.params);
	let psi: CVec = { re: Float64Array.from(seed.psiRe), im: Float64Array.from(seed.psiIm) };
	let qfi = seed.qfi;
	const hold = problem.hold(params);
	const t0 = now();
	let used = 0;
	while (used < polishIter && now() - t0 < polishMs) {
		const chunk = Math.min(10, polishIter - used);
		const ss = seesaw(hold, iso, psi, chunk);
		used += ss.iterations;
		const improved = ss.qfi > qfi;
		if (improved) {
			qfi = ss.qfi;
			psi = ss.psi;
		}
		if (!improved || ss.iterations < chunk) break;
	}
	const fine = problem.exact ? hold : problem.hold(params, 2 * problem.steps);
	const { rho, drho } = fine.forward(outer(rectApply(iso, psi)));
	const qfiFine = problem.exact ? qfi : qfiAndSld(rho, drho).qfi;
	const saturated = Array.from(
		params,
		(p, k) => problem.bound[k] > 0 && Math.abs(p) >= problem.bound[k] * (1 - 1e-3)
	);
	return {
		...seed,
		qfi,
		psiRe: Array.from(psi.re),
		psiIm: Array.from(psi.im),
		qfiFine,
		saturated,
		readouts: readouts(rho, drho, problem.setup.nS, problem.setup.nA, prng, readoutStarts)
	};
}

/** A seed outcome as the contract's SeedResult. */
export function toSeedResult(role: Role, seed: number, o: SeedOutcome): SeedResult {
	return {
		role,
		seed,
		qfi: o.qfi,
		params: Array.from(o.params),
		psiRe: Array.from(o.psi.re),
		psiIm: Array.from(o.psi.im),
		evaluations: o.evaluations
	};
}
