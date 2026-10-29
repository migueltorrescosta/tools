/**
 * Objective Bayesian fit of the parametric model (`mle.ts`, `mle2.ts`): the
 * posterior of the fitted parameters under a Jeffreys prior built from f_Z,
 * sampled by adaptive random-walk Metropolis on the fit's free scale. The
 * page runs several chains in chunks, so it can show progress and stop, and
 * checks them with R̂ and the effective sample size. No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { quantileSorted } from '$lib/stats';
import { BAD, fromFree, hessian, type Problem, type Slot } from './fitcore';
import { invertSymmetric, symmetricEigen } from './linalg';

/** Finite-difference step of the information, on the free scale. */
const STEP = 1e-3;
/** The box: positive parameters within this factor of the MLE, unit ones and correlations this far from their edges. */
const FACTOR = 1000;
const EDGE = 1e-3;
/** A draw within this share of the box's width from an edge counts as at the edge. */
const EDGE_ZONE = 0.02;
/** More than this share of draws at an edge flags the parameter. */
const EDGE_SHARE = 0.05;
/** Iterations of warm-up before the proposal adapts, and between its updates. */
const ADAPT_START = 200;
const ADAPT_EVERY = 100;

export interface Posterior {
	/** Fitted parameters, in slot order. */
	free: Slot[];
	/** Free-scale bounds of each fitted parameter. */
	box: [number, number][];
	/** The MLE on the free scale. */
	theta0: number[];
	/** log prior + log-likelihood, up to a constant; −Infinity outside the box. */
	logPost(theta: readonly number[]): number;
	logPrior(theta: readonly number[]): number;
	/** Inverse observed information at the MLE, the first proposal's shape. */
	initialCov(): number[][];
}

const logit = (p: number) => Math.log(p / (1 - p));

/**
 * The posterior of `p` around its MLE `fit`. Locations (and a uniform's
 * width) get a flat prior on the free scale; every other fitted parameter
 * gets √det of the expected Fisher information of f_Z, summed over the
 * cells of a grid that holds nearly all of f_Z (`infoGrid`), so the prior
 * doesn't depend on the data. The free scale makes this the Jeffreys prior
 * of the original parameters too, Jacobian included.
 */
export function posterior<S, G>(p: Problem<S, G>, fit: S): Posterior {
	const free = p.slots.filter((s) => s.fitted);
	const theta0 = p.encode(fit);
	const grid = p.grid(fit, true) as G;
	const box = free.map((s, j): [number, number] => {
		const t = theta0[j];
		if (s.domain === 'positive') return [t - Math.log(FACTOR), t + Math.log(FACTOR)];
		if (s.domain === 'unit' || s.domain === 'unitClosed') return [logit(EDGE), logit(1 - EDGE)];
		if (s.domain === 'corr') return [Math.atanh(-1 + EDGE), Math.atanh(1 - EDGE)];
		return [t - FACTOR * p.sd, t + FACTOR * p.sd];
	});
	const inner = free.flatMap((s, j) => (s.flat ? [] : [j]));

	function logPrior(theta: readonly number[]): number {
		if (inner.length === 0) return 0;
		try {
			const centre = p.decode(theta);
			const g = p.infoGrid(centre);
			const cells = (t: readonly number[]) => p.cells(p.decode(t), g);
			const c0 = p.cells(centre, g);
			const d = inner.map((j) => {
				const up = [...theta];
				up[j] += STEP;
				const a = cells(up);
				return c0.map((v, k) => (a[k] - v) / STEP);
			});
			const info = inner.map(() => new Array<number>(inner.length).fill(0));
			for (let k = 0; k < c0.length; k++) {
				if (!(c0[k] > 0)) continue;
				for (let a = 0; a < inner.length; a++)
					for (let b = 0; b <= a; b++) info[a][b] += (d[a][k] * d[b][k]) / c0[k];
			}
			for (let a = 0; a < inner.length; a++) for (let b = 0; b < a; b++) info[b][a] = info[a][b];
			const { values } = symmetricEigen(info);
			if (!(values[0] > 0)) return -Infinity;
			return 0.5 * values.reduce((s, v) => s + Math.log(v), 0);
		} catch {
			return -Infinity;
		}
	}

	function logPost(theta: readonly number[]): number {
		if (theta.some((t, j) => !(t >= box[j][0] && t <= box[j][1]))) return -Infinity;
		const s = p.decode(theta);
		if (!p.valid(s)) return -Infinity;
		const nll = p.nll(s, grid);
		if (!(nll < BAD)) return -Infinity;
		return -nll + logPrior(theta);
	}

	function initialCov(): number[][] {
		const H = hessian((t) => p.nll(p.decode(t), grid), theta0);
		const cov = invertSymmetric(H);
		const ok = cov && symmetricEigen(cov).values[0] > 0;
		return ok ? cov : theta0.map((_, i) => theta0.map((_, j) => (i === j ? 0.01 : 0)));
	}

	return { free, box, theta0, logPost, logPrior, initialCov };
}

