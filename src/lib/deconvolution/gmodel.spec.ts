import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { discretise, gridPoints } from './grid';
import { binData } from './binning';
import { supportGrid, likelihoodMatrix } from './npmle';
import { splineBasis, fitGmodel, gmodelObjective } from './gmodel';
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

/** Count local maxima of density (mass/h) on the grid. */
function countLocalMaxima(mass: Float64Array, h: number): number {
	const n = mass.length;
	if (n < 3) return 0;
	const dens = new Float64Array(n);
	for (let i = 0; i < n; i++) dens[i] = mass[i] / h;
	let count = 0;
	for (let i = 1; i < n - 1; i++) {
		if (dens[i] > dens[i - 1] && dens[i] > dens[i + 1]) count++;
	}
	return count;
}

/** Truth mass on the grid: discretise X and renormalise. */
function truthMass(X: Dist, grid: Grid): Float64Array {
	const m = discretise(X, grid);
	let sum = 0;
	for (const v of m) sum += v;
	for (let j = 0; j < m.length; j++) m[j] /= sum;
	return m;
}

describe('splineBasis', () => {
	it('columns have mean 0 and norm 1', () => {
		const points = new Float64Array(100);
		for (let i = 0; i < 100; i++) points[i] = -5 + 0.1 * i;
		const df = 5;
		const Q = splineBasis(points, df);
		expect(Q.length).toBe(df);
		for (const col of Q) {
			let mean = 0;
			let norm = 0;
			for (const v of col) {
				mean += v;
				norm += v * v;
			}
			mean /= col.length;
			norm = Math.sqrt(norm);
			expect(Math.abs(mean)).toBeLessThan(1e-10);
			expect(Math.abs(norm - 1)).toBeLessThan(1e-10);
		}
	});

	it('columns are linearly independent (Gram det > 1e-8)', () => {
		const points = new Float64Array(50);
		for (let i = 0; i < 50; i++) points[i] = -3 + 0.12 * i;
		const df = 5;
		const Q = splineBasis(points, df);
		const m = df;
		const gram = new Float64Array(m * m);
		for (let i = 0; i < m; i++) {
			for (let j = 0; j < m; j++) {
				let sum = 0;
				for (let k = 0; k < points.length; k++) sum += Q[i][k] * Q[j][k];
				gram[i * m + j] = sum;
			}
		}
		// Determinant via Cholesky (Gram is symmetric positive definite)
		let det = 1;
		const L = new Float64Array(m * m);
		for (let i = 0; i < m; i++) {
			for (let j = 0; j <= i; j++) {
				let sum = gram[i * m + j];
				for (let k = 0; k < j; k++) sum -= L[i * m + k] * L[j * m + k];
				if (i === j) {
					if (sum <= 0) {
						det = 0;
						break;
					}
					L[i * m + j] = Math.sqrt(sum);
				} else {
					L[i * m + j] = sum / L[j * m + j];
				}
			}
			det *= L[i * m + i] * L[i * m + i];
		}
		expect(det).toBeGreaterThan(1e-8);
	});

	it('a centred linear function lies in the span (residual < 1e-8)', () => {
		const points = new Float64Array(50);
		for (let i = 0; i < 50; i++) points[i] = -3 + 0.12 * i;
		const df = 5;
		const Q = splineBasis(points, df);
		const m = df;
		const n = points.length;
		// Target: a centred linear function (the basis is centred, so constants are not in it)
		const mean = points.reduce((s, v) => s + v, 0) / n;
		const y = new Float64Array(n);
		for (let i = 0; i < n; i++) y[i] = 3 * (points[i] - mean);
		// Least squares: min ||Q' β - y||^2 where Q' is n×m with Q'[i,j] = Q[j][i]
		// Normal equations: (Q Q^T) β = Q y
		const QTQ = new Float64Array(m * m);
		const QTy = new Float64Array(m);
		for (let i = 0; i < m; i++) {
			for (let j = 0; j < m; j++) {
				let sum = 0;
				for (let k = 0; k < n; k++) sum += Q[i][k] * Q[j][k];
				QTQ[i * m + j] = sum;
			}
			let sum = 0;
			for (let k = 0; k < n; k++) sum += Q[i][k] * y[k];
			QTy[i] = sum;
		}
		// Solve via Cholesky
		const L = new Float64Array(m * m);
		for (let i = 0; i < m; i++) {
			for (let j = 0; j <= i; j++) {
				let sum = QTQ[i * m + j];
				for (let k = 0; k < j; k++) sum -= L[i * m + k] * L[j * m + k];
				if (i === j) L[i * m + j] = Math.sqrt(Math.max(sum, 0));
				else L[i * m + j] = sum / L[j * m + j];
			}
		}
		// Forward/back substitution
		const beta = new Float64Array(m);
		for (let i = 0; i < m; i++) {
			let sum = QTy[i];
			for (let k = 0; k < i; k++) sum -= L[i * m + k] * beta[k];
			beta[i] = sum / L[i * m + i];
		}
		for (let i = m - 1; i >= 0; i--) {
			let sum = beta[i];
			for (let k = i + 1; k < m; k++) sum -= L[k * m + i] * beta[k];
			beta[i] = sum / L[i * m + i];
		}
		// Residual
		let rss = 0;
		for (let k = 0; k < n; k++) {
			let pred = 0;
			for (let j = 0; j < m; j++) pred += beta[j] * Q[j][k];
			const res = y[k] - pred;
			rss += res * res;
		}
		expect(rss / n).toBeLessThan(1e-8);
	});
});

