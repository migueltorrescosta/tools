import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { logGamma } from '$lib/variates';
import { makeDist } from './dist';
import {
	chooseGrid,
	gridPoints,
	logLikelihood,
	modelWindow,
	zAtoms,
	zDensityAt,
	zDensityOnGrid
} from './grid';
import type { Dist } from './types';

const normalPdf = (x: number, mu: number, s: number) =>
	Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
const poissonPmf = (k: number, l: number) => Math.exp(k * Math.log(l) - l - logGamma(k + 1));

/** f_Z on the model grid, with the largest absolute error against `exact`. */
function maxError(X: Dist, Y: Dist, exact: (z: number) => number): number {
	const [lo, hi] = modelWindow(X, Y, 1e-6);
	const grid = chooseGrid(lo, hi, X, Y);
	const f = zDensityOnGrid(X, Y, grid);
	const xs = gridPoints(grid);
	let err = 0;
	xs.forEach((z, j) => (err = Math.max(err, Math.abs(f[j] - exact(z)))));
	return err;
}

/** ∫ f_X(t) f_Y(z − t) dt by composite Simpson on a fine grid. */
function quad(X: Dist, Y: Dist, z: number, lo: number, hi: number, n = 200000): number {
	const h = (hi - lo) / n;
	let s = 0;
	for (let i = 0; i <= n; i++) {
		const t = lo + i * h;
		const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
		s += w * X.pdf!(t) * Y.pdf!(z - t);
	}
	return (s * h) / 3;
}

describe('zDensityOnGrid', () => {
	it('normal + normal is normal with the summed variance', () => {
		const X = makeDist({ family: 'normal', params: [2, 1.5] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [5, 0.7] }, 'noise');
		const s = Math.hypot(1.5, 0.7);
		expect(maxError(X, Y, (z) => normalPdf(z, 2, s))).toBeLessThan(1e-6);
	});

	it('normal + Laplace matches quadrature (the kink costs O(h²))', () => {
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 0.5] }, 'noise');
		const points = Float64Array.from({ length: 41 }, (_, i) => -6 + 0.3 * i);
		const got = zDensityAt(X, Y, points, chooseGrid(...modelWindow(X, Y, 1e-6), X, Y));
		points.forEach((z, i) => expect(Math.abs(got[i] - quad(X, Y, z, -12, 12))).toBeLessThan(2e-6));
	});

	it('Poisson + normal is a sum of shifted normals', () => {
		const X = makeDist({ family: 'poisson', params: [4] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.6] }, 'noise');
		const exact = (z: number) => {
			let s = 0;
			for (let k = 0; k < 40; k++) s += poissonPmf(k, 4) * normalPdf(z, k, 0.6);
			return s;
		};
		expect(maxError(X, Y, exact)).toBeLessThan(1e-6);
	});

	it('the noise is centred: its location parameter is ignored', () => {
		const Y = makeDist({ family: 'normal', params: [5, 1] }, 'noise');
		expect(Y.mean).toBe(0);
	});
});

describe('zAtoms', () => {
	it('Poisson + Poisson is Poisson with the summed rate', () => {
		const X = makeDist({ family: 'poisson', params: [3] }, 'signal');
		const Y = makeDist({ family: 'poisson', params: [1.5] }, 'noise');
		const { x, p } = zAtoms(X, Y);
		let err = 0;
		x.forEach((k, i) => (err = Math.max(err, Math.abs(p[i] - poissonPmf(k, 4.5)))));
		expect(err).toBeLessThan(1e-6);
		expect(zDensityAt(X, Y, [0.5])[0]).toBe(0);
	});
});

describe('logLikelihood', () => {
	it('matches the closed form for normal + normal', () => {
		const X = makeDist({ family: 'normal', params: [1, 1] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 0.5] }, 'noise');
		const prng = new Prng(7);
		const s = Math.hypot(1, 0.5);
		const data = Float64Array.from({ length: 2000 }, () => 1 + s * prng.normal());
		const exact = data.reduce((acc, z) => acc + Math.log(normalPdf(z, 1, s)), 0);
		expect(Math.abs(logLikelihood(X, Y, data) - exact) / Math.abs(exact)).toBeLessThan(1e-6);
	});

	it('weights scale the terms', () => {
		const X = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 1] }, 'noise');
		const data = [-1, 0, 2];
		const one = logLikelihood(X, Y, data);
		expect(logLikelihood(X, Y, data, { weights: [2, 2, 2] })).toBeCloseTo(2 * one, 9);
	});
});
