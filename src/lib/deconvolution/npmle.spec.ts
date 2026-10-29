import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { discretise, dataWindow, gridPoints } from './grid';
import { binData } from './binning';
import {
	supportGrid,
	likelihoodMatrix,
	fitNpmle,
	dirichletGibbs,
	type NpmleInput
} from './npmle';
import { truthOnGrid, wasserstein1 } from './metrics';
import { simulate } from './sample';
import type { Grid, Dist } from './types';

/** Wasserstein-1 distance between two mass vectors on the same grid. */
function w1(massA: Float64Array, massB: Float64Array, h: number): number {
	let diff = 0;
	let cumA = 0;
	let cumB = 0;
	for (let j = 0; j < massA.length; j++) {
		cumA += massA[j];
		cumB += massB[j];
		diff += Math.abs(cumA - cumB);
	}
	return diff * h;
}

describe('binData', () => {
	it('returns <= 2000 points for n=20000 and weights sum to n', () => {
		const prng = new Prng(1);
		const data = new Float64Array(20000);
		for (let i = 0; i < 20000; i++) data[i] = prng.normal();
		const { z, c } = binData(data);
		expect(z.length).toBeLessThanOrEqual(2000);
		const sum = c.reduce((a, b) => a + b, 0);
		expect(sum).toBe(20000);
	});
});

describe('supportGrid', () => {
	it('creates a grid over the data window', () => {
		const data = new Float64Array([-1, 0, 1, 2, 3]);
		const grid = supportGrid(data, 5);
		expect(grid.m).toBe(5);
		expect(grid.x0).toBeCloseTo(-1.08, 2);
		expect(grid.h).toBeCloseTo(1.04, 2);
		const pts = gridPoints(grid);
		expect(pts[0]).toBeCloseTo(grid.x0, 10);
		expect(pts[4]).toBeCloseTo(grid.x0 + 4 * grid.h, 10);
	});
});

describe('likelihoodMatrix', () => {
	it('throws for Poisson noise (discrete)', () => {
		const y = makeDist({ family: 'poisson', params: [3] }, 'noise');
		const grid = { x0: 0, h: 1, m: 10 };
		const z = new Float64Array([1, 2, 3]);
		expect(() => likelihoodMatrix(z, y, grid)).toThrow('The noise must be continuous');
	});

	it('computes correct values for normal noise', () => {
		const y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const grid = { x0: 0, h: 1, m: 3 };
		const z = new Float64Array([1, 2]);
		const L = likelihoodMatrix(z, y, grid);
		expect(L.length).toBe(6);
		// L[i*m + j] = y.pdf(z_i - a_j)
		const a0 = 0,
			a1 = 1,
			a2 = 2;
		expect(L[0]).toBeCloseTo(y.pdf!(1 - a0), 10);
		expect(L[1]).toBeCloseTo(y.pdf!(1 - a1), 10);
		expect(L[2]).toBeCloseTo(y.pdf!(1 - a2), 10);
		expect(L[3]).toBeCloseTo(y.pdf!(2 - a0), 10);
		expect(L[4]).toBeCloseTo(y.pdf!(2 - a1), 10);
		expect(L[5]).toBeCloseTo(y.pdf!(2 - a2), 10);
	});
});

