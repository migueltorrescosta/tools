/**
 * Render an expression tree as plain text, LaTeX, Python (numpy) or JavaScript.
 * Parentheses are minimal but always correct for the target's precedence rules.
 * Display formats round numbers to 6 significant digits; code formats keep full
 * precision so copied code reproduces the tool's predictions.
 */
import type { BinaryOp, Expr, UnaryOp } from './types';

/** Precedence levels shared by every renderer (higher binds tighter). */
export const PREC = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 } as const;

export interface NumberParts {
	negative: boolean;
	/** Digits of the magnitude, e.g. `6.674`; `NaN` or `Infinity` for non-finite values. */
	mantissa: string;
	/** Power of ten when the value is shown in scientific notation, else null. */
	exponent: number | null;
}

/** Split a value for display: 6 significant digits, scientific outside [1e-4, 1e6). */
export function numberParts(v: number): NumberParts {
	if (Number.isNaN(v)) return { negative: false, mantissa: 'NaN', exponent: null };
	if (!Number.isFinite(v)) return { negative: v < 0, mantissa: 'Infinity', exponent: null };
	const r = Math.abs(Number(v.toPrecision(6)));
	const negative = v < 0 && r !== 0;
	if (r !== 0 && (r >= 1e6 || r < 1e-4)) {
		const [m, e] = r.toExponential().split('e');
		return { negative, mantissa: m, exponent: Number(e) };
	}
	return { negative, mantissa: String(r), exponent: null };
}

/** Plain-text number: `2.5`, `-3`, `6.674e-11`. */
export function formatNumber(v: number): string {
	const { negative, mantissa, exponent } = numberParts(v);
	return (negative ? '-' : '') + mantissa + (exponent === null ? '' : `e${exponent}`);
}

const RESERVED = new Set(
	// Python keywords and the numpy alias
	(
		'False None True and as assert async await break class continue def del elif else except ' +
		'finally for from global if import in is lambda nonlocal not or pass raise return try while ' +
		'with yield np ' +
		// JavaScript reserved words and globals the export uses
		'case catch const debugger default delete do enum export extends false function instanceof ' +
		'let new null super switch this throw true typeof var void arguments eval Math Infinity NaN ' +
		'undefined implements interface package private protected public static'
	).split(' ')
);

/** Turn a column name into an identifier valid in both Python and JavaScript. */
export function sanitizeIdentifier(name: string): string {
	let id = name.replace(/[^A-Za-z0-9_]/g, '_');
	if (id === '' || /^[0-9]/.test(id)) id = `_${id}`;
	if (RESERVED.has(id)) id = `${id}_`;
	return id;
}

/** Sanitise every name, suffixing `_2`, `_3`, … so distinct columns stay distinct. */
export function sanitizeNames(names: string[]): string[] {
	const used = new Set<string>();
	return names.map((name) => {
		const base = sanitizeIdentifier(name);
		let id = base;
		for (let k = 2; used.has(id); k++) id = `${base}_${k}`;
		used.add(id);
		return id;
	});
}

/** A rendered fragment and the precedence of its outermost operator. */
interface Frag {
	s: string;
	p: number;
}

/** Negative constants on the right of + and − become − and +; returns the rewritten op. */
export function foldNegativeRight(op: BinaryOp, right: Expr): { op: BinaryOp; right: Expr } | null {
	if ((op === 'add' || op === 'sub') && right.kind === 'const' && right.value < 0) {
		return { op: op === 'add' ? 'sub' : 'add', right: { kind: 'const', value: -right.value } };
	}
	return null;
}

interface InfixStyle {
	num(v: number): string;
	name(index: number): string;
	fn: Record<Exclude<UnaryOp, 'square' | 'cube'>, string>;
	ops: Record<BinaryOp, string>;
	/** Code keeps the tree's evaluation order: no regrouping of a + (b + c) or a * (b * c). */
	exact: boolean;
}

