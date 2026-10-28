import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { makeDist2, marginal, validate2, type Spec2 } from './dist2';
import { zDensityOnGrid } from './grid';
import { chooseGrid2, interpolate2, logLikelihood2, modelBox2, zDensityOnGrid2 } from './grid2';
import { simulate } from './sample';

/** Density of a correlated Gaussian with covariance [a, b; b, c]. */
function gauss(x: number, y: number, mx: number, my: number, a: number, b: number, c: number) {
	const det = a * c - b * b;
	const u = x - mx;
	const v = y - my;
	return (
		Math.exp(-(c * u * u - 2 * b * u * v + a * v * v) / (2 * det)) / (2 * Math.PI * Math.sqrt(det))
	);
}

describe('zDensityOnGrid2', () => {
	it('correlated Gaussian + correlated Gaussian has the summed covariance', () => {
		const X = makeDist2({ family: 'gauss2', params: [1, -1, 1.2, 0.8, 0.5] }, 'signal');
		const Y = makeDist2({ family: 'gauss2', params: [9, 9, 0.6, 0.9, -0.3] }, 'noise');
		const g = chooseGrid2(modelBox2(X, Y, 1e-7), X, Y, { baseNodes: 128 });
		const f = zDensityOnGrid2(X, Y, g);
		const a = 1.44 + 0.36;
		const b = 0.5 * 1.2 * 0.8 - 0.3 * 0.6 * 0.9;
		const c = 0.64 + 0.81;
		let err = 0;
		for (let j = 0; j < g.my; j++)
			for (let i = 0; i < g.mx; i++)
				err = Math.max(
					err,
					Math.abs(f[j * g.mx + i] - gauss(g.x0 + i * g.hx, g.y0 + j * g.hy, 1, -1, a, b, c))
				);
		expect(err).toBeLessThan(1e-6);
	});

	it('product + product is the outer product of the 1D convolutions', () => {
		const xs: Spec2 = {
			family: 'product',
			x: { family: 'gamma', params: [3, 1] },
			y: { family: 'poisson', params: [2] }
		};
		const ys: Spec2 = {
			family: 'product',
			x: { family: 'laplace', params: [0, 0.5] },
			y: { family: 'normal', params: [0, 0.4] }
		};
		const X = makeDist2(xs, 'signal');
		const Y = makeDist2(ys, 'noise');
		const g = chooseGrid2(modelBox2(X, Y, 1e-6), X, Y);
		const f = zDensityOnGrid2(X, Y, g);
		const fx = zDensityOnGrid(makeDist(xs.x, 'signal'), makeDist(ys.x, 'noise'), {
			x0: g.x0,
			h: g.hx,
			m: g.mx
		});
		const fy = zDensityOnGrid(makeDist(xs.y, 'signal'), makeDist(ys.y, 'noise'), {
			x0: g.y0,
			h: g.hy,
			m: g.my
		});
		let err = 0;
		let top = 0;
		for (let j = 0; j < g.my; j++)
			for (let i = 0; i < g.mx; i++) {
				err = Math.max(err, Math.abs(f[j * g.mx + i] - fx[i] * fy[j]));
				top = Math.max(top, f[j * g.mx + i]);
			}
		expect(err).toBeLessThan(1e-9 * top);
	});
});

