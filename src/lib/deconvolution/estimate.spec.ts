import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { gridLogLik, runTask, unavailable, type GridMethod } from './estimate';
import { supportGrid } from './npmle';
import { simulate } from './sample';
import type { SimpleSpec } from './types';

const normal: SimpleSpec = { family: 'normal', params: [0, 0.4] };
const data = simulate(
	makeDist({ family: 'normal', params: [1, 1] }, 'signal'),
	makeDist(normal, 'noise'),
	800,
	3
);
const grid = supportGrid(data, 120);
const options = { df: 5, c0: 1, bandwidth: null, seed: 1 };

describe('unavailable', () => {
	it('the parametric fit always runs', () => {
		expect(unavailable('mle', { family: 'poisson', params: [2] })).toBeNull();
	});

	it('the Gaussian mixture needs normal noise', () => {
		expect(unavailable('gmm', normal)).toBeNull();
		expect(unavailable('gmm', { family: 'laplace', params: [0, 1] })).toMatch(/normal noise/);
	});

	it('grid methods need a continuous noise', () => {
		for (const m of ['npmle', 'gmodel', 'kernel'] as const)
			expect(unavailable(m, { family: 'poisson', params: [2] })).toMatch(/continuous/);
	});

	it('kernel deconvolution needs a characteristic function without zeros', () => {
		expect(unavailable('kernel', { family: 'uniform', params: [0, 2] })).toMatch(/zeros/);
		expect(unavailable('kernel', { family: 'laplace', params: [0, 1] })).toBeNull();
		expect(unavailable('kernel', normal)).toBeNull();
	});
});

describe('runTask', () => {
	it.each(['npmle', 'gmodel', 'kernel', 'gmm'] as GridMethod[])(
		'%s returns masses on the given grid',
		(method) => {
			const r = runTask({ kind: 'grid', method, data, y: normal, grid, options });
			if (r.kind !== 'grid') throw new Error('wrong kind');
			expect(r.result.grid).toEqual(grid);
			expect(r.result.mass.length).toBe(grid.m);
			expect(r.result.mass.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
			expect(Math.min(...r.result.mass)).toBeGreaterThanOrEqual(0);
			// Every method beats a flat signal on the grid.
			const flat = { grid, mass: new Float64Array(grid.m).fill(1 / grid.m) };
			expect(r.result.logLik).toBeGreaterThan(gridLogLik(data, normal, flat));
		}
	);

	it('the NPMLE log-likelihood matches gridLogLik of its own estimate', () => {
		const r = runTask({ kind: 'grid', method: 'npmle', data, y: normal, grid, options });
		if (r.kind !== 'grid') throw new Error('wrong kind');
		expect(gridLogLik(data, normal, r.result)).toBeCloseTo(r.result.logLik, 6);
	});

	it('the Gaussian mixture reports its signal and parameter count', () => {
		const r = runTask({ kind: 'grid', method: 'gmm', data, y: normal, grid, options });
		if (r.kind !== 'grid') throw new Error('wrong kind');
		expect(r.result.x).toBeDefined();
		expect((r.result.k! + 1) % 3).toBe(0);
	});

	it('bootstrap returns one reproducible mass vector per resample', () => {
		const task = {
			kind: 'bootstrap' as const,
			method: 'kernel' as const,
			data,
			y: normal,
			grid,
			options,
			seed: 7,
			count: 3
		};
		const a = runTask(task);
		const b = runTask(task);
		if (a.kind !== 'bootstrap' || b.kind !== 'bootstrap') throw new Error('wrong kind');
		expect(a.masses.length).toBe(3);
		expect(a.masses).toEqual(b.masses);
		expect(a.masses[0]).not.toEqual(a.masses[1]);
	});
});
