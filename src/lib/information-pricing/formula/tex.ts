/**
 * Syntax tree to TeX for the KaTeX preview under each formula input. Only
 * numbers, identifiers (already `[A-Za-z0-9_]`) and fixed TeX reach the output.
 */
import type { CompareOp, Node } from './ast';
import { BINARY_POWER, precedence } from './print';

const COMPARE: Record<CompareOp, string> = {
	'<': '<',
	'<=': '\\le',
	'>': '>',
	'>=': '\\ge',
	'==': '=',
	'!=': '\\ne'
};

const paren = (s: string) => `\\left(${s}\\right)`;

/** A number in TeX: `1e6` as `10^{6}`, long integers grouped in thousands. */
export function texNumber(value: number): string {
	if (Number.isNaN(value)) return '\\mathrm{NaN}';
	if (!Number.isFinite(value)) return value > 0 ? '\\infty' : '-\\infty';
	const s = String(value);
	const e = s.indexOf('e');
	if (e >= 0) {
		const mantissa = s.slice(0, e);
		const exponent = s.slice(e + 1).replace('+', '');
		return mantissa === '1' ? `10^{${exponent}}` : `${mantissa} \\times 10^{${exponent}}`;
	}
	const [int, frac] = s.split('.');
	const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') : int;
	return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** A symbol: one letter italic, longer names upright. */
export function texSymbol(name: string): string {
	if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('not an identifier');
	const escaped = name.replace(/_/g, '\\_');
	return /^[A-Za-z]$/.test(name) ? name : `\\mathrm{${escaped}}`;
}

/** Fractions read as atoms, so they need no parentheses except as a power's base. */
const texPower = (n: Node) => (n.kind === 'binary' && n.op === '/' ? 10 : precedence(n));

/** The branches of a ternary (or `if`) chain, flattened into one `cases`. */
function cases(node: Node): string {
	const rows: string[] = [];
	let n: Node = node;
	for (;;) {
		if (n.kind === 'ternary') {
			rows.push(`${tex(n.then)} & \\text{if } ${tex(n.cond)}`);
			n = n.else;
		} else if (n.kind === 'call' && n.fn === 'if') {
			rows.push(`${tex(n.args[1])} & \\text{if } ${tex(n.args[0])}`);
			n = n.args[2];
		} else break;
	}
	rows.push(`${tex(n)} & \\text{otherwise}`);
	return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
}

const isCases = (n: Node) => n.kind === 'ternary' || (n.kind === 'call' && n.fn === 'if');

/** A power's base: anything but an atom (fractions included) gets parentheses. */
const base = (n: Node) => (precedence(n) < 10 || isCases(n) ? paren(tex(n)) : tex(n));

/** `node` as an operand: parenthesised when its power is below `min`. */
function operand(node: Node, min: number): string {
	return texPower(node) < min || isCases(node) ? paren(tex(node)) : tex(node);
}

/** TeX for a whole formula. */
export function tex(node: Node): string {
	switch (node.kind) {
		case 'num':
			return texNumber(node.value);
		case 'sym':
			return texSymbol(node.name);
		case 'unary':
			return node.op === '-' ? `-${operand(node.arg, 8)}` : `\\lnot ${operand(node.arg, 4)}`;
		case 'ternary':
			return cases(node);
		case 'binary': {
			const { op, left, right } = node;
			if (op === '/') return `\\frac{${tex(left)}}{${tex(right)}}`;
			if (op === '^') return `{${base(left)}}^{${tex(right)}}`;
			const p = BINARY_POWER[op];
			if (p === 5) return `${operand(left, 6)} ${COMPARE[op as CompareOp]} ${operand(right, 6)}`;
			const symbol = op === '*' ? '\\cdot' : op === 'and' ? '\\land' : op === 'or' ? '\\lor' : op;
			return `${operand(left, p)} ${symbol} ${operand(right, p + 1)}`;
		}
		case 'call': {
			const args = node.args.map(tex);
			const list = paren(args.join(', '));
			switch (node.fn) {
				case 'if':
					return cases(node);
				case 'ind':
					return `\\mathbb{1}\\left[${args[0]}\\right]`;
				case 'min':
				case 'max':
				case 'exp':
				case 'ln':
					return `\\${node.fn}${list}`;
				case 'abs':
					return `\\left|${args[0]}\\right|`;
				case 'sqrt':
					return `\\sqrt{${args[0]}}`;
				case 'floor':
					return `\\left\\lfloor ${args[0]} \\right\\rfloor`;
				case 'ceil':
					return `\\left\\lceil ${args[0]} \\right\\rceil`;
				case 'clamp':
					return `\\operatorname{clamp}${list}`;
				case 'pow':
					return `{${base(node.args[0])}}^{${args[1]}}`;
			}
		}
	}
}
