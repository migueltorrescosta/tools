import { describe, expect, it } from 'vitest';
import type { Node } from './ast';
import { evaluate } from './evaluate';
import { parse } from './parse';
import { tokenise } from './tokenise';

/** Fully parenthesised form, to read precedence off. */
function sexpr(n: Node): string {
	switch (n.kind) {
		case 'num':
			return String(n.value);
		case 'sym':
			return n.name;
		case 'unary':
			return `(${n.op === '-' ? '-' : 'not '}${sexpr(n.arg)})`;
		case 'binary':
			return `(${sexpr(n.left)} ${n.op} ${sexpr(n.right)})`;
		case 'ternary':
			return `(${sexpr(n.cond)} ? ${sexpr(n.then)} : ${sexpr(n.else)})`;
		case 'call':
			return `${n.fn}(${n.args.map(sexpr).join(', ')})`;
	}
}

const tree = (text: string) => {
	const r = parse(text);
	if (!r.ok) throw new Error(`${r.error.message} at ${r.error.start}`);
	return sexpr(r.ast);
};
const error = (text: string) => {
	const r = parse(text);
	if (r.ok) throw new Error(`parsed: ${sexpr(r.ast)}`);
	return r.error;
};

describe('tokenise', () => {
	it('reads numbers, identifiers and operators with spans', () => {
		const { tokens, error } = tokenise(' 1e6 + .5*x_1 >= 2.5E-3');
		expect(error).toBeUndefined();
		expect(tokens.map((t) => t.text)).toEqual(['1e6', '+', '.5', '*', 'x_1', '>=', '2.5E-3', '']);
		expect(tokens.filter((t) => t.kind === 'num').map((t) => t.kind === 'num' && t.value)).toEqual([
			1e6, 0.5, 2.5e-3
		]);
		expect(tokens[0]).toMatchObject({ start: 1, end: 4 });
	});

	it('stops at a bad character and keeps the tokens before it', () => {
		const { tokens, error } = tokenise('a + b; c');
		expect(tokens.map((t) => t.text)).toEqual(['a', '+', 'b', '']);
		expect(error).toMatchObject({ start: 5, end: 6 });
	});
});

describe('parse: precedence', () => {
	it.each([
		['1 + 2 * 3', '(1 + (2 * 3))'],
		['a - b - c', '((a - b) - c)'],
		['a / b / c', '((a / b) / c)'],
		['-x^2', '(-(x ^ 2))'],
		['2^3^2', '(2 ^ (3 ^ 2))'],
		['2^-x', '(2 ^ (-x))'],
		['-a * b', '((-a) * b)'],
		['--a', '(-(-a))'],
		['(a + b) * c', '((a + b) * c)'],
		['a + b < c * d', '((a + b) < (c * d))'],
		['a < b and c >= d or not e', '(((a < b) and (c >= d)) or (not e))'],
		['not a == b', '(not (a == b))'],
		['not a and b', '((not a) and b)'],
		['a ? b : c ? d : e', '(a ? b : (c ? d : e))'],
		['a ? b ? c : d : e', '(a ? (b ? c : d) : e)'],
		['x or y ? 1 : 2', '((x or y) ? 1 : 2)'],
		['min(a, b, c) + max(1, 2)', '(min(a, b, c) + max(1, 2))'],
		['if(x > 0, x, -x)', 'if((x > 0), x, (-x))'],
		['clamp(x, 0, 1) ^ 2', '(clamp(x, 0, 1) ^ 2)'],
		['1e6 * .5', '(1000000 * 0.5)'],
		['min(N, t*T)*P - t*C', '((min(N, (t * T)) * P) - (t * C))'],
		[
			'b*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)',
			'((b * R) + ((L >= 0) ? (L * ((1 + i) ^ 5)) : (L * ((1 + Lr) ^ 5))))'
		]
	])('%s', (text, expected) => expect(tree(text)).toBe(expected));

	it('gives every node its span', () => {
		const r = parse('a + (b*c)');
		expect(r.ok && r.ast.kind === 'binary' && [r.ast.right.start, r.ast.right.end]).toEqual([4, 9]);
		expect(r.ok && [r.ast.start, r.ast.end]).toEqual([0, 9]);
	});

	it('handles a long flat chain at the length cap', () => {
		const text = Array(1000).fill('1').join('+');
		expect(text.length).toBe(1999);
		const r = parse(text);
		expect(r.ok && evaluate(r.ast, () => 0)).toBe(1000);
	});
});

describe('parse: errors carry positions', () => {
	it.each([
		['', 'empty', 0, 0],
		['   ', 'empty', 3, 3],
		['1 +', 'Expected a number', 3, 3],
		['1 + )', 'Expected a number', 4, 5],
		['(1 + 2', 'Expected ")"', 6, 6],
		['1 + 2)', 'Unmatched ")"', 5, 6],
		['a < b < c', 'do not chain', 6, 7],
		['a b', 'Expected an operator', 2, 3],
		['2x', 'Malformed number', 0, 2],
		['1e', 'Malformed number', 0, 2],
		['a = b', 'use ==', 2, 3],
		['!a', 'use not', 0, 1],
		['foo(1)', 'Unknown function "foo"', 0, 3],
		['min(1)', 'min takes at least 2 arguments, got 1', 0, 6],
		['if(1, 2)', 'if takes 3 arguments, got 2', 0, 8],
		['sqrt()', 'sqrt takes 1 argument, got 0', 0, 6],
		['a ? b', 'Expected ":"', 5, 5],
		['and', 'Unexpected "and"', 0, 3],
		['x +* y', 'Expected a number', 3, 4]
	])('%j', (text, message, start, end) => {
		const e = error(text);
		expect(e.message).toContain(message);
		expect([e.start, e.end]).toEqual([start, end]);
	});

	it('caps formula length at 2,000 characters', () => {
		expect(parse('1'.repeat(2000)).ok).toBe(true);
		expect(error('1'.repeat(2001))).toMatchObject({ start: 2000, end: 2001 });
	});

	it('caps nesting depth at 64 without overflowing the stack', () => {
		const nest = (k: number) => '('.repeat(k) + '1' + ')'.repeat(k);
		expect(parse(nest(60)).ok).toBe(true);
		expect(error(nest(64)).message).toContain('nested more than 64');
		expect(error(nest(990)).message).toContain('nested more than 64');
		expect(error('-'.repeat(1999) + '1').message).toContain('nested more than 64');
		expect(error(Array(1000).fill('2').join('^')).message).toContain('nested more than 64');
		expect(error('a?'.repeat(900) + '1').message).toContain('nested');
	});
});

describe('parse: adversarial input', () => {
	it.each([
		['a.b', 1],
		['`x`', 0],
		['1; 2', 1],
		['"x"', 0],
		["'x'", 0],
		['x[0]', 1],
		['a => b', 2],
		['{}', 0],
		['$x', 0],
		['a\\b', 1],
		['x // y', 3],
		['constructor.name', 11],
		['this.x', 4]
	])('%j is a tokeniser or parse error at %i', (text, start) => {
		expect(error(text).start).toBe(start);
	});

	it('treats reserved-looking identifiers as plain symbols and never as calls', () => {
		for (const name of ['constructor', '__proto__', 'toString', 'valueOf', 'prototype'])
			expect(tree(name)).toBe(name);
		for (const name of [
			'constructor',
			'__proto__',
			'toString',
			'hasOwnProperty',
			'eval',
			'Function'
		])
			expect(error(`${name}(1)`).message).toBe(`Unknown function "${name}"`);
	});
});
