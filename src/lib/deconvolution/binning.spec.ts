import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { binData } from './binning';

describe('binData', () => {
	it('returns original data with unit weights when n <= maxPoints', () => {
		const data = new Float64Array([1, 2, 3, 4, 5]);
		const { z, c } = binData(data, 10);
		expect(z).toEqual(data);
		expect(c).toEqual(new Float64Array([1, 1, 1, 1, 1]));
	});

	it('bins data into equal-width bins over the data range', () => {
		const data = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const { z, c } = binData(data, 5, 5);
		expect(z.length).toBeLessThanOrEqual(5);
		expect(c.length).toBe(z.length);
		const sum = c.reduce((a, b) => a + b, 0);
		expect(sum).toBe(10);
	});

	it('keeps only non-empty bins', () => {
		const data = new Float64Array([0, 0, 0, 10, 10, 10]);
		const { z, c } = binData(data, 5, 10);
		expect(z.length).toBe(2);
		expect(c[0]).toBe(3);
		expect(c[1]).toBe(3);
	});

	it('bin centres are at the middle of each bin', () => {
		const data = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const { z, c } = binData(data, 5, 5);
		const h = (9 - 0) / 5;
		for (let i = 0; i < z.length; i++) {
			expect(z[i]).toBeCloseTo(0 + (i + 0.5) * h, 10);
		}
	});

	it('handles constant data', () => {
		const data = new Float64Array([5, 5, 5, 5, 5]);
		const { z, c } = binData(data, 3, 10);
		expect(z.length).toBe(1);
		expect(z[0]).toBe(5);
		expect(c[0]).toBe(5);
	});

	it('weights sum to n for large n', () => {
		const prng = new Prng(1);
		const data = new Float64Array(20000);
		for (let i = 0; i < 20000; i++) data[i] = prng.normal();
		const { z, c } = binData(data);
		expect(z.length).toBeLessThanOrEqual(2000);
		const sum = c.reduce((a, b) => a + b, 0);
		expect(sum).toBe(20000);
	});

	it('respects bins parameter', () => {
		const data = new Float64Array(10000);
		const prng = new Prng(2);
		for (let i = 0; i < 10000; i++) data[i] = prng.normal() * 10;
		const { z: z1 } = binData(data, 5000, 100);
		const { z: z2 } = binData(data, 5000, 500);
		expect(z1.length).toBeLessThanOrEqual(100);
		expect(z2.length).toBeLessThanOrEqual(500);
	});
});