/** One chain's state, carried from chunk to chunk (plain data, so it can cross `postMessage`). */
export interface Chain {
	theta: number[];
	logPost: number;
	iteration: number;
	accepted: number;
	/** Running mean and scatter of the warm-up draws (Welford). */
	mean: number[];
	scatter: number[][];
	/** Proposal step = factor · z with z standard normal. */
	factor: number[][];
}

/** F with F Fᵀ = scale · cov. */
function factorOf(cov: number[][], scale: number): number[][] {
	const { values, vectors } = symmetricEigen(cov);
	// vectors[k] is the k-th eigenvector.
	return cov.map((_, i) =>
		values.map((v, k) => vectors[k][i] * Math.sqrt(Math.max(v, 1e-12) * scale))
	);
}

/** The adaptive Metropolis step, (2.38²/d) · cov (Haario, Saksman & Tamminen 2001). */
const proposalFactor = (cov: number[][]) => factorOf(cov, (2.38 * 2.38) / cov.length);

/** A chain started away from the MLE (within its box), so chains that agree say something. */
export function startChain(post: Posterior, seed: number): Chain {
	const prng = new Prng(seed);
	const cov = post.initialCov();
	// Twice the MLE's standard errors.
	const wide = factorOf(cov, 4);
	let theta = post.theta0;
	let lp = post.logPost(theta);
	for (let tries = 0; tries < 20; tries++) {
		const z = theta.map(() => prng.normal());
		const t = post.theta0.map((v, i) => {
			const [lo, hi] = post.box[i];
			const u = v + wide[i].reduce((s, f, k) => s + f * z[k], 0);
			return Math.min(hi, Math.max(lo, u));
		});
		const l = post.logPost(t);
		if (Number.isFinite(l)) {
			theta = t;
			lp = l;
			break;
		}
	}
	const d = theta.length;
	return {
		theta,
		logPost: lp,
		iteration: 0,
		accepted: 0,
		mean: new Array<number>(d).fill(0),
		scatter: Array.from({ length: d }, () => new Array<number>(d).fill(0)),
		factor: proposalFactor(cov)
	};
}

/**
 * `steps` more Metropolis iterations. During the first `warmup` iterations of
 * the chain the proposal adapts to the draws' covariance; after it the
 * proposal is fixed and every state is a draw.
 */
export function advance(
	post: Posterior,
	start: Chain,
	steps: number,
	warmup: number,
	seed: number
): { chain: Chain; draws: number[][] } {
	const prng = new Prng(seed);
	const c = structuredClone(start);
	const d = c.theta.length;
	const draws: number[][] = [];
	for (let s = 0; s < steps; s++) {
		const z = c.theta.map(() => prng.normal());
		const prop = c.theta.map((v, i) => v + c.factor[i].reduce((a, f, k) => a + f * z[k], 0));
		const lp = post.logPost(prop);
		if (Math.log(1 - prng.next()) < lp - c.logPost) {
			c.theta = prop;
			c.logPost = lp;
			c.accepted++;
		}
		c.iteration++;
		if (c.iteration <= warmup) {
			const n = c.iteration;
			const delta = c.theta.map((v, i) => v - c.mean[i]);
			c.mean = c.mean.map((m, i) => m + delta[i] / n);
			for (let i = 0; i < d; i++)
				for (let j = 0; j < d; j++) c.scatter[i][j] += delta[i] * (c.theta[j] - c.mean[j]);
			if (n >= ADAPT_START && n % ADAPT_EVERY === 0)
				c.factor = proposalFactor(
					c.scatter.map((r, i) => r.map((v, j) => v / (n - 1) + (i === j ? 1e-8 : 0)))
				);
		} else draws.push([...c.theta]);
	}
	return { chain: c, draws };
}

