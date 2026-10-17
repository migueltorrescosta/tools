/**
 * Turns hall-of-fame candidates into Pareto-front entries: simplify, refit the
 * constants on the full train set, then measure train and validation error.
 */
import { fitConstants } from './constants';
import { complexity, compile, exprKey, programMse, runProgram } from './expr';
import { computeScores } from './front';
import { simplify } from './simplify';
import type { Dataset, Expr, FrontEntry, PreparedData } from './types';

/** A front entry before its score, which depends on its neighbours. */
export type Candidate = Omit<FrontEntry, 'score'>;

/** Above this many train rows, constants are first fitted on an evenly spaced subsample. */
const SUBSAMPLE_ROWS = 4000;
const subsamples = new WeakMap<Dataset, Dataset>();

function subsample(d: Dataset): Dataset {
	let s = subsamples.get(d);
	if (!s) {
		const n = d.y.length;
		const stride = n / SUBSAMPLE_ROWS;
		const pick = (col: Float64Array) =>
			Float64Array.from({ length: SUBSAMPLE_ROWS }, (_, i) => col[Math.floor(i * stride)]);
		s = { x: d.x.map(pick), y: pick(d.y) };
		subsamples.set(d, s);
	}
	return s;
}

/**
 * Simplifies, refits the constants on the full train set and scores one
 * expression on train and validation; null if infeasible. On large train sets
 * the fit starts on a subsample, then polishes on every row.
 */
export function rescore(expr: Expr, data: PreparedData, maxIter = 30): Candidate | null {
	let e = simplify(expr);
	if (data.train.y.length > 2 * SUBSAMPLE_ROWS) {
		const pre = fitConstants(e, subsample(data.train), maxIter);
		if (pre.improved) e = pre.expr;
		maxIter = 5;
	}
	const fit = fitConstants(e, data.train, maxIter);
	if (!Number.isFinite(fit.mse)) return null;
	if (fit.improved) e = simplify(fit.expr);
	const prog = compile(e);
	const trainMse = programMse(prog, data.train.x, data.train.y);
	if (!Number.isFinite(trainMse)) return null;
	// With an empty validation set the train set stands in, so metrics stay finite.
	const held = data.validation.y.length > 0 ? data.validation : data.train;
	const { x, y } = held;
	const n = y.length;
	const pred = runProgram(prog, x, n);
	if (!pred) return null;
	let mean = 0;
	for (let i = 0; i < n; i++) mean += y[i];
	mean /= n;
	let sse = 0;
	let sst = 0;
	for (let i = 0; i < n; i++) {
		const d = pred[i] - y[i];
		sse += d * d;
		const t = y[i] - mean;
		sst += t * t;
	}
	if (!Number.isFinite(sse)) return null;
	const valMse = sse / n;
	const valR2 = sst > 0 ? 1 - sse / sst : sse === 0 ? 1 : 0;
	return {
		complexity: complexity(e),
		expr: e,
		trainMse,
		valMse,
		valR2,
		valRmse: Math.sqrt(valMse)
	};
}

/** Relative train-MSE gain below which a more complex entry counts as a duplicate. */
const DUPLICATE_TOLERANCE = 1e-6;

/**
 * Merges candidates into a front: the lowest train MSE per complexity, entries
 * that do not beat every simpler one on train MSE (by more than
 * DUPLICATE_TOLERANCE, relative) dropped, sorted by complexity, with scores.
 */

export function mergeFront(candidates: Candidate[]): FrontEntry[] {
	const best = new Map<number, Candidate>();
	for (const c of candidates) {
		const b = best.get(c.complexity);
		if (!b || c.trainMse < b.trainMse) best.set(c.complexity, c);
	}
	const sorted = [...best.values()].sort((a, b) => a.complexity - b.complexity);
	const kept: Candidate[] = [];
	let floor = Infinity;
	for (const c of sorted) {
		// A more complex entry must beat every simpler one by more than rounding noise
		if (c.trainMse < floor * (1 - DUPLICATE_TOLERANCE)) {
			kept.push(c);
			floor = c.trainMse;
		}
	}
	const scores = computeScores(kept);
	return kept.map((c, i) => ({ ...c, score: scores[i] }));
}

/** Rescoring of each candidate (refit on the full train set) and merge into a front. */
export function buildFront(candidates: Expr[], data: PreparedData): FrontEntry[] {
	const out: Candidate[] = [];
	for (const e of candidates) {
		const c = rescore(e, data);
		if (c) out.push(c);
	}
	return mergeFront(out);
}

/** `rescore` with a cache keyed by expression, for repeated hall-of-fame reports. */
export class Rescorer {
	private cache = new Map<string, Candidate | null>();
	constructor(private data: PreparedData) {}

	rescore(expr: Expr): Candidate | null {
		const key = exprKey(expr);
		if (this.cache.has(key)) return this.cache.get(key) ?? null;
		if (this.cache.size > 5000) this.cache.clear();
		const c = rescore(expr, this.data);
		this.cache.set(key, c);
		return c;
	}

	rescoreAll(exprs: Expr[]): Candidate[] {
		const out: Candidate[] = [];
		for (const e of exprs) {
			const c = this.rescore(e);
			if (c) out.push(c);
		}
		return out;
	}
}
