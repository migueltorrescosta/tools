import { describe, expect, it } from 'vitest';
import {
	formatNumber,
	latexName,
	sanitizeIdentifier,
	sanitizeNames,
	toJavaScript,
	toLatex,
	toPython,
	toText
} from './format';
import { BINARY_OPS, UNARY_OPS, type BinaryOp, type Expr, type UnaryOp } from './types';

const c = (value: number): Expr => ({ kind: 'const', value });
const v = (index: number): Expr => ({ kind: 'var', index });
const u = (op: UnaryOp, child: Expr): Expr => ({ kind: 'unary', op, child });
const b = (op: BinaryOp, left: Expr, right: Expr): Expr => ({ kind: 'binary', op, left, right });

const abc = ['a', 'b', 'c'];
const kepler = b('mul', c(2.5), u('square', v(0)));
const product = b('add', b('mul', v(0), v(1)), c(1));

describe('formatNumber', () => {
	it('keeps up to 6 significant digits without trailing zeros', () => {
		expect(formatNumber(2.5)).toBe('2.5');
		expect(formatNumber(3)).toBe('3');
		expect(formatNumber(1 / 3)).toBe('0.333333');
		expect(formatNumber(-123.4567891)).toBe('-123.457');
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(0.0001)).toBe('0.0001');
	});

	it('uses scientific notation for very large or small values', () => {
		expect(formatNumber(6.674e-11)).toBe('6.674e-11');
		expect(formatNumber(1.989e30)).toBe('1.989e30');
		expect(formatNumber(999999.7)).toBe('1e6');
		expect(formatNumber(-0.00001234567)).toBe('-1.23457e-5');
	});
});

describe('toText', () => {
	it('renders sample trees', () => {
		expect(toText(kepler, ['x'])).toBe('2.5 * x^2');
		expect(toText(product, ['x1', 'x2'])).toBe('x1 * x2 + 1');
		expect(toText(b('mul', u('sqrt', v(0)), v(0)), abc)).toBe('sqrt(a) * a');
		expect(toText(u('cube', u('log', v(0))), abc)).toBe('log(a)^3');
	});

	it('uses minimal correct parentheses', () => {
		expect(toText(b('sub', v(0), b('sub', v(1), v(2))), abc)).toBe('a - (b - c)');
		expect(toText(b('sub', b('sub', v(0), v(1)), v(2)), abc)).toBe('a - b - c');
		expect(toText(b('div', v(0), b('mul', v(1), v(2))), abc)).toBe('a / (b * c)');
		expect(toText(b('div', b('mul', v(0), v(1)), v(2)), abc)).toBe('a * b / c');
		expect(toText(b('mul', b('add', v(0), v(1)), v(2)), abc)).toBe('(a + b) * c');
		expect(toText(b('add', v(0), b('mul', v(1), v(2))), abc)).toBe('a + b * c');
		expect(toText(b('add', v(0), b('add', v(1), v(2))), abc)).toBe('a + b + c');
		expect(toText(b('mul', v(0), b('div', v(1), v(2))), abc)).toBe('a * (b / c)');
		expect(toText(b('pow', v(0), b('pow', v(1), v(2))), abc)).toBe('a^b^c');
		expect(toText(b('pow', b('pow', v(0), v(1)), v(2)), abc)).toBe('(a^b)^c');
		expect(toText(u('square', b('add', v(0), v(1))), abc)).toBe('(a + b)^2');
	});

	it('handles negative constants', () => {
		expect(toText(b('mul', v(0), c(-2)), abc)).toBe('a * (-2)');
		expect(toText(b('mul', c(-2), v(0)), abc)).toBe('-2 * a');
		expect(toText(b('add', v(0), c(-2)), abc)).toBe('a - 2');
		expect(toText(b('sub', v(0), c(-2)), abc)).toBe('a + 2');
		expect(toText(b('pow', c(-2), v(0)), abc)).toBe('(-2)^a');
		expect(toText(b('pow', v(0), c(-2)), abc)).toBe('a^(-2)');
		expect(toText(b('add', v(0), b('mul', c(-2), v(1))), abc)).toBe('a + (-2 * b)');
	});
});

