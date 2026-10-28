import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist2, type Noise2Spec, type Spec2 } from './dist2';
import { binData2 } from './binning2';
import { fitGmm2, gmm2Spec } from './gmm2';
import { fitNpmle2, gridNeighbours, likelihoodMatrix2, supportGrid2 } from './npmle2';

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

const twoPeaks: Spec2 = {
	family: 'mixture2',
	components: [
		{ params: [-2, 0, 0.6, 0.8, 0.3], weight: 0.4 },
		{ params: [2, 1, 0.7, 0.5, -0.4], weight: 0.6 }
	]
};
const noise: Noise2Spec = { family: 'gauss2', params: [0, 0, 0.5, 0.5, 0.2] };

describe('fitNpmle2', { timeout: 60_000 }, () => {
	it('meets the KW condition, checked independently, and puts the mass near the peaks', () => {
		const { xs, ys } = sample2(twoPeaks, noise, 3000, 1);
		const Y = makeDist2(noise, 'noise');
		const r = fitNpmle2({ xs, ys, y: Y });
		expect(r.converged).toBe(true);
		expect(r.grid.mx * r.grid.my).toBe(64 * 64);
		const b = binData2(xs, ys);
		const L = likelihoodMatrix2(b.x, b.y, Y, r.grid);
		const m = r.mass.length;
		const N = b.c.reduce((s, v) => s + v, 0);
		const D = new Float64Array(m);
		for (let i = 0; i < b.c.length; i++) {
			let f = 0;
			for (let j = 0; j < m; j++) f += L[i * m + j] * r.mass[j];
			for (let j = 0; j < m; j++) D[j] += (b.c[i] * L[i * m + j]) / (N * f);
		}
		expect(Math.max(...D) - 1).toBeLessThanOrEqual(1e-3 + 1e-12);
		// The share of mass with x > 0 is about the second peak's weight.
		let right = 0;
		for (let j = 0; j < m; j++) if (r.grid.x0 + (j % r.grid.mx) * r.grid.hx > 0) right += r.mass[j];
		expect(Math.abs(right - 0.6)).toBeLessThan(0.05);
	});

	it('gridNeighbours lists the 8 neighbours inside the grid', () => {
		const n = gridNeighbours({ x0: 0, hx: 1, mx: 4, y0: 0, hy: 1, my: 3 });
		expect(n(5).sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 6, 8, 9, 10]);
		expect(n(0).sort((a, b) => a - b)).toEqual([1, 4, 5]);
	});

	it('supportGrid2 covers the data box with 64 points per axis', () => {
		const g = supportGrid2([0, 1, 2], [5, 6, 9]);
		expect(g.mx).toBe(64);
		expect(g.x0 + 63 * g.hx).toBeCloseTo(2.04, 9);
		expect(g.y0).toBeCloseTo(4.92, 9);
	});
});

describe('fitGmm2', { timeout: 60_000 }, () => {
	it('recovers two correlated peaks under known correlated noise', () => {
		const { xs, ys } = sample2(twoPeaks, noise, 4000, 2);
		const S = makeDist2(noise, 'noise').cov!;
		const { best } = fitGmm2({ xs, ys, noise: S, seed: 2 });
		expect(best.k).toBe(2);
		const [a, b] = best.components;
		expect(a.mean[0]).toBeCloseTo(-2, 0);
		expect(b.mean[0]).toBeCloseTo(2, 0);
		expect(Math.abs(a.weight - 0.4)).toBeLessThan(0.04);
		// Correlations of the signal, not of signal + noise.
		expect(Math.abs(a.cov[1] / Math.sqrt(a.cov[0] * a.cov[2]) - 0.3)).toBeLessThan(0.15);
		expect(Math.abs(b.cov[1] / Math.sqrt(b.cov[0] * b.cov[2]) + 0.4)).toBeLessThan(0.15);
		expect(Math.abs(Math.sqrt(b.cov[0]) - 0.7)).toBeLessThan(0.1);
	});

	it('picks one component for a single Gaussian and round-trips to a spec', () => {
		const { xs, ys } = sample2({ family: 'gauss2', params: [1, 1, 1, 0.5, 0.6] }, noise, 2000, 3);
		const { best } = fitGmm2({ xs, ys, noise: makeDist2(noise, 'noise').cov!, seed: 3, kMax: 3 });
		expect(best.k).toBe(1);
		const spec = gmm2Spec(best);
		expect(spec.family).toBe('gauss2');
		const X = makeDist2(spec, 'signal');
		expect(X.mean![0]).toBeCloseTo(1, 1);
		expect(spec.family === 'gauss2' && spec.params[4]).toBeCloseTo(0.6, 1);
	});
});
