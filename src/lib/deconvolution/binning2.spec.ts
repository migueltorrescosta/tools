import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { binData2 } from './binning2';

describe('binData2', () => {
	it('returns original data with unit weights when n <= maxPoints', () => {
		const x = new Float64Array([1, 2, 3, 4, 5]);
		const y = new Float64Array([2, 3, 4, 5, 6]);
		const { x: xb, y: yb, c } = binData2(x, y, 10);
		expect(xb).toEqual(x);
		expect(yb).toEqual(y);
		expect(c).toEqual(new Float64Array([1, 1, 1, 1, 1]));
	});

	it('bins data into equal-width bins over the data range', () => {
		const x = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const y = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const { x: xb, y: yb, c } = binData2(x, y, 5, 5);
		expect(xb.length).toBeLessThanOrEqual(25);
		expect(yb.length).toBe(xb.length);
		expect(c.length).toBe(xb.length);
		const sum = c.reduce((a, b) => a + b, 0);
		expect(sum).toBe(10);
	});

	it('keeps only non-empty bins', () => {
		const x = new Float64Array([0, 0, 0, 10, 10, 10]);
		const y = new Float64Array([0, 0, 0, 10, 10, 10]);
		const { x: xb, y: yb, c } = binData2(x, y, 5, 10);
		expect(xb.length).toBe(2);
		expect(yb.length).toBe(2);
		expect(c[0]).toBe(3);
		expect(c[1]).toBe(3);
	});

	it('bin centres are at the middle of each bin', () => {
		const x = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const y = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const { x: xb, y: yb, c } = binData2(x, y, 5, 5);
		const hx = (9 - 0) / 5;
		const hy = (9 - 0) / 5;
		// Data is on diagonal, so only diagonal bins are non-empty
		// Bins are iterated row-major by y (yi outer, xi inner)
		let idx = 0;
		for (let yi = 0; yi < 5; yi++) {
			for (let xi = 0; xi < 5; xi++) {
				if (xi === yi) {
					expect(xb[idx]).toBeCloseTo(0 + (xi + 0.5) * hx, 10);
					expect(yb[idx]).toBeCloseTo(0 + (yi + 0.5) * hy, 10);
					idx++;
				}
			}
		}
		expect(idx).toBe(5);
	});

	it('handles constant x (degenerate x axis)', () => {
		const x = new Float64Array([5, 5, 5, 5, 5]);
		const y = new Float64Array([1, 2, 3, 4, 5]);
		const { x: xb, y: yb, c } = binData2(x, y, 3, 10);
		expect(xb.length).toBe(5);
		for (let i = 0; i < xb.length; i++) expect(xb[i]).toBe(5);
		expect(c.reduce((a, b) => a + b, 0)).toBe(5);
	});

	it('handles constant y (degenerate y axis)', () => {
		const x = new Float64Array([1, 2, 3, 4, 5]);
		const y = new Float64Array([5, 5, 5, 5, 5]);
		const { x: xb, y: yb, c } = binData2(x, y, 3, 10);
		expect(yb.length).toBe(5);
		for (let i = 0; i < yb.length; i++) expect(yb[i]).toBe(5);
		expect(c.reduce((a, b) => a + b, 0)).toBe(5);
	});

	it('handles constant x and y (both degenerate)', () => {
		const x = new Float64Array([5, 5, 5, 5, 5]);
		const y = new Float64Array([3, 3, 3, 3, 3]);
		const { x: xb, y: yb, c } = binData2(x, y, 3, 10);
		expect(xb.length).toBe(1);
		expect(yb.length).toBe(1);
		expect(xb[0]).toBe(5);
		expect(yb[0]).toBe(3);
		expect(c[0]).toBe(5);
	});

	it('weights sum to n for large n', () => {
		const prng = new Prng(1);
		const n = 20000;
		const x = new Float64Array(n);
		const y = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			x[i] = prng.normal();
			y[i] = prng.normal();
		}
		const { x: xb, y: yb, c } = binData2(x, y);
		expect(xb.length).toBeLessThanOrEqual(1600);
		const sum = c.reduce((a, b) => a + b, 0);
		expect(sum).toBe(n);
	});

	it('weighted mean equals data mean within half a cell width per axis', () => {
		const prng = new Prng(2);
		const n = 20000;
		const x = new Float64Array(n);
		const y = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			x[i] = prng.normal() * 2 + 1;
			y[i] = prng.normal() * 3 - 2;
		}
		const { x: xb, y: yb, c } = binData2(x, y);
		let wx = 0;
		let wy = 0;
		let wsum = 0;
		for (let i = 0; i < c.length; i++) {
			wx += xb[i] * c[i];
			wy += yb[i] * c[i];
			wsum += c[i];
		}
		const meanX = wx / wsum;
		const meanY = wy / wsum;
		const dataMeanX = x.reduce((a, b) => a + b, 0) / n;
		const dataMeanY = y.reduce((a, b) => a + b, 0) / n;
		// cell width is range / bins, range ~ 6*sigma for normal, so half cell ~ 3*sigma/bins
		// with bins=40, half cell ~ 0.075 for x, ~0.11 for y
		expect(Math.abs(meanX - dataMeanX)).toBeLessThan(0.2);
		expect(Math.abs(meanY - dataMeanY)).toBeLessThan(0.3);
	});

	it('respects bins parameter', () => {
		const prng = new Prng(3);
		const n = 10000;
		const x = new Float64Array(n);
		const y = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			x[i] = prng.normal() * 10;
			y[i] = prng.normal() * 10;
		}
		const { x: x1 } = binData2(x, y, 5000, 50);
		const { x: x2 } = binData2(x, y, 5000, 100);
		expect(x1.length).toBeLessThanOrEqual(2500); // 50*50
		expect(x2.length).toBeLessThanOrEqual(10000); // 100*100
	});

	it('throws when x and y have different lengths', () => {
		const x = new Float64Array([1, 2, 3]);
		const y = new Float64Array([1, 2]);
		expect(() => binData2(x, y)).toThrow('x and y must have the same length');
	});
});
