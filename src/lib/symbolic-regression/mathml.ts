/** Render an expression tree as native MathML, with fences only where precedence needs them. */
import { foldNegativeRight, numberParts, PREC } from './format';
import type { Expr } from './types';

/** A single MathML element and the precedence of its outermost operator. */
interface Frag {
	s: string;
	p: number;
	/** True when the rendering starts with a minus sign. */
	minus?: boolean;
}

const XML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};

function escapeXml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

function row(...parts: string[]): string {
	return `<mrow>${parts.join('')}</mrow>`;
}

function fence(s: string): string {
	return row('<mo>(</mo>', s, '<mo>)</mo>');
}

/** `<mi>x</mi>`, a subscript for a letter plus digits (`x1`), otherwise the escaped name. */
function nameMl(name: string): string {
	const sub = /^([A-Za-z])(\d+)$/.exec(name);
	if (sub) return `<msub><mi>${sub[1]}</mi><mn>${sub[2]}</mn></msub>`;
	return `<mi>${escapeXml(name)}</mi>`;
}

function numberMl(v: number): Frag {
	const { negative, mantissa, exponent } = numberParts(v);
	let s: string;
	let p: number = PREC.atom;
	if (mantissa === 'NaN') s = '<mi>NaN</mi>';
	else if (mantissa === 'Infinity') s = '<mi>∞</mi>';
	else if (exponent === null) s = `<mn>${mantissa}</mn>`;
	else {
		const e = exponent < 0 ? row('<mo>−</mo>', `<mn>${-exponent}</mn>`) : `<mn>${exponent}</mn>`;
		s = row(`<mn>${mantissa}</mn>`, '<mo>×</mo>', `<msup><mn>10</mn>${e}</msup>`);
		p = PREC.mul;
	}
	if (!negative) return { s, p };
	return { s: row('<mo>−</mo>', s), p: PREC.neg, minus: true };
}

const FN_NAMES = { log: 'ln', sin: 'sin', cos: 'cos' } as const;

function render(e: Expr, names: string[]): Frag {
	switch (e.kind) {
		case 'const':
			return numberMl(e.value);
		case 'var':
			return { s: nameMl(names[e.index] ?? `x${e.index}`), p: PREC.atom };
		case 'unary': {
			const c = render(e.child, names);
			switch (e.op) {
				case 'square':
				case 'cube': {
					const base = c.p > PREC.pow ? c.s : fence(c.s);
					return { s: `<msup>${base}<mn>${e.op === 'square' ? 2 : 3}</mn></msup>`, p: PREC.pow };
				}
				case 'sqrt':
					return { s: `<msqrt>${c.s}</msqrt>`, p: PREC.atom };
				case 'exp':
					return { s: `<msup><mi>e</mi>${c.s}</msup>`, p: PREC.pow };
				case 'abs':
					return { s: row('<mo>|</mo>', c.s, '<mo>|</mo>'), p: PREC.atom };
				default:
					return {
						s: row(`<mi>${FN_NAMES[e.op]}</mi>`, '<mo>&#x2061;</mo>', fence(c.s)),
						p: PREC.atom
					};
			}
		}
		case 'binary': {
			const folded = foldNegativeRight(e.op, e.right);
			const op = folded?.op ?? e.op;
			const l = render(e.left, names);
			const r = render(folded?.right ?? e.right, names);
			if (op === 'div') return { s: `<mfrac>${l.s}${r.s}</mfrac>`, p: PREC.pow };
			if (op === 'pow') {
				return { s: `<msup>${l.p > PREC.pow ? l.s : fence(l.s)}${r.s}</msup>`, p: PREC.pow };
			}
			const sameAssoc =
				e.right.kind === 'binary' && (op === 'add' || op === 'mul') && e.right.op === op;
			const p = op === 'mul' ? PREC.mul : PREC.add;
			const lFenced = l.p < p;
			const ls = lFenced ? fence(l.s) : l.s;
			const rs = r.p >= (sameAssoc ? p : p + 1) && !r.minus ? r.s : fence(r.s);
			const sym = op === 'mul' ? '⋅' : op === 'add' ? '+' : '−';
			return { s: row(ls, `<mo>${sym}</mo>`, rs), p, minus: !lFenced && l.minus };
		}
	}
}

/** Native MathML for the expression: `<math display="block">…</math>`. */
export function toMathML(expr: Expr, names: string[]): string {
	return `<math display="block">${render(expr, names).s}</math>`;
}
