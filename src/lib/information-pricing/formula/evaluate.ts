/**
 * Tree-walking reference evaluator: the test oracle for the generated loops.
 * Truthy means nonzero (NaN is truthy); comparisons and logic yield 1 or 0.
 */
import type { Node } from './ast';

/** Value of a symbol; throws or returns NaN for unknown names as the caller likes. */
export type Env = (name: string) => number;

const bool = (b: boolean) => (b ? 1 : 0);

/** Evaluate `node` with symbol values from `env`. */
export function evaluate(node: Node, env: Env): number {
	const ev = (n: Node) => evaluate(n, env);
	switch (node.kind) {
		case 'num':
			return node.value;
		case 'sym':
			return env(node.name);
		case 'unary':
			return node.op === '-' ? -ev(node.arg) : bool(ev(node.arg) === 0);
		case 'ternary':
			return ev(node.cond) !== 0 ? ev(node.then) : ev(node.else);
		case 'binary': {
			if (node.op === 'and') return bool(ev(node.left) !== 0 && ev(node.right) !== 0);
			if (node.op === 'or') return bool(ev(node.left) !== 0 || ev(node.right) !== 0);
			const a = ev(node.left);
			const b = ev(node.right);
			switch (node.op) {
				case '+':
					return a + b;
				case '-':
					return a - b;
				case '*':
					return a * b;
				case '/':
					return a / b;
				case '^':
					return Math.pow(a, b);
				case '<':
					return bool(a < b);
				case '<=':
					return bool(a <= b);
				case '>':
					return bool(a > b);
				case '>=':
					return bool(a >= b);
				case '==':
					return bool(a === b);
				case '!=':
					return bool(a !== b);
			}
			break;
		}
		case 'call': {
			const [a, b, c] = node.args;
			switch (node.fn) {
				case 'if':
					return ev(a) !== 0 ? ev(b) : ev(c);
				case 'ind':
					return bool(ev(a) !== 0);
				case 'min':
					return Math.min(...node.args.map(ev));
				case 'max':
					return Math.max(...node.args.map(ev));
				case 'abs':
					return Math.abs(ev(a));
				case 'exp':
					return Math.exp(ev(a));
				case 'ln':
					return Math.log(ev(a));
				case 'sqrt':
					return Math.sqrt(ev(a));
				case 'floor':
					return Math.floor(ev(a));
				case 'ceil':
					return Math.ceil(ev(a));
				case 'clamp':
					return Math.min(Math.max(ev(a), ev(b)), ev(c));
				case 'pow':
					return Math.pow(ev(a), ev(b));
			}
		}
	}
	throw new Error('unreachable');
}
