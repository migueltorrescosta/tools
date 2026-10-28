import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { chooseGrid } from './grid';
import { l1, truthOnGrid, wasserstein1 } from './metrics';
import type { Dist, GridEstimate } from './types';

const normalPdf = (x: number, mu: number, s: number) =>
	Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

function makeGridEstimate(
	grid: { x0: number; h: number; m: number },
	mass: number[]
): GridEstimate {
	return { grid: { x0: grid.x0, h: grid.h, m: grid.m }, mass: Float64Array.from(mass) };
}

describe('truthOnGrid', () => {
	it('sums to 1', () => {
		const d = makeDist({ family: 'normal', params: [0, 1] }, 'signal');
		const grid = chooseGrid(-5, 5, d, d);
		const est = truthOnGrid(d, grid);
		const sum = est.mass.reduce((s, v) => s + v, 0);
		expect(sum).toBeCloseTo(1, 10);
	});

	it('mean matches the distribution mean', () => {
		const mu = 1.5;
		const d = makeDist({ family: 'normal', params: [mu, 2] }, 'signal');
		const grid = chooseGrid(-10, 10, d, d);
		const est = truthOnGrid(d, grid);
		let mean = 0;
		for (let j = 0; j < est.grid.m; j++) mean += (est.grid.x0 + j * est.grid.h) * est.mass[j];
		expect(mean).toBeCloseTo(mu, 2);
	});
});

describe('wasserstein1', () => {
	it('is 0 between identical estimates', () => {
		const grid = { x0: -2, h: 0.1, m: 41 };
		const mass = new Array(41).fill(0);
		mass[20] = 1; // point mass at 0
		const a = makeGridEstimate(grid, mass);
		const b = makeGridEstimate(grid, mass);
		expect(wasserstein1(a, b)).toBe(0);
	});

	it('is h between two point masses one step apart', () => {
		const grid = { x0: -2, h: 0.1, m: 41 };
		const massA = new Array(41).fill(0);
		massA[20] = 1; // point mass at 0
		const massB = new Array(41).fill(0);
		massB[21] = 1; // point mass at 0.1
		const a = makeGridEstimate(grid, massA);
		const b = makeGridEstimate(grid, massB);
		expect(wasserstein1(a, b)).toBeCloseTo(0.1, 10);
	});

	it('throws when grids differ', () => {
		const a = makeGridEstimate({ x0: 0, h: 0.1, m: 10 }, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const b = makeGridEstimate({ x0: 0, h: 0.2, m: 10 }, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(() => wasserstein1(a, b)).toThrow('Grids differ');
	});
});

describe('l1', () => {
	it('is 0 between identical estimates', () => {
		const grid = { x0: -2, h: 0.1, m: 41 };
		const mass = new Array(41).fill(0);
		mass[20] = 1;
		const a = makeGridEstimate(grid, mass);
		const b = makeGridEstimate(grid, mass);
		expect(l1(a, b)).toBe(0);
	});

	it('is 2 for disjoint point masses', () => {
		const grid = { x0: -2, h: 0.1, m: 41 };
		const massA = new Array(41).fill(0);
		massA[20] = 1;
		const massB = new Array(41).fill(0);
		massB[21] = 1;
		const a = makeGridEstimate(grid, massA);
		const b = makeGridEstimate(grid, massB);
		expect(l1(a, b)).toBe(2);
	});

	it('throws when grids differ', () => {
		const a = makeGridEstimate({ x0: 0, h: 0.1, m: 10 }, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const b = makeGridEstimate({ x0: 0, h: 0.2, m: 10 }, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(() => l1(a, b)).toThrow('Grids differ');
	});
});
