import { describe, it, expect } from 'vitest';
import { maximize, type Constraint } from './lp';

describe('split LP solver', () => {
	it('solves a textbook maximisation', () => {
		// max 3x + 5y st x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18 → (2, 6), value 36.
		const r = maximize(
			[3, 5],
			[
				{ coeffs: [1, 0], op: '<=', rhs: 4 },
				{ coeffs: [0, 2], op: '<=', rhs: 12 },
				{ coeffs: [3, 2], op: '<=', rhs: 18 }
			]
		);
		expect(r.status).toBe('optimal');
		if (r.status !== 'optimal') return;
		expect(r.value).toBeCloseTo(36, 9);
		expect(r.x[0]).toBeCloseTo(2, 9);
		expect(r.x[1]).toBeCloseTo(6, 9);
	});

	it('handles ≥ and = rows through phase 1', () => {
		// max −x − y (min x + y) st x + 2y ≥ 4, x − y = 1 → x = 2, y = 1.
		const r = maximize(
			[-1, -1],
			[
				{ coeffs: [1, 2], op: '>=', rhs: 4 },
				{ coeffs: [1, -1], op: '=', rhs: 1 }
			]
		);
		expect(r.status).toBe('optimal');
		if (r.status !== 'optimal') return;
		expect(r.x[0]).toBeCloseTo(2, 9);
		expect(r.x[1]).toBeCloseTo(1, 9);
		expect(r.value).toBeCloseTo(-3, 9);
	});

	it('accepts negative right-hand sides', () => {
		// max x st −x ≥ −5 (x ≤ 5).
		const r = maximize([1], [{ coeffs: [-1], op: '>=', rhs: -5 }]);
		expect(r).toEqual({ status: 'optimal', x: [5], value: 5 });
	});

	it('reports infeasible problems', () => {
		const r = maximize(
			[1, 1],
			[
				{ coeffs: [1, 1], op: '<=', rhs: 1 },
				{ coeffs: [1, 1], op: '>=', rhs: 3 }
			]
		);
		expect(r.status).toBe('infeasible');
	});

	it('reports unbounded problems', () => {
		const r = maximize([1, 0], [{ coeffs: [1, -1], op: '<=', rhs: 1 }]);
		expect(r.status).toBe('unbounded');
	});

	it('terminates on a degenerate problem that cycles without Bland’s rule', () => {
		// Beale's example: cycles under the largest-coefficient rule. Optimum 1/20.
		const r = maximize(
			[0.75, -150, 0.02, -6],
			[
				{ coeffs: [0.25, -60, -0.04, 9], op: '<=', rhs: 0 },
				{ coeffs: [0.5, -90, -0.02, 3], op: '<=', rhs: 0 },
				{ coeffs: [0, 0, 1, 0], op: '<=', rhs: 1 }
			]
		);
		expect(r.status).toBe('optimal');
		if (r.status !== 'optimal') return;
		expect(r.value).toBeCloseTo(0.05, 9);
	});

	it('keeps a redundant equality and still finds the optimum', () => {
		const r = maximize(
			[1, 2],
			[
				{ coeffs: [1, 1], op: '=', rhs: 2 },
				{ coeffs: [2, 2], op: '=', rhs: 4 }
			]
		);
		expect(r.status).toBe('optimal');
		if (r.status !== 'optimal') return;
		expect(r.value).toBeCloseTo(4, 9);
		expect(r.x[1]).toBeCloseTo(2, 9);
	});
});

describe('split LP solver: regression', () => {
	it('solves the 10 × 500 transfer LP that tiny pivots used to corrupt', async () => {
		// Stage 1 of transfersFor for the first proposal of the 10-person,
		// 500-item benchmark with half the items placed at Start. With pivots
		// down to 1e-9 the tableau degraded until it reported "unbounded".
		const { c1, rows } = (await import('./fixtures/transfer-lp-10x500.json')).default as {
			c1: number[];
			rows: Constraint[];
		};
		const r = maximize(c1, rows);
		expect(r.status).toBe('optimal');
		if (r.status !== 'optimal') return;
		expect(r.value).toBeLessThanOrEqual(10);
		for (const row of rows) {
			const lhs = row.coeffs.reduce((s, a, j) => s + a * r.x[j], 0);
			if (row.op === '<=') expect(lhs).toBeLessThanOrEqual(row.rhs + 1e-7);
			else if (row.op === '>=') expect(lhs).toBeGreaterThanOrEqual(row.rhs - 1e-7);
			else expect(Math.abs(lhs - row.rhs)).toBeLessThan(1e-7);
		}
	});
});