describe('toLatex', () => {
	it('renders sample trees', () => {
		expect(toLatex(kepler, ['x'])).toBe('2.5 \\cdot x^{2}');
		expect(toLatex(product, ['x1', 'x2'])).toBe('x_{1} \\cdot x_{2} + 1');
		expect(toLatex(b('div', v(0), v(1)), abc)).toBe('\\frac{a}{b}');
		expect(toLatex(u('sqrt', v(0)), abc)).toBe('\\sqrt{a}');
		expect(toLatex(u('exp', v(0)), ['x'])).toBe('e^{x}');
		expect(toLatex(u('log', v(0)), ['x'])).toBe('\\ln\\left(x\\right)');
		expect(toLatex(u('sin', v(0)), ['x'])).toBe('\\sin\\left(x\\right)');
		expect(toLatex(u('cos', v(0)), ['x'])).toBe('\\cos\\left(x\\right)');
		expect(toLatex(u('abs', v(0)), ['x'])).toBe('\\left|x\\right|');
	});

	it('uses minimal correct parentheses', () => {
		expect(toLatex(b('sub', v(0), b('sub', v(1), v(2))), abc)).toBe('a - \\left(b - c\\right)');
		expect(toLatex(b('mul', b('add', v(0), v(1)), v(2)), abc)).toBe(
			'\\left(a + b\\right) \\cdot c'
		);
		expect(toLatex(b('div', b('add', v(0), v(1)), b('mul', v(1), v(2))), abc)).toBe(
			'\\frac{a + b}{b \\cdot c}'
		);
		expect(toLatex(b('pow', b('add', v(0), v(1)), b('add', v(1), v(2))), abc)).toBe(
			'\\left(a + b\\right)^{b + c}'
		);
		expect(toLatex(u('square', u('exp', v(0))), abc)).toBe('\\left(e^{a}\\right)^{2}');
		expect(toLatex(u('square', b('div', v(0), v(1))), abc)).toBe('\\left(\\frac{a}{b}\\right)^{2}');
		expect(toLatex(b('pow', v(0), c(1.5)), abc)).toBe('a^{1.5}');
	});

	it('handles negative and scientific constants', () => {
		expect(toLatex(b('mul', v(0), c(-2)), abc)).toBe('a \\cdot \\left(-2\\right)');
		expect(toLatex(b('pow', c(-2), v(0)), abc)).toBe('\\left(-2\\right)^{a}');
		expect(toLatex(b('pow', v(0), c(-2)), abc)).toBe('a^{-2}');
		expect(toLatex(c(6.674e-11), abc)).toBe('6.674 \\times 10^{-11}');
		expect(toLatex(b('mul', c(6.674e-11), v(0)), abc)).toBe('6.674 \\times 10^{-11} \\cdot a');
	});

	it('wraps and escapes names that are not single letters', () => {
		expect(latexName('x')).toBe('x');
		expect(latexName('x12')).toBe('x_{12}');
		expect(latexName('a_AU')).toBe('\\mathrm{a\\_AU}');
		expect(latexName('mass kg')).toBe('\\mathrm{mass\\ kg}');
		expect(latexName('50%{x}')).toBe('\\mathrm{50\\%\\{x\\}}');
		expect(toLatex(u('sqrt', v(0)), ['T_years'])).toBe('\\sqrt{\\mathrm{T\\_years}}');
	});
});

describe('sanitizeIdentifier and sanitizeNames', () => {
	it('makes valid identifiers', () => {
		expect(sanitizeIdentifier('a_AU')).toBe('a_AU');
		expect(sanitizeIdentifier('mass (kg)')).toBe('mass__kg_');
		expect(sanitizeIdentifier('2nd')).toBe('_2nd');
		expect(sanitizeIdentifier('')).toBe('_');
		expect(sanitizeIdentifier('lambda')).toBe('lambda_');
		expect(sanitizeIdentifier('np')).toBe('np_');
		expect(sanitizeIdentifier('Math')).toBe('Math_');
	});

	it('keeps distinct names distinct', () => {
		expect(sanitizeNames(['a b', 'a_b', 'a-b'])).toEqual(['a_b', 'a_b_2', 'a_b_3']);
	});
});

describe('toPython', () => {
	it('renders numpy code with ** and full precision', () => {
		expect(toPython(kepler, ['x'])).toBe('2.5 * x ** 2');
		expect(toPython(b('mul', c(1 / 3), u('cube', v(0))), ['x'])).toBe(
			'0.3333333333333333 * x ** 3'
		);
		expect(toPython(u('log', u('abs', v(0))), ['x'])).toBe('np.log(np.abs(x))');
		expect(toPython(b('add', u('exp', v(0)), b('mul', u('sin', v(1)), u('cos', v(2)))), abc)).toBe(
			'np.exp(a) + np.sin(b) * np.cos(c)'
		);
		expect(toPython(u('sqrt', v(0)), ['a AU'])).toBe('np.sqrt(a_AU)');
		expect(toPython(c(6.674e-11), abc)).toBe('6.674e-11');
		expect(toPython(c(NaN), abc)).toBe('np.nan');
	});

	it('keeps the tree grouping and parenthesises negative bases', () => {
		expect(toPython(b('add', v(0), b('add', v(1), v(2))), abc)).toBe('a + (b + c)');
		expect(toPython(b('pow', c(-2), v(0)), abc)).toBe('(-2) ** a');
		expect(toPython(b('pow', v(0), b('pow', v(1), v(2))), abc)).toBe('a ** b ** c');
		expect(toPython(b('pow', b('pow', v(0), v(1)), v(2)), abc)).toBe('(a ** b) ** c');
		expect(toPython(u('square', c(-3)), abc)).toBe('(-3) ** 2');
	});
});

