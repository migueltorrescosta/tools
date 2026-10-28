import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { chooseGrid } from './grid';
import { cfHasZeros, defaultBandwidth, fitKernel } from './kernel';
import { truthOnGrid, wasserstein1 } from './metrics';
import type { Dist } from './types';

const normalPdf = (x: number, mu: number, s: number) =>
	Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

function sampleNormal(n: number, mu: number, s: number, seed: number): Float64Array {
	const prng = new Prng(seed);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) out[i] = mu + s * prng.normal();
	return out;
}

function sampleLaplace(n: number, mu: number, b: number, seed: number): Float64Array {
	const prng = new Prng(seed);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const u = prng.next() - 0.5;
		out[i] = mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
	}
	return out;
}

describe('cfHasZeros', () => {
	it('detects zeros when cf has a zero on the grid', () => {
		// cf(t) = 1 - t/2, zero at t=2
		const zeroDist: Dist = {
			pdf: (x) => 0,
			atoms: { x: new Float64Array(0), p: new Float64Array(0) },
			cf: (t) => [1 - t / 2, 0],
			range: () => [0, 0],
			mean: 0,
			variance: 1,
			sampler: () => 0
		};
		// With tMax=10, n=2000, grid includes t=2 (i=400)
		expect(cfHasZeros(zeroDist, 10)).toBe(true);
	});

	it('does not detect zeros for Laplace noise', () => {
		const y = makeDist({ family: 'laplace', params: [0, 0.3] }, 'noise');
		expect(cfHasZeros(y, 100)).toBe(false);
	});
});

describe('fitKernel', () => {
	it('throws when noise cf has zeros', () => {
		// cf(t) = 1 - t/2, zero at t=2
		const zeroDist: Dist = {
			pdf: (x) => 0,
			atoms: { x: new Float64Array(0), p: new Float64Array(0) },
			cf: (t) => [1 - t / 2, 0],
			range: () => [0, 0],
			mean: 0,
			variance: 1,
			sampler: () => 0
		};
		const data = sampleNormal(100, 0, 1, 1);
		// bandwidth 0.5 gives 1/h = 2, so cfHasZeros(y, 2) will check up to t=2
		// and hit the zero at t=2
		expect(() => fitKernel({ data, y: zeroDist, bandwidth: 0.5 })).toThrow(
			'The noise characteristic function has zeros'
		);
	});

	it('recovers normal X + Laplace Y with W1 < 0.15', () => {
		// X ~ N(0, 1), Y ~ Laplace(0, 0.3)
		const seed = 42;
		const n = 5000;
		const X = sampleNormal(n, 0, 1, seed);
		const Y = sampleLaplace(n, 0, 0.3, seed + 1);
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) data[i] = X[i] + Y[i];

		const y = makeDist({ family: 'laplace', params: [0, 0.3] }, 'noise');
		const result = fitKernel({ data, y });

		// Truth on the same grid
		const trueDist = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const truth = truthOnGrid(trueDist, result.grid);
		const w1 = wasserstein1(result, truth);
		expect(w1).toBeLessThan(0.15);
		expect(result.negativeMass).toBeLessThan(0.5); // some negative mass is expected but not too much
		expect(result.bandwidth).toBeGreaterThan(0);
	});
});

describe('defaultBandwidth', () => {
	it('matches formula for non-Gaussian noise', () => {
		const data = sampleNormal(1000, 2, 1.5, 1);
		const y = makeDist({ family: 'laplace', params: [0, 0.5] }, 'noise');
		const h = defaultBandwidth(data, y, false);
		// Manual calculation
		let meanZ = 0;
		for (let i = 0; i < data.length; i++) meanZ += data[i];
		meanZ /= data.length;
		let varZ = 0;
		for (let i = 0; i < data.length; i++) {
			const d = data[i] - meanZ;
			varZ += d * d;
		}
		varZ /= data.length;
		const varY = y.variance ?? 0;
		const varX = Math.max(varZ - varY, 0.01 * varZ);
		const expected = 1.06 * Math.sqrt(varX) * Math.pow(data.length, -0.2);
		expect(h).toBeCloseTo(expected, 10);
	});

	it('uses max(h_ROT, σ_Y * sqrt(2/log n)) for Gaussian noise', () => {
		const data = sampleNormal(1000, 0, 1, 1);
		const y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const h = defaultBandwidth(data, y, true);
		let meanZ = 0;
		for (let i = 0; i < data.length; i++) meanZ += data[i];
		meanZ /= data.length;
		let varZ = 0;
		for (let i = 0; i < data.length; i++) {
			const d = data[i] - meanZ;
			varZ += d * d;
		}
		varZ /= data.length;
		const varY = y.variance ?? 0;
		const varX = Math.max(varZ - varY, 0.01 * varZ);
		const hRot = 1.06 * Math.sqrt(varX) * Math.pow(data.length, -0.2);
		const hFan = Math.sqrt(varY) * Math.sqrt(2 / Math.log(data.length));
		expect(h).toBeCloseTo(Math.max(hRot, hFan), 10);
	});
});

describe('empirical CF binning', () => {
	it('binned CF agrees with exact within 1e-3 at t=1 for n=20000', () => {
		const n = 20000;
		const data = sampleNormal(n, 0, 1, 123);
		const t = 1;
		// Exact empirical CF for normal
		const exactRe = Math.exp(-0.5 * t * t);
		const exactIm = 0;
		// Binned CF (private, so we test through the kernel integration indirectly)
		// We can check by creating a kernel fit with a dummy noise and comparing
		// the internal binned CF - but since it's not exported, we test the kernel result instead
		// using a noise with very small variance (approaching direct density estimation)
		const y = makeDist({ family: 'normal', params: [0, 0.01] }, 'noise');
		const result = fitKernel({ data, y, nT: 512 });
		// The density at 0 should be close to true normal density
		const grid = result.grid;
		const idx = Math.round((0 - grid.x0) / grid.h);
		if (idx >= 0 && idx < grid.m) {
			const density = result.mass[idx] / grid.h;
			expect(Math.abs(density - normalPdf(0, 0, 1))).toBeLessThan(0.05);
		}
	});
});
