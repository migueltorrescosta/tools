/**
 * Algebraic simplification that preserves values wherever the original is
 * feasible: constant folding, identities (x+0, x·1, x·0, x−x, x/x, x^1), and
 * lifting constants out of + and × chains so they combine, e.g.
 * c1·(c2·x) → (c1c2)·x and (x+c1)+c2 → x+(c1+c2). Constants end up on the
 * left of × and on the right of +; x/c becomes (1/c)·x and x−c becomes x+(−c).
 */
import { binary, constant, exprEquals, getConstants, unary } from './expr';
import type { Expr } from './types';

const isConst = (e: Expr): e is { kind: 'const'; value: number } => e.kind === 'const';
const isConstValue = (e: Expr, v: number): boolean => e.kind === 'const' && e.value === v;

/** The constant on the right of an `add` node, if any: `rest + c`. */
function constRight(e: Expr, op: 'add'): { c: number; rest: Expr } | null {
	if (e.kind === 'binary' && e.op === op && e.right.kind === 'const' && e.left.kind !== 'const') {
		return { c: e.right.value, rest: e.left };
	}
	return null;
}

/** The constant on the left of an `op` node, if any: `op(c, rest)`. */
function constLeft(e: Expr, op: 'add' | 'mul'): { c: number; rest: Expr } | null {
	if (e.kind === 'binary' && e.op === op && e.left.kind === 'const' && e.right.kind !== 'const') {
		return { c: e.left.value, rest: e.right };
	}
	return null;
}

