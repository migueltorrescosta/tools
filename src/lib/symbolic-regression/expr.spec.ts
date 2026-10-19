import { describe, expect, it } from 'vitest';
import {
	binary,
	clone,
	complexity,
	constant,
	evaluate,
	exprEquals,
	exprKey,
	getConstants,
	indicator,
	mse,
	setConstants,
	unary,
	variable
} from './expr';

const x0 = variable(0);
const x1 = variable(1);
const cols = [Float64Array.from([1, 2, 3, 4]), Float64Array.from([-1, 0, 0.5, 2])];

describe('expression basics', () => {
	const e = binary('add', binary('mul', constant(2.5), unary('square', x0)), constant(1));

	it('counts nodes', () => {
		expect(complexity(x0)).toBe(1);
		expect(complexity(e)).toBe(6);
	});

	it('clones, compares and keys', () => {
		const c = clone(e);
		expect(c).not.toBe(e);
		expect(exprEquals(c, e)).toBe(true);
		expect(exprKey(c)).toBe(exprKey(e));
		expect(exprKey(e)).toBe('add(mul(2.5,square(x0)),1)');
		expect(exprEquals(e, binary('add', x0, constant(1)))).toBe(false);
	});

	it('gets and sets constants left to right without mutating', () => {
		expect(getConstants(e)).toEqual([2.5, 1]);
		const f = setConstants(e, [3, 4]);
		expect(getConstants(f)).toEqual([3, 4]);
		expect(getConstants(e)).toEqual([2.5, 1]);
	});
});

describe('evaluate', () => {
	it('evaluates every operator', () => {
		const cases: [ReturnType<typeof binary>, (a: number, b: number) => number][] = [
			[binary('add', x0, x1), (a, b) => a + b],
			[binary('sub', x0, x1), (a, b) => a - b],
			[binary('mul', x0, x1), (a, b) => a * b],
			[binary('div', x1, x0), (a, b) => b / a],
			[binary('pow', x0, x1), (a, b) => Math.pow(a, b)],
			[binary('add', unary('square', x0), unary('cube', x1)), (a, b) => a * a + b * b * b],
			[binary('add', unary('sqrt', x0), unary('log', x0)), (a) => Math.sqrt(a) + Math.log(a)],
			[binary('add', unary('exp', x1), unary('abs', x1)), (_, b) => Math.exp(b) + Math.abs(b)],
			[binary('sub', unary('sin', x0), unary('cos', x1)), (a, b) => Math.sin(a) - Math.cos(b)],
			[binary('mul', constant(2), binary('sub', constant(3), x0)), (a) => 2 * (3 - a)]
		];
		for (const [e, f] of cases) {
			const out = evaluate(e, cols);
			expect(out).not.toBeNull();
			expect(Array.from(out!)).toEqual(Array.from(cols[0], (a, i) => f(a, cols[1][i])));
		}
	});

	it('handles constant-only trees and row subsets', () => {
		expect(Array.from(evaluate(binary('add', constant(1), constant(2)), cols)!)).toEqual([
			3, 3, 3, 3
		]);
		const rows = Uint32Array.from([3, 0]);
		expect(Array.from(evaluate(binary('mul', x0, x1), cols, rows)!)).toEqual([8, -1]);
		const out = new Float64Array(2);
		expect(evaluate(x0, cols, rows, out)).toBe(out);
		expect(Array.from(out)).toEqual([4, 1]);
	});

	it('returns null when any row is infeasible', () => {
		expect(evaluate(binary('div', x0, x1), cols)).toBeNull(); // 2/0
		expect(evaluate(unary('sqrt', x1), cols)).toBeNull(); // sqrt(-1)
		expect(evaluate(unary('log', x1), cols)).toBeNull(); // log(0)
		expect(evaluate(unary('exp', binary('mul', constant(1000), x0)), cols)).toBeNull(); // overflow
		// An intermediate infinity is infeasible even if the result would be finite.
		expect(evaluate(binary('div', constant(1), binary('div', x0, x1)), cols)).toBeNull();
		expect(evaluate(binary('div', constant(1), constant(0)), cols)).toBeNull();
		expect(evaluate(unary('sqrt', constant(-1)), cols)).toBeNull();
		expect(mse(unary('sqrt', x1), { x: cols, y: cols[0] })).toBe(Infinity);
	});

	it('computes the MSE', () => {
		expect(mse(x0, { x: cols, y: Float64Array.from([1, 2, 3, 6]) })).toBe(1);
	});
});

describe('indicator', () => {
	// Level codes 0..3 on four rows
	const codes = [Float64Array.from([0, 1, 2, 3])];
	const ind = indicator(0, 0b1010);

	it('is a leaf of complexity 1 keyed by its set', () => {
		expect(complexity(ind)).toBe(1);
		expect(exprKey(ind)).not.toBe(exprKey(indicator(0, 0b0110)));
		expect(exprEquals(ind, clone(ind))).toBe(true);
		expect(getConstants(binary('mul', constant(3), ind))).toEqual([3]);
	});

	it('evaluates to 1 on rows whose level is in the set', () => {
		expect(Array.from(evaluate(binary('mul', constant(3), ind), codes)!)).toEqual([0, 3, 0, 3]);
		expect(Array.from(evaluate(ind, codes, [3, 0, 1])!)).toEqual([1, 0, 1]);
	});

	it('handles level 31 of a 32-bit mask', () => {
		const top = indicator(0, 2 ** 31);
		expect(top).toMatchObject({ mask: 2 ** 31 });
		expect(Array.from(evaluate(top, [Float64Array.from([31, 30])])!)).toEqual([1, 0]);
	});
});
