import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { advance, effectiveSize, posterior, splitRhat, startChain, summarise } from './bayes';
import { makeDist } from './dist';
import { mleProblem } from './mle';
import { mle2Problem } from './mle2';
import { simulate } from './sample';
import type { Spec2 } from './dist2';
import type { DistSpec, SimpleSpec } from './types';

/** ψ′(x) by recurrence up to x ≥ 20, then its asymptotic series. */
function trigamma(x: number): number {
	let s = 0;
	while (x < 20) s += 1 / (x * x++);
	const x2 = x * x;
	return s + 1 / x + 1 / (2 * x2) + 1 / (6 * x2 * x) - 1 / (30 * x2 * x2 * x);
}

/** logPrior of a 1D model with the noise held fixed, at the free vector of `x`. */
function prior1(data: Float64Array, x0: SimpleSpec, y: SimpleSpec) {
	const p = mleProblem({ data, x: x0, y, fixedY: y.params.map(() => true), seed: 1 });
	const post = posterior(p, { x: x0, y });
	return (x: SimpleSpec) => post.logPrior(p.encode({ x, y }));
}

const sample = (x: DistSpec, y: SimpleSpec, n = 2000) =>
	simulate(makeDist(x, 'signal'), makeDist(y, 'noise'), n, 7);

/** The free scale is log for positive and logit for unit parameters, so priors there carry θ or p(1−p). */
describe('Jeffreys prior of f_Z on the free scale', () => {
	it('normal signal + normal noise of known σ_Y: exactly σ²/(σ² + σ_Y²) on log σ', () => {
		const y: SimpleSpec = { family: 'normal', params: [0, 0.3] };
		const x = (s: number): SimpleSpec => ({ family: 'normal', params: [0, s] });
		const lp = prior1(sample(x(1), y), x(1), y);
		const exact = (s: number) => Math.log((s * s) / (s * s + 0.09));
		for (const s of [0.1, 0.5, 2]) expect(lp(x(s)) - lp(x(1))).toBeCloseTo(exact(s) - exact(1), 2);
	});

	const tiny: SimpleSpec = { family: 'normal', params: [0, 0.01] };

	it('Laplace scale: 1/σ, flat on log σ', () => {
		const x = (b: number): SimpleSpec => ({ family: 'laplace', params: [0, b] });
		const lp = prior1(sample(x(1), tiny), x(1), tiny);
		expect(lp(x(0.5)) - lp(x(2))).toBeCloseTo(0, 1);
	});

	it('Student t: the independence Jeffreys prior in ν (Fonseca et al. 2008), 1/s in the scale', () => {
		const g = (nu: number) =>
			Math.sqrt(nu / (nu + 3)) *
			Math.sqrt(trigamma(nu / 2) - trigamma((nu + 1) / 2) - (2 * (nu + 3)) / (nu * (nu + 1) ** 2));
		const x = (nu: number, s = 1): SimpleSpec => ({ family: 'studentT', params: [nu, 0, s] });
		const lp = prior1(sample(x(5), tiny), x(5), tiny);
		// On log ν the density is ν g(ν).
		const exact = (nu: number) => Math.log(nu * g(nu));
		for (const nu of [2, 10]) expect(lp(x(nu)) - lp(x(5))).toBeCloseTo(exact(nu) - exact(5), 1);
		expect(lp(x(5, 0.5)) - lp(x(5, 2))).toBeCloseTo(0, 1);
	});

	it('gamma: its Jeffreys prior √(kψ′(k) − 1)/θ', () => {
		const x = (k: number, th = 1): SimpleSpec => ({ family: 'gamma', params: [k, th] });
		const lp = prior1(sample(x(3), tiny), x(3), tiny);
		const exact = (k: number) => Math.log(k * Math.sqrt(k * trigamma(k) - 1));
		for (const k of [1.5, 8]) expect(lp(x(k)) - lp(x(3))).toBeCloseTo(exact(k) - exact(3), 1);
		expect(lp(x(3, 0.5)) - lp(x(3, 2))).toBeCloseTo(0, 1);
	});

	// Poisson noise of tiny mean keeps Z discrete, so the prior uses the exact pmf.
	const few: SimpleSpec = { family: 'poisson', params: [1e-4] };

	it('Poisson + Poisson noise of known mean: exactly 1/√(λ + λ_Y)', () => {
		const y: SimpleSpec = { family: 'poisson', params: [0.5] };
		const x = (l: number): SimpleSpec => ({ family: 'poisson', params: [l] });
		const lp = prior1(sample(x(4), y), x(4), y);
		const exact = (l: number) => Math.log(l / Math.sqrt(l + 0.5));
		for (const l of [1, 9]) expect(lp(x(l)) - lp(x(4))).toBeCloseTo(exact(l) - exact(4), 2);
	});

	it('binomial: Beta(½, ½)', () => {
		const x = (p: number): SimpleSpec => ({ family: 'binomial', params: [20, p] });
		const lp = prior1(sample(x(0.4), few), x(0.4), few);
		const exact = (p: number) => 0.5 * Math.log(p * (1 - p));
		for (const p of [0.1, 0.8]) expect(lp(x(p)) - lp(x(0.4))).toBeCloseTo(exact(p) - exact(0.4), 2);
	});

	it('geometric: p^−1 (1 − p)^−½', () => {
		const x = (p: number): SimpleSpec => ({ family: 'geometric', params: [p] });
		const lp = prior1(sample(x(0.3), few), x(0.3), few);
		const exact = (p: number) => 0.5 * Math.log(1 - p);
		for (const p of [0.1, 0.7]) expect(lp(x(p)) - lp(x(0.3))).toBeCloseTo(exact(p) - exact(0.3), 2);
	});

	it('uniform: centre and width both flat (1/width)', () => {
		const x = (w: number): SimpleSpec => ({ family: 'uniform', params: [0, w] });
		const lp = prior1(sample(x(2), tiny), x(2), tiny);
		expect(lp(x(1))).toBe(0);
		expect(lp(x(4))).toBe(0);
	});

	it('correlated Gaussian: its Jeffreys prior 1/(σx σy (1 − ρ²)^{3/2})', () => {
		const x = (sx: number, rho: number): Spec2 => ({
			family: 'gauss2',
			params: [0, 0, sx, 1, rho]
		});
		const y: Spec2 = { family: 'gauss2', params: [0, 0, 0.05, 0.05, 0] };
		const prng = new Prng(3);
		const xs = Float64Array.from({ length: 500 }, () => prng.normal());
		const ys = Float64Array.from({ length: 500 }, () => prng.normal());
		const p = mle2Problem({ xs, ys, x: x(1, 0), y: y as never, fixNoise: true, seed: 1 });
		const post = posterior(p, { x: x(1, 0), y: y as never });
		const lp = (sx: number, rho: number) =>
			post.logPrior(p.encode({ x: x(sx, rho), y: y as never }));
		// On (log σx, log σy, atanh ρ) the density is (1 − ρ²)^{−½}.
		expect(lp(1, 0.8) - lp(1, 0)).toBeCloseTo(-0.5 * Math.log(1 - 0.64), 1);
		expect(lp(0.5, 0) - lp(2, 0)).toBeCloseTo(0, 1);
	});
});

