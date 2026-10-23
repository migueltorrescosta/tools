/** Print a syntax tree back to formula text with the fewest parentheses that parse back to it. */
import type { BinaryOp, Node } from './ast';

/** Binding power of a node's outermost operator (atoms are 10). */
export function precedence(node: Node): number {
	switch (node.kind) {
		case 'ternary':
			return 1;
		case 'unary':
			return node.op === '-' ? 8 : 4;
		case 'binary':
			return BINARY_POWER[node.op];
		default:
			return 10;
	}
}

export const BINARY_POWER: Record<BinaryOp, number> = {
	or: 2,
	and: 3,
	'<': 5,
	'<=': 5,
	'>': 5,
	'>=': 5,
	'==': 5,
	'!=': 5,
	'+': 6,
	'-': 6,
	'*': 7,
	'/': 7,
	'^': 9
};

/** Whether `child` needs parentheses as the `side` operand of a binary operator of power `p`. */
export function needsParens(child: Node, p: number, side: 'left' | 'right'): boolean {
	const c = precedence(child);
	if (p === 9) return side === 'left' ? c < 10 : c < 8;
	if (p === 5) return c <= 5;
	return side === 'left' ? c < p : c <= p;
}

/** Formula text for `node`. */
export function print(node: Node): string {
	const wrap = (n: Node, paren: boolean) => (paren ? `(${print(n)})` : print(n));
	switch (node.kind) {
		case 'num':
			return String(node.value);
		case 'sym':
			return node.name;
		case 'unary':
			return node.op === '-'
				? `-${wrap(node.arg, precedence(node.arg) < 8)}`
				: `not ${wrap(node.arg, precedence(node.arg) < 4)}`;
		case 'binary': {
			const p = BINARY_POWER[node.op];
			const l = wrap(node.left, needsParens(node.left, p, 'left'));
			const r = wrap(node.right, needsParens(node.right, p, 'right'));
			return `${l} ${node.op} ${r}`;
		}
		case 'ternary':
			return `${wrap(node.cond, precedence(node.cond) <= 1)} ? ${print(node.then)} : ${print(node.else)}`;
		case 'call':
			return `${node.fn}(${node.args.map(print).join(', ')})`;
	}
}