describe('2D distributions', () => {
	it('cell masses sum to 1 and marginals match the 1D marginals', () => {
		const spec: Spec2 = {
			family: 'mixture2',
			components: [
				{ params: [-2, 0, 0.6, 1, 0.3], weight: 1 },
				{ params: [2, 1, 0.8, 0.5, -0.4], weight: 2 }
			]
		};
		const X = makeDist2(spec, 'signal');
		const g = chooseGrid2(X.box(1e-8), X, X, { baseNodes: 128 });
		const mass = X.masses(g);
		expect(mass.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
		// The x marginal's mean equals the mixture's mean.
		const mx = marginal({ grid: g, mass }, 0);
		const mean = mx.mass.reduce((s, v, i) => s + v * (mx.grid.x0 + i * mx.grid.h), 0);
		expect(mean).toBeCloseTo(X.mean![0], 6);
		expect(X.mean![0]).toBeCloseTo((-2 + 4) / 3, 12);
	});

	it('the fringe pattern integrates to 1 and its sampler follows the density', () => {
		const X = makeDist2(
			{ family: 'fringe2', params: [0, 0, 2, 1.5, 0.2, 3, 1, 0.8, 0.4] },
			'signal'
		);
		const g = chooseGrid2(X.box(1e-9), X, X, { baseNodes: 200, maxNodes: 400 });
		const mass = X.masses(g);
		expect(mass.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
		// Share of draws with x > 0 matches the mass with x > 0.
		const draw = X.sampler;
		const prng = new Prng(1);
		let right = 0;
		const n = 100000;
		for (let k = 0; k < n; k++) if (draw(prng)[0] > 0) right++;
		let massRight = 0;
		for (let j = 0; j < g.my; j++)
			for (let i = 0; i < g.mx; i++) if (g.x0 + i * g.hx > 0) massRight += mass[j * g.mx + i];
		expect(Math.abs(right / n - massRight)).toBeLessThan(0.01);
	});

	it('the noise holds the Gaussian means at 0', () => {
		const Y = makeDist2({ family: 'gauss2', params: [5, 5, 1, 1, 0] }, 'noise');
		expect(Y.mean).toEqual([0, 0]);
	});

	it('validate2 reports parameters by part and index', () => {
		expect(validate2({ family: 'gauss2', params: [0, 0, -1, 1, 1] }).map((e) => e.index)).toEqual([
			2, 4
		]);
		const p = validate2({
			family: 'product',
			x: { family: 'normal', params: [0, 1] },
			y: { family: 'laplace', params: [0, 0] }
		});
		expect(p).toEqual([{ part: 'y', index: 1, message: 'b must be positive.' }]);
	});
});

describe('interpolate2 and logLikelihood2', () => {
	it('interpolation is exact for a bilinear function and 0 outside', () => {
		const g = { x0: 0, hx: 0.5, mx: 5, y0: -1, hy: 1, my: 4 };
		const v = Float64Array.from({ length: 20 }, (_, k) => {
			const x = g.x0 + (k % 5) * g.hx;
			const y = g.y0 + Math.floor(k / 5) * g.hy;
			return 2 + 3 * x - y + 0.5 * x * y;
		});
		expect(interpolate2(v, g, 1.3, 0.4)).toBeCloseTo(2 + 3.9 - 0.4 + 0.5 * 1.3 * 0.4, 12);
		expect(interpolate2(v, g, 5, 0)).toBe(0);
	});

	it('matches the closed form for Gaussian + Gaussian', () => {
		const X = makeDist2({ family: 'gauss2', params: [0, 0, 1, 1, 0.4] }, 'signal');
		const Y = makeDist2({ family: 'gauss2', params: [0, 0, 0.5, 0.5, 0] }, 'noise');
		const xs = simulate(
			makeDist({ family: 'normal', params: [0, 1.1] }, 'signal'),
			makeDist({ family: 'normal', params: [0, 0.1] }, 'noise'),
			500,
			1
		);
		const ys = simulate(
			makeDist({ family: 'normal', params: [0, 1.1] }, 'signal'),
			makeDist({ family: 'normal', params: [0, 0.1] }, 'noise'),
			500,
			2
		);
		const exact = Array.from(xs).reduce(
			(s, x, i) => s + Math.log(gauss(x, ys[i], 0, 0, 1.25, 0.4, 1.25)),
			0
		);
		const got = logLikelihood2(X, Y, xs, ys);
		expect(Math.abs(got - exact) / Math.abs(exact)).toBeLessThan(1e-4);
	});
});
