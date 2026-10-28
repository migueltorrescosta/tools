import { describe, expect, it } from 'vitest';
import type { Grid2, GridEstimate2 } from './dist2';
import { l1_2, slicedW1 } from './metrics2';

function makeGridEstimate2(grid: Grid2, mass: number[]): GridEstimate2 {
	return { grid: { ...grid }, mass: Float64Array.from(mass) };
}

const grid: Grid2 = { x0: -2, hx: 0.1, mx: 41, y0: -2, hy: 0.1, my: 41 };

describe('l1_2', () => {
	it('is 0 between identical estimates', () => {
		const mass = new Array(41 * 41).fill(0);
		mass[20 * 41 + 20] = 1; // point mass at (0, 0)
		const a = makeGridEstimate2(grid, mass);
		const b = makeGridEstimate2(grid, mass);
		expect(l1_2(a, b)).toBe(0);
	});

	it('is 2 for disjoint point masses', () => {
		const massA = new Array(41 * 41).fill(0);
		massA[20 * 41 + 20] = 1; // point mass at (0, 0)
		const massB = new Array(41 * 41).fill(0);
		massB[21 * 41 + 20] = 1; // point mass at (0.1, 0)
		const a = makeGridEstimate2(grid, massA);
		const b = makeGridEstimate2(grid, massB);
		expect(l1_2(a, b)).toBe(2);
	});

	it('throws when grids differ in x0', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0.1, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(100).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});

	it('throws when grids differ in hx', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.2, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(100).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});

	it('throws when grids differ in mx', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.1, mx: 11, y0: 0, hy: 0.1, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(110).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});

	it('throws when grids differ in y0', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0.1, hy: 0.1, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(100).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});

	it('throws when grids differ in hy', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.2, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(100).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});

	it('throws when grids differ in my', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 11 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(110).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => l1_2(a, b)).toThrow('Grids differ');
	});
});

describe('slicedW1', () => {
	it('is 0 between identical estimates', () => {
		const mass = new Array(41 * 41).fill(0);
		mass[20 * 41 + 20] = 1; // point mass at (0, 0)
		const a = makeGridEstimate2(grid, mass);
		const b = makeGridEstimate2(grid, mass);
		expect(slicedW1(a, b)).toBe(0);
	});

	it('a point mass moved by (dx, 0) gives sliced W1 = |dx| * (2/π) within 1e-3 for directions = 2000', () => {
		const dx = 0.5;
		const massA = new Array(41 * 41).fill(0);
		massA[20 * 41 + 20] = 1; // point mass at (0, 0)
		const massB = new Array(41 * 41).fill(0);
		// Move by dx = 0.5, which is 5 cells in x direction (hx = 0.1)
		const ix = 20 + Math.round(dx / 0.1);
		massB[20 * 41 + ix] = 1; // point mass at (dx, 0)
		const a = makeGridEstimate2(grid, massA);
		const b = makeGridEstimate2(grid, massB);
		const expected = Math.abs(dx) * (2 / Math.PI);
		const actual = slicedW1(a, b, 2000);
		expect(actual).toBeCloseTo(expected, 3);
	});

	it('a point mass moved by (dx, dy) gives sliced W1 = sqrt(dx^2+dy^2) * 2/π', () => {
		const dx = 0.3;
		const dy = 0.4;
		const dist = Math.sqrt(dx * dx + dy * dy); // 0.5
		const massA = new Array(41 * 41).fill(0);
		massA[20 * 41 + 20] = 1; // point mass at (0, 0)
		const massB = new Array(41 * 41).fill(0);
		const ix = 20 + Math.round(dx / 0.1);
		const iy = 20 + Math.round(dy / 0.1);
		massB[iy * 41 + ix] = 1; // point mass at (dx, dy)
		const a = makeGridEstimate2(grid, massA);
		const b = makeGridEstimate2(grid, massB);
		const expected = dist * (2 / Math.PI);
		const actual = slicedW1(a, b, 2000);
		expect(actual).toBeCloseTo(expected, 3);
	});

	it('throws when grids differ', () => {
		const gridA: Grid2 = { x0: 0, hx: 0.1, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const gridB: Grid2 = { x0: 0, hx: 0.2, mx: 10, y0: 0, hy: 0.1, my: 10 };
		const a = makeGridEstimate2(gridA, new Array(100).fill(0));
		const b = makeGridEstimate2(gridB, new Array(100).fill(0));
		a.mass[0] = 1;
		b.mass[0] = 1;
		expect(() => slicedW1(a, b)).toThrow('Grids differ');
	});

	it('works with distributed mass', () => {
		const massA = new Array(41 * 41).fill(0);
		const massB = new Array(41 * 41).fill(0);
		// Two point masses
		massA[20 * 41 + 20] = 0.5;
		massA[20 * 41 + 21] = 0.5;
		massB[21 * 41 + 20] = 0.5;
		massB[21 * 41 + 21] = 0.5;
		const a = makeGridEstimate2(grid, massA);
		const b = makeGridEstimate2(grid, massB);
		const result = slicedW1(a, b, 100);
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThan(1);
	});

	it('handles zero mass grids', () => {
		const massA = new Array(41 * 41).fill(0);
		const massB = new Array(41 * 41).fill(0);
		const a = makeGridEstimate2(grid, massA);
		const b = makeGridEstimate2(grid, massB);
		expect(slicedW1(a, b)).toBe(0);
	});
});
