import { describe, expect, it } from 'vitest';
import { toMathML } from './mathml';
import type { BinaryOp, Expr, UnaryOp } from './types';

const c = (value: number): Expr => ({ kind: 'const', value });
const v = (index: number): Expr => ({ kind: 'var', index });
const u = (op: UnaryOp, child: Expr): Expr => ({ kind: 'unary', op, child });
const b = (op: BinaryOp, left: Expr, right: Expr): Expr => ({ kind: 'binary', op, left, right });

const ml = (e: Expr, names = ['x', 'y', 'z']) => toMathML(e, names);
const strip = (s: string) => s.replace(/^<math display="block">|<\/math>$/g, '');

describe('toMathML', () => {
	it('wraps the expression in a block math element', () => {
		expect(ml(v(0))).toBe('<math display="block"><mi>x</mi></math>');
	});

	it('renders 2.5·x²', () => {
		expect(strip(ml(b('mul', c(2.5), u('square', v(0)))))).toBe(
			'<mrow><mn>2.5</mn><mo>⋅</mo><msup><mi>x</mi><mn>2</mn></msup></mrow>'
		);
	});

	it('renders x1·x2 + 1 with subscripts', () => {
		expect(strip(ml(b('add', b('mul', v(0), v(1)), c(1)), ['x1', 'x2']))).toBe(
			'<mrow><mrow><msub><mi>x</mi><mn>1</mn></msub><mo>⋅</mo><msub><mi>x</mi><mn>2</mn></msub></mrow><mo>+</mo><mn>1</mn></mrow>'
		);
	});

	it('uses mfrac and msqrt without fences', () => {
		expect(strip(ml(b('div', b('add', v(0), v(1)), u('sqrt', v(2)))))).toBe(
			'<mfrac><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow><msqrt><mi>z</mi></msqrt></mfrac>'
		);
	});

	it('fences a sum inside a product and a difference on the right of a difference', () => {
		expect(strip(ml(b('mul', b('add', v(0), v(1)), v(2))))).toBe(
			'<mrow><mrow><mo>(</mo><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow><mo>)</mo></mrow><mo>⋅</mo><mi>z</mi></mrow>'
		);
		expect(strip(ml(b('sub', v(0), b('sub', v(1), v(2)))))).toBe(
			'<mrow><mi>x</mi><mo>−</mo><mrow><mo>(</mo><mrow><mi>y</mi><mo>−</mo><mi>z</mi></mrow><mo>)</mo></mrow></mrow>'
		);
	});

	it('does not fence a left-nested difference', () => {
		expect(strip(ml(b('sub', b('sub', v(0), v(1)), v(2))))).toBe(
			'<mrow><mrow><mi>x</mi><mo>−</mo><mi>y</mi></mrow><mo>−</mo><mi>z</mi></mrow>'
		);
	});

	it('fences a power base but not its exponent', () => {
		expect(strip(ml(b('pow', b('add', v(0), c(1)), b('mul', c(2), v(1)))))).toBe(
			'<msup><mrow><mo>(</mo><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mo>)</mo></mrow><mrow><mn>2</mn><mo>⋅</mo><mi>y</mi></mrow></msup>'
		);
		expect(strip(ml(u('square', u('exp', v(0)))))).toBe(
			'<msup><mrow><mo>(</mo><msup><mi>e</mi><mi>x</mi></msup><mo>)</mo></mrow><mn>2</mn></msup>'
		);
	});

	it('renders functions, absolute value and cube', () => {
		expect(strip(ml(u('log', v(0))))).toBe(
			'<mrow><mi>ln</mi><mo>&#x2061;</mo><mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow></mrow>'
		);
		expect(strip(ml(u('abs', v(0))))).toBe('<mrow><mo>|</mo><mi>x</mi><mo>|</mo></mrow>');
		expect(strip(ml(u('cube', u('sin', v(0)))))).toBe(
			'<msup><mrow><mi>sin</mi><mo>&#x2061;</mo><mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow></mrow><mn>3</mn></msup>'
		);
	});

	it('fences negative constants on the right of a product and as a power base', () => {
		expect(strip(ml(b('mul', v(0), c(-2))))).toBe(
			'<mrow><mi>x</mi><mo>⋅</mo><mrow><mo>(</mo><mrow><mo>−</mo><mn>2</mn></mrow><mo>)</mo></mrow></mrow>'
		);
		expect(strip(ml(b('pow', c(-2), v(0))))).toBe(
			'<msup><mrow><mo>(</mo><mrow><mo>−</mo><mn>2</mn></mrow><mo>)</mo></mrow><mi>x</mi></msup>'
		);
	});

	it('turns x + (−2) into x − 2', () => {
		expect(strip(ml(b('add', v(0), c(-2))))).toBe('<mrow><mi>x</mi><mo>−</mo><mn>2</mn></mrow>');
	});

	it('renders scientific numbers with a power of ten', () => {
		expect(strip(ml(c(6.674e-11)))).toBe(
			'<mrow><mn>6.674</mn><mo>×</mo><msup><mn>10</mn><mrow><mo>−</mo><mn>11</mn></mrow></msup></mrow>'
		);
	});

	it('escapes names for XML', () => {
		expect(strip(ml(v(0), ['a<b & "c"']))).toBe('<mi>a&lt;b &amp; &quot;c&quot;</mi>');
	});
});