/** Simplifies one node whose children are already simplified. */
function node(e: Expr, depth = 0): Expr {
	if (depth > 64) return e;
	const again = (n: Expr) => node(n, depth + 1);

	if (e.kind === 'unary') {
		const a = e.child;
		if (isConst(a)) {
			const v = unaryValue(e.op, a.value);
			if (Number.isFinite(v)) return constant(v);
			return e;
		}
		if (a.kind === 'unary') {
			if (e.op === 'square' && a.op === 'sqrt') return a.child;
			if (e.op === 'exp' && a.op === 'log') return a.child;
			if (e.op === 'log' && a.op === 'exp') return a.child;
			if (
				e.op === 'abs' &&
				(a.op === 'abs' || a.op === 'square' || a.op === 'sqrt' || a.op === 'exp')
			)
				return a;
		}
		return e;
	}
	if (e.kind !== 'binary') return e;

	const { op } = e;
	let l = e.left;
	let r = e.right;
	if (isConst(l) && isConst(r)) {
		const v = binaryValue(op, l.value, r.value);
		if (Number.isFinite(v)) return constant(v);
		return e;
	}

	switch (op) {
		case 'add': {
			if (isConst(l)) [l, r] = [r, l];
			if (isConstValue(r, 0)) return l;
			if (isConst(r)) {
				const c = r.value;
				const inner = constRight(l, 'add');
				if (inner) return again(binary('add', inner.rest, constant(inner.c + c)));
				if (l.kind === 'binary' && l.op === 'sub' && isConst(l.right))
					return again(binary('add', l.left, constant(c - l.right.value)));
				if (l.kind === 'binary' && l.op === 'sub' && isConst(l.left))
					return again(binary('sub', constant(c + l.left.value), l.right));
				return binary('add', l, r);
			}
			const lc = constRight(l, 'add');
			if (lc) return again(binary('add', again(binary('add', lc.rest, r)), constant(lc.c)));
			const rc = constRight(r, 'add');
			if (rc) return again(binary('add', again(binary('add', l, rc.rest)), constant(rc.c)));
			if (exprEquals(l, r)) return again(binary('mul', constant(2), l));
			return binary('add', l, r);
		}
		case 'sub': {
			if (isConstValue(r, 0)) return l;
			if (exprEquals(l, r)) return constant(0);
			if (isConst(l)) {
				const c = l.value;
				const inner = constRight(r, 'add');
				if (inner) return again(binary('sub', constant(c - inner.c), inner.rest));
				if (r.kind === 'binary' && r.op === 'sub' && isConst(r.left))
					return again(binary('add', r.right, constant(c - r.left.value)));
				if (r.kind === 'binary' && r.op === 'sub' && isConst(r.right))
					return again(binary('sub', constant(c + r.right.value), r.left));
				return binary('sub', l, r);
			}
			// x − c is kept as x + (−c); formatting shows it as a subtraction.
			if (isConst(r)) return again(binary('add', l, constant(-r.value)));
			const lc = constRight(l, 'add');
			if (lc) return again(binary('add', again(binary('sub', lc.rest, r)), constant(lc.c)));
			const rc = constRight(r, 'add');
			if (rc) return again(binary('add', again(binary('sub', l, rc.rest)), constant(-rc.c)));
			return binary('sub', l, r);
		}
		case 'mul': {
			if (isConst(r)) [l, r] = [r, l];
			if (isConstValue(l, 0)) return constant(0);
			if (isConstValue(l, 1)) return r;
			if (isConst(l)) {
				const c = l.value;
				const inner = constLeft(r, 'mul');
				if (inner && Number.isFinite(c * inner.c))
					return again(binary('mul', constant(c * inner.c), inner.rest));
				if (r.kind === 'binary' && r.op === 'div' && isConst(r.left))
					return again(binary('div', constant(c * r.left.value), r.right));
				return binary('mul', l, r);
			}
			const lc = constLeft(l, 'mul');
			if (lc) return again(binary('mul', constant(lc.c), again(binary('mul', lc.rest, r))));
			const rc = constLeft(r, 'mul');
			if (rc) return again(binary('mul', constant(rc.c), again(binary('mul', l, rc.rest))));
			return binary('mul', l, r);
		}
		case 'div': {
			if (isConstValue(r, 1)) return l;
			if (isConstValue(l, 0)) return constant(0);
			if (exprEquals(l, r)) return constant(1);
			if (isConst(r)) {
				if (r.value === 0) return e;
				return again(binary('mul', constant(1 / r.value), l));
			}
			if (isConst(l)) {
				const inner = constLeft(r, 'mul');
				if (inner) return again(binary('div', constant(l.value / inner.c), inner.rest));
				return binary('div', l, r);
			}
			const lc = constLeft(l, 'mul');
			if (lc) return again(binary('mul', constant(lc.c), again(binary('div', lc.rest, r))));
			const rc = constLeft(r, 'mul');
			if (rc && rc.c !== 0)
				return again(binary('mul', constant(1 / rc.c), again(binary('div', l, rc.rest))));
			return binary('div', l, r);
		}
		case 'pow': {
			if (isConstValue(r, 1)) return l;
			if (isConstValue(r, 0)) return constant(1);
			if (isConstValue(l, 1)) return constant(1);
			return e;
		}
	}
}

function unaryValue(op: string, a: number): number {
	switch (op) {
		case 'square':
			return a * a;
		case 'cube':
			return a * a * a;
		case 'sqrt':
			return Math.sqrt(a);
		case 'exp':
			return Math.exp(a);
		case 'log':
			return Math.log(a);
		case 'sin':
			return Math.sin(a);
		case 'cos':
			return Math.cos(a);
		default:
			return Math.abs(a);
	}
}

function binaryValue(op: string, a: number, b: number): number {
	switch (op) {
		case 'add':
			return a + b;
		case 'sub':
			return a - b;
		case 'mul':
			return a * b;
		case 'div':
			return a / b;
		default:
			return Math.pow(a, b);
	}
}

/** Simplified copy of `e`. Never increases the node count. */
export function simplify(e: Expr): Expr {
	const walk = (n: Expr): Expr => {
		if (n.kind === 'unary') return node(unary(n.op, walk(n.child)));
		if (n.kind === 'binary') return node(binary(n.op, walk(n.left), walk(n.right)));
		return n;
	};
	const out = walk(e);
	return getConstants(out).every(Number.isFinite) ? out : e;
}