describe('fitNpmle', () => {
	/** Truth mass on the grid: discretise X and renormalise. */
	function truthMass(X: Dist, grid: Grid): Float64Array {
		const m = discretise(X, grid);
		let sum = 0;
		for (const v of m) sum += v;
		for (let j = 0; j < m.length; j++) m[j] /= sum;
		return m;
	}

	it('Poisson X (λ=3) + normal Y (σ=0.3), W1 < 0.15', () => {
		const prng = new Prng(42);
		const X = makeDist({ family: 'poisson', params: [3] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.3] }, 'noise');
		const n = 2000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			const x = X.sampler(prng);
			const y = Y.sampler(prng);
			data[i] = x + y;
		}
		const grid = { x0: -1, h: 0.05, m: 221 }; // -1 to 10, step 0.05
		const input: NpmleInput = { data, y: Y, grid, maxIter: 5000, tol: 1e-3 };
		const res = fitNpmle(input);
		const truth = truthMass(X, grid);
		const dist = w1(res.mass, truth, grid.h);
		expect(dist).toBeLessThan(0.15);
		expect(res.converged).toBe(true);
		expect(res.gap).toBeLessThanOrEqual(1e-3 + 1e-12);

		// KW condition holds when recomputed independently
		const { z, c } = binData(data);
		const L = likelihoodMatrix(z, Y, grid);
		const nBins = z.length;
		const N = c.reduce((a, b) => a + b, 0);
		const f = new Float64Array(nBins);
		for (let i = 0; i < nBins; i++) {
			let sum = 0;
			const base = i * grid.m;
			for (let j = 0; j < grid.m; j++) sum += L[base + j] * res.mass[j];
			f[i] = sum;
		}
		let maxD = 0;
		for (let j = 0; j < grid.m; j++) {
			let sum = 0;
			for (let i = 0; i < nBins; i++) {
				const base = i * grid.m;
				sum += (c[i] * L[base + j]) / f[i];
			}
			const D = sum / N;
			if (D > maxD) maxD = D;
		}
		expect(maxD - 1).toBeLessThanOrEqual(1e-3 + 1e-12);

		// logLik >= log-likelihood of truth on grid
		let truthLogLik = 0;
		for (let i = 0; i < nBins; i++) {
			let sum = 0;
			const base = i * grid.m;
			for (let j = 0; j < grid.m; j++) sum += L[base + j] * truth[j];
			truthLogLik += c[i] * Math.log(Math.max(sum, 1e-300));
		}
		expect(res.logLik).toBeGreaterThanOrEqual(truthLogLik - 1e-6 * n);
	});

	it('normal X (0,1) + Laplace Y (b=0.5), converged, W1 < 0.2', () => {
		const prng = new Prng(123);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 0.5] }, 'noise');
		const n = 3000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 300);
		const res = fitNpmle({ data, y: Y, grid, maxIter: 5000, tol: 1e-3 });
		const truth = truthMass(X, grid);
		const dist = w1(res.mass, truth, grid.h);
		expect(dist).toBeLessThan(0.2);
		expect(res.converged).toBe(true);
	});

	it('accelerate: false takes more iterations to reach same tol', () => {
		const prng = new Prng(456);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 0.5] }, 'noise');
		const n = 3000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 300);
		const resAcc = fitNpmle({ data, y: Y, grid, maxIter: 5000, tol: 1e-3, accelerate: true });
		const resNoAcc = fitNpmle({ data, y: Y, grid, maxIter: 5000, tol: 1e-3, accelerate: false });
		expect(resNoAcc.iterations).toBeGreaterThan(resAcc.iterations);
		expect(resAcc.converged).toBe(true);
		expect(resNoAcc.converged).toBe(true);
	}, 30_000);

	it('bins a large sample and still meets the KW condition', () => {
		const prng = new Prng(5);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 0.4] }, 'noise');
		const data = Float64Array.from({ length: 20000 }, () => X.sampler(prng) + Y.sampler(prng));
		const res = fitNpmle({ data, y: Y });
		expect(res.converged).toBe(true);
		const { z, c } = binData(data);
		expect(z.length).toBeLessThanOrEqual(2000);
		const L = likelihoodMatrix(z, Y, res.grid);
		const m = res.grid.m;
		let maxD = 0;
		const D = new Float64Array(m);
		for (let i = 0; i < z.length; i++) {
			let f = 0;
			for (let j = 0; j < m; j++) f += L[i * m + j] * res.mass[j];
			for (let j = 0; j < m; j++) D[j] += (c[i] * L[i * m + j]) / (f * 20000);
		}
		for (const d of D) maxD = Math.max(maxD, d);
		expect(maxD - 1).toBeLessThanOrEqual(1e-3 + 1e-12);
	});
});

describe('dirichletGibbs', () => {
	it('with each point tied to one support point, draws Dirichlet(a + counts) exactly', () => {
		// 5 support points, counts 0, 3, 1, 6, 0: L picks each point's own support point.
		const own = [1, 1, 1, 2, 3, 3, 3, 3, 3, 3];
		const m = 5;
		const L = new Float64Array(own.length * m);
		own.forEach((j, i) => (L[i * m + j] = 1));
		const c = new Float64Array(own.length).fill(1);
		const draws = dirichletGibbs(L, c, m, new Float64Array(m).fill(0.2), 4000, new Prng(5));
		const a = 1 / m;
		const counts = [0, 3, 1, 6, 0];
		for (let j = 0; j < m; j++) {
			const mean = draws.reduce((s, w) => s + w[j], 0) / draws.length;
			expect(mean).toBeCloseTo((a + counts[j]) / (m * a + own.length), 2);
		}
	});

	it('the posterior mean recovers a signal blurred by normal noise', () => {
		const X = makeDist({ family: 'gamma', params: [4, 0.5] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.3] }, 'noise');
		const data = simulate(X, Y, 500, 9);
		const grid = supportGrid(data, 100);
		const { z, c } = binData(data);
		const L = likelihoodMatrix(z, Y, grid);
		const draws = dirichletGibbs(L, c, grid.m, new Float64Array(grid.m).fill(1 / grid.m), 400, new Prng(2));
		const kept = draws.slice(100);
		const mass = new Float64Array(grid.m);
		for (const w of kept) for (let j = 0; j < grid.m; j++) mass[j] += w[j] / kept.length;
		// As close to the truth as the NPMLE itself (W₁ is in units of x; X has sd 1).
		const truth = truthOnGrid(X, grid);
		const npmle = wasserstein1(fitNpmle({ data, y: Y, grid }), truth);
		const post = wasserstein1({ grid, mass }, truth);
		expect(post).toBeLessThan(1.2 * npmle);
	});
});
