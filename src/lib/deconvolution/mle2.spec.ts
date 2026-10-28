import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist2, type Noise2Spec, type Spec2 } from './dist2';
import { fitMle2, type Mle2Result } from './mle2';

/** n draws of Z = X + Y in 2D. */
function sample2(x: Spec2, y: Noise2Spec, n: number, seed: number) {
	const X = makeDist2(x, 'signal');
	const Y = makeDist2(y, 'noise');
	const px = new Prng(seed);
	const py = new Prng(seed + 7777);
	const xs = new Float64Array(n);
	const ys = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const [a, b] = X.sampler(px);
		const [c, d] = Y.sampler(py);
		xs[i] = a + c;
		ys[i] = b + d;
	}
	return { xs, ys };
}

const param = (r: Mle2Result, role: 'signal' | 'noise', key: string) =>
	r.params.find((p) => p.role === role && p.key === key)!;
const covers = (r: Mle2Result, role: 'signal' | 'noise', key: string, truth: number) => {
	const p = param(r, role, key);
	return p.lower <= truth && truth <= p.upper;
};

describe('fitMle2', { timeout: 120_000 }, () => {
	it('recovers a correlated Gaussian signal under known Laplace × Laplace noise', () => {
		const x: Spec2 = { family: 'gauss2', params: [1, -1, 1.2, 0.8, 0.5] };
		const y: Noise2Spec = {
			family: 'product',
			x: { family: 'laplace', params: [0, 0.6] },
			y: { family: 'laplace', params: [0, 0.5] }
		};
		const { xs, ys } = sample2(x, y, 2000, 1);
		const r = fitMle2({
			xs,
			ys,
			x: { family: 'gauss2', params: [0, 0, 1, 1, 0] },
			y,
			fixNoise: true,
			seed: 1,
			starts: 1
		});
		for (const [key, truth] of [
			['mux', 1],
			['muy', -1],
			['sx', 1.2],
			['sy', 0.8],
			['rho', 0.5]
		] as const)
			expect(covers(r, 'signal', key, truth), key).toBe(true);
		expect(r.identifiability.flat).toBe(false);
		// The noise's locations are held at 0 and not reported.
		expect(r.params.some((p) => p.role === 'noise' && p.key.endsWith('.mu'))).toBe(false);
	});

	it('fits a gamma × gamma signal and a free Laplace × Laplace noise together', () => {
		const x: Spec2 = {
			family: 'product',
			x: { family: 'gamma', params: [3, 1] },
			y: { family: 'gamma', params: [2, 1.5] }
		};
		const y: Noise2Spec = {
			family: 'product',
			x: { family: 'laplace', params: [0, 0.5] },
			y: { family: 'laplace', params: [0, 0.7] }
		};
		const { xs, ys } = sample2(x, y, 2000, 4);
		const r = fitMle2({ xs, ys, x, y, seed: 4, starts: 1 });
		for (const [role, key, truth] of [
			['signal', 'x.shape', 3],
			['signal', 'y.scale', 1.5],
			['noise', 'x.b', 0.5],
			['noise', 'y.b', 0.7]
		] as const)
			expect(covers(r, role, key, truth), key).toBe(true);
	});

	it('flags Gaussian + Gaussian: only the summed covariance is determined', () => {
		const x: Spec2 = { family: 'gauss2', params: [0, 0, 1, 1, 0.3] };
		const y: Noise2Spec = { family: 'gauss2', params: [0, 0, 0.5, 0.5, 0] };
		const { xs, ys } = sample2(x, y, 1500, 2);
		const r = fitMle2({ xs, ys, x, y, seed: 2, starts: 1 });
		expect(r.identifiability.flat).toBe(true);
		const keys = r.identifiability.direction.map((d) => `${d.role}.${d.key}`);
		expect(keys.some((k) => k.startsWith('signal.s') || k === 'signal.rho')).toBe(true);
		expect(keys.some((k) => k.startsWith('noise.'))).toBe(true);
		// With the noise held fixed the signal is identifiable and recovered.
		const fixed = fitMle2({
			xs,
			ys,
			x: { family: 'gauss2', params: [0, 0, 2, 2, 0] },
			y,
			fixNoise: true,
			seed: 2,
			starts: 1
		});
		expect(fixed.identifiability.flat).toBe(false);
		expect(covers(fixed, 'signal', 'sx', 1)).toBe(true);
		expect(covers(fixed, 'signal', 'rho', 0.3)).toBe(true);
		expect(fixed.k).toBe(5);
	});

	it('fits a product signal axis by axis', () => {
		const x: Spec2 = {
			family: 'product',
			x: { family: 'gamma', params: [3, 1] },
			y: { family: 'normal', params: [2, 0.7] }
		};
		const y: Noise2Spec = { family: 'gauss2', params: [0, 0, 0.4, 0.4, 0] };
		const { xs, ys } = sample2(x, y, 2000, 11);
		const r = fitMle2({ xs, ys, x, y, fixNoise: true, seed: 11, starts: 1 });
		expect(covers(r, 'signal', 'x.shape', 3)).toBe(true);
		expect(covers(r, 'signal', 'y.mu', 2)).toBe(true);
		expect(covers(r, 'signal', 'y.sigma', 0.7)).toBe(true);
		expect(r.aic).toBeCloseTo(2 * r.k - 2 * r.logLik, 9);
	});
});
