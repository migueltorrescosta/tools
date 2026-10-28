import { describe, expect, it } from 'vitest';
import { goldenSection, nelderMead } from './minimise';

describe('nelderMead', () => {
	it('finds the Rosenbrock minimum', () => {
		const f = (x: number[]) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
		const r = nelderMead(f, [-1.2, 1], { maxIter: 2000, xatol: 1e-8, fatol: 1e-12 });
		expect(r.x[0]).toBeCloseTo(1, 5);
		expect(r.x[1]).toBeCloseTo(1, 5);
		expect(r.evaluations).toBeGreaterThan(0);
	});
});

describe('goldenSection', () => {
	it('brackets the minimum of a unimodal function', () => {
		const r = goldenSection((x) => (x - 0.3) ** 2 + 1, 0, 1, 1e-8);
		expect(r.x).toBeCloseTo(0.3, 7);
		expect(r.f).toBeCloseTo(1, 12);
	});
});
