import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { quantileSorted } from '$lib/stats';
import { bands, histogram, resample, simulate } from './sample';

describe('simulate', () => {
	it('draws Z = X + Y with the summed mean and variance', () => {
		const X = makeDist({ family: 'normal', params: [2, 1] }, 'signal');
		const Y = makeDist({ family: 'laplace', params: [0, 0.5] }, 'noise');
		const z = simulate(X, Y, 100_000, 3);
		const mean = z.reduce((s, v) => s + v, 0) / z.length;
		const variance = z.reduce((s, v) => s + (v - mean) ** 2, 0) / z.length;
		expect(Math.abs(mean - 2)).toBeLessThan(4 * Math.sqrt(1.5 / z.length));
		expect(Math.abs(variance - 1.5)).toBeLessThan(0.03);
	});

	it('is reproducible from the seed', () => {
		const X = makeDist({ family: 'poisson', params: [3] }, 'signal');
		const Y = makeDist({ family: 'normal', params: [0, 1] }, 'noise');
		expect(simulate(X, Y, 50, 9)).toEqual(simulate(X, Y, 50, 9));
		expect(simulate(X, Y, 50, 9)).not.toEqual(simulate(X, Y, 50, 10));
	});
});

describe('resample', () => {
	it('draws only values of the data, with replacement', () => {
		const data = Float64Array.from([1, 2, 3, 4]);
		const r = resample(data, new Prng(1));
		expect(r.length).toBe(4);
		for (const v of r) expect(data).toContain(v);
		const many = Array.from({ length: 50 }, (_, s) => new Set(resample(data, new Prng(s))).size);
		expect(Math.min(...many)).toBeLessThan(4);
	});
});

describe('quantileSorted and bands', () => {
	it('interpolates quantiles', () => {
		expect(quantileSorted([0, 10], 0.25)).toBe(2.5);
		expect(quantileSorted([1, 2, 3], 1)).toBe(3);
		expect(quantileSorted([], 0.5)).toBeNaN();
	});

	it('takes pointwise quantiles across replicates', () => {
		const reps = Array.from({ length: 101 }, (_, b) => Float64Array.from([b, 100 - b]));
		const { lower, upper } = bands(reps);
		expect(Array.from(lower)).toEqual([5, 5]);
		expect(Array.from(upper)).toEqual([95, 95]);
	});
});

describe('histogram', () => {
	it('gives densities that integrate to the share inside the range', () => {
		const data = [0, 0.5, 1, 1.5, 2, 5];
		const { edges, density } = histogram(data, 0, 2, 4);
		expect(Array.from(edges)).toEqual([0, 0.5, 1, 1.5, 2]);
		const mass = density.reduce((s, d) => s + d * 0.5, 0);
		expect(mass).toBeCloseTo(5 / 6, 12);
	});
});
