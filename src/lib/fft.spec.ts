import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { convolve, fft, nextPow2 } from './fft';

describe('fft', () => {
	it('matches the direct DFT', () => {
		const n = 16;
		const prng = new Prng(1);
		const re = Float64Array.from({ length: n }, () => prng.normal());
		const im = Float64Array.from({ length: n }, () => prng.normal());
		const r = re.slice();
		const i = im.slice();
		fft(r, i);
		for (let k = 0; k < n; k++) {
			let sr = 0;
			let si = 0;
			for (let j = 0; j < n; j++) {
				const a = (-2 * Math.PI * j * k) / n;
				sr += re[j] * Math.cos(a) - im[j] * Math.sin(a);
				si += re[j] * Math.sin(a) + im[j] * Math.cos(a);
			}
			expect(r[k]).toBeCloseTo(sr, 10);
			expect(i[k]).toBeCloseTo(si, 10);
		}
	});

	it('round-trips through the inverse', () => {
		const re = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
		const im = new Float64Array(8);
		fft(re, im);
		fft(re, im, true);
		re.forEach((v, k) => expect(v / 8).toBeCloseTo(k + 1, 12));
	});

	it('rejects lengths that are not powers of two', () => {
		expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
	});

	it('nextPow2', () => {
		expect([1, 2, 3, 5, 1024, 1025].map(nextPow2)).toEqual([1, 2, 4, 8, 1024, 2048]);
	});
});

describe('convolve', () => {
	it('matches direct convolution', () => {
		const a = [1, -2, 3, 0.5];
		const b = [2, 1, -1];
		const direct = new Array(a.length + b.length - 1).fill(0);
		a.forEach((x, i) => b.forEach((y, k) => (direct[i + k] += x * y)));
		const got = convolve(a, b);
		expect(got.length).toBe(direct.length);
		direct.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 12));
	});
});

describe('circular convolve', () => {
	it('matches the linear result where there is no wrap-around', () => {
		const a = Array.from({ length: 8 }, (_, i) => Math.cos(i));
		const b = Array.from({ length: 15 }, (_, i) => Math.sin(i));
		const lin = convolve(a, b);
		const circ = convolve(a, b, 16);
		expect(circ.length).toBe(16);
		for (let i = a.length + b.length - 1 - 16; i < 16; i++) expect(circ[i]).toBeCloseTo(lin[i], 12);
	});
});
