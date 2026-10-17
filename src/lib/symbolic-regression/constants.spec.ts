import { describe, expect, it } from 'vitest';
import { fitConstants } from './constants';
import { binary, constant, getConstants, unary, variable } from './expr';
import { Prng } from './prng';

describe('fitConstants', () => {
	const prng = new Prng(5);
	const n = 200;
	const x = Float64Array.from({ length: n }, () => prng.next() * 4 - 2);

	it('recovers a·x² + b', () => {
		const y = x.map((v) => 3.7 * v * v - 1.25);
		const e = binary('add', binary('mul', constant(1), unary('square', variable(0))), constant(0));
		const fit = fitConstants(e, { x: [x], y });
		const [a, b] = getConstants(fit.expr);
		expect(a).toBeCloseTo(3.7, 8);
		expect(b).toBeCloseTo(-1.25, 8);
		expect(fit.mse).toBeLessThan(1e-16);
		expect(fit.improved).toBe(true);
	});

	it('fits a nonlinear constant: exp(k·x)', () => {
		const y = x.map((v) => Math.exp(0.8 * v));
		const e = unary('exp', binary('mul', constant(0.3), variable(0)));
		const fit = fitConstants(e, { x: [x], y });
		expect(getConstants(fit.expr)[0]).toBeCloseTo(0.8, 6);
	});

	it('leaves constant-free and infeasible expressions alone', () => {
		const y = x.map((v) => v);
		const e = variable(0);
		expect(fitConstants(e, { x: [x], y }).expr).toBe(e);
		const bad = unary('log', binary('mul', constant(1), variable(0)));
		const fit = fitConstants(bad, { x: [x], y });
		expect(fit.mse).toBe(Infinity);
		expect(fit.improved).toBe(false);
	});
});