describe('fitGmodel', () => {
	it('normal X (0,1) + normal Y (σ=0.5), W1 < 0.15', () => {
		const prng = new Prng(789);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const n = 2000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 300);
		const res = fitGmodel({ data, y: Y, grid, df: 5, c0: 1 });
		const truth = truthMass(X, grid);
		const dist = w1(res.mass, truth, grid.h);
		expect(dist).toBeLessThan(0.15);
		expect(res.converged).toBe(true);
	});

	it('density has no more than 2 local maxima', () => {
		const prng = new Prng(789);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const n = 2000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 300);
		const res = fitGmodel({ data, y: Y, grid, df: 5, c0: 1 });
		const maxima = countLocalMaxima(res.mass, grid.h);
		expect(maxima).toBeLessThanOrEqual(2);
	});

	it('larger c0 gives smaller ‖α‖', () => {
		const prng = new Prng(999);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const n = 2000;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 300);
		const res1 = fitGmodel({ data, y: Y, grid, df: 5, c0: 1 });
		const res50 = fitGmodel({ data, y: Y, grid, df: 5, c0: 50 });
		const norm1 = Math.sqrt(res1.alpha.reduce((a, b) => a + b * b, 0));
		const norm50 = Math.sqrt(res50.alpha.reduce((a, b) => a + b * b, 0));
		expect(norm50).toBeLessThan(norm1);
	});

	it('gradient matches finite differences at random α', () => {
		const prng = new Prng(111);
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const n = 500;
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			data[i] = X.sampler(prng) + Y.sampler(prng);
		}
		const grid = supportGrid(data, 200);
		const { z, c } = binData(data);
		const L = likelihoodMatrix(z, Y, grid);
		const pts = gridPoints(grid);
		const Q = splineBasis(pts, 5);
		const c0 = 1;
		const df = 5;

		// Random alpha
		const alpha = new Array(df);
		for (let k = 0; k < df; k++) alpha[k] = (prng.next() - 0.5) * 2;

		const obj = gmodelObjective(L, c, Q, c0);
		const grad = obj.gradient(alpha);
		const eps = 1e-6;
		for (let k = 0; k < df; k++) {
			const alphaPlus = [...alpha];
			alphaPlus[k] += eps;
			const alphaMinus = [...alpha];
			alphaMinus[k] -= eps;
			const fPlus = obj.value(alphaPlus).f;
			const fMinus = obj.value(alphaMinus).f;
			const fd = (fPlus - fMinus) / (2 * eps);
			const relErr = Math.abs(grad[k] - fd) / (Math.abs(fd) + 1e-12);
			expect(relErr).toBeLessThan(1e-5);
		}
	});
});