describe('convergence diagnostics', () => {
	const prng = new Prng(11);
	const iid = () => Array.from({ length: 1000 }, () => prng.normal());

	it('independent draws: R̂ near 1 and ESS near the draw count', () => {
		const chains = [iid(), iid(), iid(), iid()];
		expect(splitRhat(chains)).toBeLessThan(1.01);
		const ess = effectiveSize(chains);
		expect(ess).toBeGreaterThan(3000);
		expect(ess).toBeLessThan(5000);
	});

	it('AR(1) with φ = 0.9: ESS near N(1 − φ)/(1 + φ)', () => {
		const ar = () => {
			const out = [prng.normal() / Math.sqrt(1 - 0.81)];
			for (let i = 1; i < 4000; i++) out.push(0.9 * out[i - 1] + prng.normal());
			return out;
		};
		const ess = effectiveSize([ar(), ar(), ar(), ar()]);
		const expected = (16000 * 0.1) / 1.9;
		expect(ess).toBeGreaterThan(0.7 * expected);
		expect(ess).toBeLessThan(1.3 * expected);
	});

	it('chains stuck apart: R̂ well above 1', () => {
		const chains = [iid(), iid().map((v) => v + 3)];
		expect(splitRhat(chains)).toBeGreaterThan(1.5);
	});
});

describe('posterior sampling', { timeout: 60_000 }, () => {
	it('normal signal of known noise: μ centred on the mean with the textbook spread', () => {
		const x: SimpleSpec = { family: 'normal', params: [1, 1] };
		const y: SimpleSpec = { family: 'normal', params: [0, 0.5] };
		const data = sample(x, y, 200);
		const p = mleProblem({ data, x, y, fixedY: [true, true], seed: 1 });
		const post = posterior(p, { x, y });
		const chains = [0, 1, 2, 3].map((c) => {
			const { chain } = advance(post, startChain(post, c), 500, 500, 100 + c);
			return advance(post, chain, 1500, 500, 200 + c).draws;
		});
		const [mu, sigma] = summarise(post.free, post.box, chains);
		const mean = data.reduce((a, b) => a + b, 0) / data.length;
		const se = Math.sqrt(1.25 / 200);
		expect(mu.median).toBeCloseTo(mean, 1);
		expect((mu.upper - mu.lower) / (2 * 1.96 * se)).toBeGreaterThan(0.8);
		expect((mu.upper - mu.lower) / (2 * 1.96 * se)).toBeLessThan(1.25);
		expect(sigma.lower).toBeLessThan(1);
		expect(sigma.upper).toBeGreaterThan(1);
		for (const s of [mu, sigma]) {
			expect(s.rhat).toBeLessThan(1.02);
			expect(s.ess).toBeGreaterThan(200);
			expect(s.edge).toBe(false);
		}
	});
});