function renderInfix(e: Expr, st: InfixStyle): Frag {
	switch (e.kind) {
		case 'const': {
			const s = st.num(e.value);
			return { s, p: s.startsWith('-') ? PREC.neg : PREC.atom };
		}
		case 'var':
			return { s: st.name(e.index), p: PREC.atom };
		case 'unary': {
			const child = renderInfix(e.child, st);
			if (e.op === 'square' || e.op === 'cube') {
				const base = child.p > PREC.pow ? child.s : `(${child.s})`;
				return { s: `${base}${st.ops.pow}${e.op === 'square' ? 2 : 3}`, p: PREC.pow };
			}
			return { s: `${st.fn[e.op]}(${child.s})`, p: PREC.atom };
		}
		case 'binary': {
			const folded = foldNegativeRight(e.op, e.right);
			const op = folded?.op ?? e.op;
			const left = renderInfix(e.left, st);
			const right = renderInfix(folded?.right ?? e.right, st);
			const r = e.right;
			let p: number, minL: number, minR: number;
			if (op === 'add' || op === 'sub') {
				p = PREC.add;
				minL = PREC.add;
				minR = op === 'add' && !st.exact && r.kind === 'binary' && r.op === 'add' ? 1 : 2;
			} else if (op === 'mul' || op === 'div') {
				p = PREC.mul;
				minL = PREC.mul;
				minR = op === 'mul' && !st.exact && r.kind === 'binary' && r.op === 'mul' ? 2 : 3;
			} else {
				p = PREC.pow;
				minL = PREC.pow + 1;
				minR = PREC.pow;
			}
			const ls = left.p >= minL ? left.s : `(${left.s})`;
			const rs = right.p >= minR && !right.s.startsWith('-') ? right.s : `(${right.s})`;
			return { s: `${ls}${st.ops[op]}${rs}`, p };
		}
	}
}

const CODE_OPS: Record<BinaryOp, string> = {
	add: ' + ',
	sub: ' - ',
	mul: ' * ',
	div: ' / ',
	pow: ' ** '
};

/** Plain human text: `2.5 * x^2`, `sqrt(a) * a`. */
export function toText(expr: Expr, names: string[]): string {
	return renderInfix(expr, {
		num: formatNumber,
		name: (i) => names[i] ?? `x${i}`,
		fn: { sqrt: 'sqrt', exp: 'exp', log: 'log', sin: 'sin', cos: 'cos', abs: 'abs' },
		ops: { ...CODE_OPS, pow: '^' },
		exact: false
	}).s;
}

/** Full-precision literal, or the language's spelling of a non-finite value. */
function codeNumber(v: number, nan: string, inf: string): string {
	if (Number.isNaN(v)) return nan;
	if (!Number.isFinite(v)) return v < 0 ? `-${inf}` : inf;
	return String(v);
}

/** A numpy expression over sanitised names (see `sanitizeNames`), e.g. `2.5 * x ** 2`. */
export function toPython(expr: Expr, names: string[]): string {
	const ids = sanitizeNames(names);
	return renderInfix(expr, {
		num: (v) => codeNumber(v, 'np.nan', 'np.inf'),
		name: (i) => ids[i] ?? `x${i}`,
		fn: {
			sqrt: 'np.sqrt',
			exp: 'np.exp',
			log: 'np.log',
			sin: 'np.sin',
			cos: 'np.cos',
			abs: 'np.abs'
		},
		ops: CODE_OPS,
		exact: true
	}).s;
}

/** A JavaScript expression over sanitised names (see `sanitizeNames`), e.g. `2.5 * x ** 2`. */
export function toJavaScript(expr: Expr, names: string[]): string {
	const ids = sanitizeNames(names);
	return renderInfix(expr, {
		num: (v) => codeNumber(v, 'NaN', 'Infinity'),
		name: (i) => ids[i] ?? `x${i}`,
		fn: {
			sqrt: 'Math.sqrt',
			exp: 'Math.exp',
			log: 'Math.log',
			sin: 'Math.sin',
			cos: 'Math.cos',
			abs: 'Math.abs'
		},
		ops: CODE_OPS,
		exact: true
	}).s;
}