/** Split R̂ (Gelman et al., BDA3 §11.4) of one parameter over chains of equal length. */
export function splitRhat(chains: readonly number[][]): number {
	const half = Math.floor(chains[0].length / 2);
	const seqs = chains.flatMap((c) => [c.slice(0, half), c.slice(half, 2 * half)]);
	const n = half;
	const means = seqs.map((s) => s.reduce((a, b) => a + b, 0) / n);
	const grand = means.reduce((a, b) => a + b, 0) / means.length;
	const B = (n / (means.length - 1)) * means.reduce((a, m) => a + (m - grand) ** 2, 0);
	const W =
		seqs.reduce((a, s, i) => a + s.reduce((b, v) => b + (v - means[i]) ** 2, 0) / (n - 1), 0) /
		seqs.length;
	return W > 0 ? Math.sqrt(((n - 1) / n) * W + B / n) / Math.sqrt(W) : NaN;
}

/** Effective sample size over chains (BDA3 §11.5, Geyer's initial monotone sequence). */
export function effectiveSize(chains: readonly number[][]): number {
	const M = chains.length;
	const n = chains[0].length;
	const means = chains.map((c) => c.reduce((a, b) => a + b, 0) / n);
	const grand = means.reduce((a, b) => a + b, 0) / M;
	const B = M > 1 ? (n / (M - 1)) * means.reduce((a, m) => a + (m - grand) ** 2, 0) : 0;
	const W =
		chains.reduce((a, c, i) => a + c.reduce((b, v) => b + (v - means[i]) ** 2, 0), 0) /
		(M * (n - 1));
	const varPlus = ((n - 1) / n) * W + B / n;
	if (!(varPlus > 0)) return NaN;
	const rho = (t: number) => {
		let v = 0;
		for (const c of chains) for (let i = 0; i + t < n; i++) v += (c[i] - c[i + t]) ** 2;
		return 1 - v / (M * (n - t)) / (2 * varPlus);
	};
	let tau = -1;
	let prev = Infinity;
	for (let t = 0; t + 1 < n; t += 2) {
		const pair = Math.min(prev, rho(t) + rho(t + 1));
		if (!(pair > 0)) break;
		tau += 2 * pair;
		prev = pair;
	}
	return (M * n) / Math.max(tau, 1 / Math.log10(M * n));
}

export interface ParamPosterior {
	role: Slot['role'];
	component: number | null;
	key: string;
	/** Posterior median and 95% equal-tailed credible interval, on the parameter's own scale. */
	median: number;
	lower: number;
	upper: number;
	rhat: number;
	ess: number;
	/** More than EDGE_SHARE of the draws sit at an edge of the box: the posterior may be improper there. */
	edge: boolean;
}

/** Per fitted parameter: median, 95% interval, R̂, ESS and the edge check, from each chain's draws. */
export function summarise(
	free: readonly Slot[],
	box: readonly [number, number][],
	chains: readonly number[][][]
): ParamPosterior[] {
	return free.map((s, j) => {
		const per = chains.map((c) => c.map((t) => t[j]));
		const pooled = Float64Array.from(per.flat()).sort();
		const [lo, hi] = box[j];
		const zone = EDGE_ZONE * (hi - lo);
		const atEdge = pooled.filter((v) => v < lo + zone || v > hi - zone).length / pooled.length;
		const back = (q: number) =>
			s.domain === 'weight' ? NaN : fromFree(s.domain, quantileSorted(pooled, q));
		return {
			role: s.role,
			component: s.component,
			key: s.key,
			median: back(0.5),
			lower: back(0.025),
			upper: back(0.975),
			rhat: splitRhat(per),
			ess: effectiveSize(per),
			edge: atEdge > EDGE_SHARE
		};
	});
}
