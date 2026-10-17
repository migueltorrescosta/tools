import { describe, expect, it } from 'vitest';
import { binary, complexity, constant, evaluate, exprKey, unary, variable } from './expr';
import { Prng } from './prng';
import { simplify } from './simplify';
import { ALL_OPERATORS, BINARY_OPS, UNARY_OPS, type Expr } from './types';

const x = variable(0);
const y = variable(1);
const c = constant;
const key = (e: Expr) => exprKey(simplify(e));

describe('simplify rules', () => {
	it('folds constants and removes identities', () => {
		expect(key(binary('add', c(2), c(3)))).toBe('5');
		expect(key(binary('add', x, c(0)))).toBe('x0');
		expect(key(binary('mul', c(1), x))).toBe('x0');
		expect(key(binary('mul', x, c(0)))).toBe('0');
		expect(key(binary('sub', x, x))).toBe('0');
		expect(key(binary('div', x, x))).toBe('1');
		expect(key(binary('pow', x, c(1)))).toBe('x0');
		expect(key(unary('square', unary('sqrt', x)))).toBe('x0');
		expect(key(unary('sqrt', c(4)))).toBe('2');
	});

	it('combines constants in chains', () => {
		expect(key(binary('mul', c(2), binary('mul', c(3), x)))).toBe('mul(6,x0)');
		expect(key(binary('mul', binary('mul', x, c(2)), c(3)))).toBe('mul(6,x0)');
		expect(key(binary('add', binary('add', x, c(1)), c(2)))).toBe('add(x0,3)');
		expect(key(binary('sub', binary('add', c(5), x), c(2)))).toBe('add(x0,3)');
		expect(key(binary('sub', x, c(2)))).toBe('add(x0,-2)');
		expect(key(binary('sub', c(1), binary('sub', c(3), x)))).toBe('add(x0,-2)');
		expect(key(binary('mul', c(-1), binary('mul', c(-1), x)))).toBe('x0');
		expect(key(binary('div', binary('mul', c(5), x), c(2)))).toBe('mul(2.5,x0)');
		expect(key(binary('mul', binary('mul', c(2), x), binary('mul', c(3), y)))).toBe(
			'mul(6,mul(x0,x1))'
		);
		expect(key(binary('add', binary('add', c(1), x), binary('add', c(2), y)))).toBe(
			'add(add(x0,x1),3)'
		);
		// Does not introduce operators: an unfoldable division stays.
		expect(key(binary('div', c(1), c(0)))).toBe('div(1,0)');
	});

	it('preserves values on random trees wherever the original is feasible', () => {
		const prng = new Prng(11);
		const leaf = (): Expr =>
			prng.next() < 0.6 ? variable(prng.int(2)) : c(Math.round(prng.normal() * 4) / 2);
		const tree = (size: number): Expr => {
			if (size <= 1) return leaf();
			if (size === 2 || prng.next() < 0.2)
				return unary(UNARY_OPS[prng.int(UNARY_OPS.length)], tree(size - 1));
			const l = 1 + prng.int(size - 2);
			return binary(BINARY_OPS[prng.int(BINARY_OPS.length)], tree(l), tree(size - 1 - l));
		};
		const n = 64;
		const cols = [0, 1].map(() => Float64Array.from({ length: n }, () => prng.next() * 6 - 3));
		let checked = 0;
		for (let t = 0; t < 3000; t++) {
			const e = tree(1 + prng.int(12));
			const before = evaluate(e, cols);
			const s = simplify(e);
			expect(complexity(s)).toBeLessThanOrEqual(complexity(e));
			if (!before) continue;
			const after = evaluate(s, cols);
			expect(after, `${exprKey(e)} → ${exprKey(s)}`).not.toBeNull();
			for (let i = 0; i < n; i++) {
				const tol = 1e-9 * Math.max(1, Math.abs(before[i]));
				if (Math.abs(after![i] - before[i]) > tol) {
					expect.fail(`${exprKey(e)} → ${exprKey(s)}: ${before[i]} vs ${after![i]}`);
				}
			}
			checked++;
		}
		expect(checked).toBeGreaterThan(500);
		expect(ALL_OPERATORS.length).toBe(13);
	});
});
