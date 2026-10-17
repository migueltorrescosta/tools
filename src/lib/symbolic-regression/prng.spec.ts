import { describe, expect, it } from 'vitest';
import { Prng } from './prng';

describe('Prng', () => {
	it('is deterministic for a seed and differs across seeds', () => {
		const draw = (seed: number) => {
			const p = new Prng(seed);
			return [p.next(), p.int(10), p.normal(), p.normal(), p.next()];
		};
		expect(draw(42)).toEqual(draw(42));
		expect(draw(42)).not.toEqual(draw(43));
	});

	it('stays in range', () => {
		const p = new Prng(1);
		for (let i = 0; i < 10_000; i++) {
			const u = p.next();
			expect(u >= 0 && u < 1).toBe(true);
			const k = p.int(7);
			expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
		}
	});

	it('draws standard normals', () => {
		const p = new Prng(3);
		let s = 0;
		let s2 = 0;
		const n = 20_000;
		for (let i = 0; i < n; i++) {
			const v = p.normal();
			s += v;
			s2 += v * v;
		}
		expect(Math.abs(s / n)).toBeLessThan(0.05);
		expect(Math.abs(s2 / n - 1)).toBeLessThan(0.05);
	});
});