describe('toJavaScript', () => {
	it('renders Math code with **', () => {
		expect(toJavaScript(kepler, ['x'])).toBe('2.5 * x ** 2');
		expect(toJavaScript(product, ['x1', 'x2'])).toBe('x1 * x2 + 1');
		expect(toJavaScript(u('log', u('abs', v(0))), ['x'])).toBe('Math.log(Math.abs(x))');
		expect(toJavaScript(b('pow', c(-2), v(0)), abc)).toBe('(-2) ** a');
		expect(toJavaScript(b('mul', v(0), c(-2)), abc)).toBe('a * (-2)');
		expect(toJavaScript(c(-Infinity), abc)).toBe('-Infinity');
	});

	function reference(e: Expr, x: number[]): number {
		switch (e.kind) {
			case 'const':
				return e.value;
			case 'var':
				return x[e.index];
			case 'indicator':
				return (e.mask >>> x[e.index]) & 1;
			case 'unary': {
				const a = reference(e.child, x);
				const fns: Record<UnaryOp, (t: number) => number> = {
					square: (t) => Math.pow(t, 2),
					cube: (t) => Math.pow(t, 3),
					sqrt: Math.sqrt,
					exp: Math.exp,
					log: Math.log,
					sin: Math.sin,
					cos: Math.cos,
					abs: Math.abs
				};
				return fns[e.op](a);
			}
			case 'binary': {
				const l = reference(e.left, x);
				const r = reference(e.right, x);
				if (e.op === 'add') return l + r;
				if (e.op === 'sub') return l - r;
				if (e.op === 'mul') return l * r;
				if (e.op === 'div') return l / r;
				return Math.pow(l, r);
			}
		}
	}

	/** Mulberry32: a small seeded PRNG so the random trees are reproducible. */
	function rng(seed: number): () => number {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function randomTree(rand: () => number, depth: number, vars: number): Expr {
		const r = rand();
		if (depth === 0 || r < 0.2) {
			if (rand() < 0.5) return v(Math.floor(rand() * vars));
			const k = Math.round((rand() * 8 - 4) * 100) / 100;
			return c(k === 0 ? 0.5 : k);
		}
		if (r < 0.4)
			return u(UNARY_OPS[Math.floor(rand() * UNARY_OPS.length)], randomTree(rand, depth - 1, vars));
		const op = BINARY_OPS[Math.floor(rand() * BINARY_OPS.length)];
		return b(op, randomTree(rand, depth - 1, vars), randomTree(rand, depth - 1, vars));
	}

	it('evaluates like the tree on random expressions', () => {
		const rand = rng(42);
		const names = ['x 1', 'lambda', '2y'];
		const ids = sanitizeNames(names);
		for (let t = 0; t < 300; t++) {
			const tree = randomTree(rand, 5, names.length);
			const code = toJavaScript(tree, names);
			const fn = new Function(...ids, `return ${code};`) as (...args: number[]) => number;
			for (let k = 0; k < 5; k++) {
				const x = names.map(() => rand() * 6 - 3);
				const expected = reference(tree, x);
				const actual = fn(...x);
				if (Number.isNaN(expected)) expect(actual, code).toBeNaN();
				else expect(actual, code).toBe(expected);
			}
		}
	});
});

describe('indicators', () => {
	const ind = (index: number, mask: number): Expr => ({ kind: 'indicator', index, mask });
	const names = ['w', 'zone'];
	const levels = [null, ['city', 'island', 'remote_far']];
	// 6·1[zone ∈ {island, remote_far}] + w
	const e = b('add', b('mul', c(6), ind(1, 0b110)), v(0));

	it('renders as text', () => {
		expect(toText(e, names, levels)).toBe('6 * 1[zone ∈ {island, remote_far}] + w');
	});

	it('renders as LaTeX with escaped level names', () => {
		expect(toLatex(e, names, levels)).toBe(
			'6 \\cdot \\mathbf{1}_{\\{\\text{island}, \\text{remote\\_far}\\}}\\left(\\mathrm{zone}\\right) + w'
		);
	});

	it('renders as Python and JavaScript over string levels', () => {
		expect(toPython(e, names, levels)).toBe(
			'6 * np.isin(zone, ["island", "remote_far"]).astype(float) + w'
		);
		expect(toJavaScript(e, names, levels)).toBe(
			'6 * (["island", "remote_far"].includes(zone) ? 1 : 0) + w'
		);
	});

	it('uses number literals when every level is numeric', () => {
		expect(toJavaScript(ind(0, 0b101), ['g'], [['1', '2', '3.5']])).toBe(
			'([1, 3.5].includes(g) ? 1 : 0)'
		);
	});
});