const LATEX_ESCAPES: Record<string, string> = {
	'\\': '\\backslash ',
	'{': '\\{',
	'}': '\\}',
	_: '\\_',
	'#': '\\#',
	$: '\\$',
	'%': '\\%',
	'&': '\\&',
	'^': '\\hat{}',
	'~': '\\sim ',
	' ': '\\ '
};

/** `x`, `x_{1}` for a letter plus digits, otherwise `\mathrm{...}` with specials escaped. */
export function latexName(name: string): string {
	if (/^[A-Za-z]$/.test(name)) return name;
	const sub = /^([A-Za-z])(\d+)$/.exec(name);
	if (sub) return `${sub[1]}_{${sub[2]}}`;
	return `\\mathrm{${name.replace(/[\\{}_#$%&^~ ]/g, (c) => LATEX_ESCAPES[c])}}`;
}

function latexNumber(v: number): Frag {
	const { negative, mantissa, exponent } = numberParts(v);
	const sign = negative ? '-' : '';
	if (mantissa === 'NaN') return { s: '\\mathrm{NaN}', p: PREC.atom };
	if (mantissa === 'Infinity') return { s: `${sign}\\infty`, p: negative ? PREC.neg : PREC.atom };
	if (exponent !== null) {
		return { s: `${sign}${mantissa} \\times 10^{${exponent}}`, p: negative ? PREC.neg : PREC.mul };
	}
	return { s: sign + mantissa, p: negative ? PREC.neg : PREC.atom };
}

const LATEX_FN: Record<'log' | 'sin' | 'cos', string> = { log: '\\ln', sin: '\\sin', cos: '\\cos' };

function paren(s: string): string {
	return `\\left(${s}\\right)`;
}

function renderLatex(e: Expr, names: string[]): Frag {
	switch (e.kind) {
		case 'const':
			return latexNumber(e.value);
		case 'var':
			return { s: latexName(names[e.index] ?? `x${e.index}`), p: PREC.atom };
		case 'unary': {
			const c = renderLatex(e.child, names);
			switch (e.op) {
				case 'square':
				case 'cube': {
					const base = c.p > PREC.pow ? c.s : paren(c.s);
					return { s: `${base}^{${e.op === 'square' ? 2 : 3}}`, p: PREC.pow };
				}
				case 'sqrt':
					return { s: `\\sqrt{${c.s}}`, p: PREC.atom };
				case 'exp':
					return { s: `e^{${c.s}}`, p: PREC.pow };
				case 'abs':
					return { s: `\\left|${c.s}\\right|`, p: PREC.atom };
				default:
					return { s: `${LATEX_FN[e.op]}${paren(c.s)}`, p: PREC.atom };
			}
		}
		case 'binary': {
			const folded = foldNegativeRight(e.op, e.right);
			const op = folded?.op ?? e.op;
			const l = renderLatex(e.left, names);
			const r = renderLatex(folded?.right ?? e.right, names);
			if (op === 'div') return { s: `\\frac{${l.s}}{${r.s}}`, p: PREC.pow };
			if (op === 'pow') {
				return { s: `${l.p > PREC.pow ? l.s : paren(l.s)}^{${r.s}}`, p: PREC.pow };
			}
			const sameAssoc =
				e.right.kind === 'binary' && (op === 'add' || op === 'mul') && e.right.op === op;
			const p = op === 'mul' ? PREC.mul : PREC.add;
			const minR = sameAssoc ? p : p + 1;
			const ls = l.p >= p ? l.s : paren(l.s);
			const rs = r.p >= minR && !r.s.startsWith('-') ? r.s : paren(r.s);
			const sym = op === 'mul' ? ' \\cdot ' : op === 'add' ? ' + ' : ' - ';
			return { s: ls + sym + rs, p };
		}
	}
}

/** LaTeX math (no delimiters): `2.5 \cdot x^{2}`, `\frac{a}{b}`. */
export function toLatex(expr: Expr, names: string[]): string {
	return renderLatex(expr, names).s;
}
