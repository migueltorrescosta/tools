/**
 * Expression trees: complexity, keys, constants and a postfix stack-machine
 * evaluator over `Float64Array` columns. Trees are treated as immutable: every
 * helper returns a new tree and subtrees may be shared between trees.
 */
import type { BinaryOp, Dataset, Expr, UnaryOp } from './types';

export const constant = (value: number): Expr => ({ kind: 'const', value });
export const variable = (index: number): Expr => ({ kind: 'var', index });
export const unary = (op: UnaryOp, child: Expr): Expr => ({ kind: 'unary', op, child });
export const binary = (op: BinaryOp, left: Expr, right: Expr): Expr => ({
	kind: 'binary',
	op,
	left,
	right
});

/** Node count (PySR's default complexity). */
export function complexity(e: Expr): number {
	switch (e.kind) {
		case 'const':
		case 'var':
			return 1;
		case 'unary':
			return 1 + complexity(e.child);
		case 'binary':
			return 1 + complexity(e.left) + complexity(e.right);
	}
}

/** Deep copy. */
export function clone(e: Expr): Expr {
	switch (e.kind) {
		case 'const':
			return constant(e.value);
		case 'var':
			return variable(e.index);
		case 'unary':
			return unary(e.op, clone(e.child));
		case 'binary':
			return binary(e.op, clone(e.left), clone(e.right));
	}
}

/** A canonical string for structural equality and hashing. Constants keep full precision. */
export function exprKey(e: Expr): string {
	switch (e.kind) {
		case 'const':
			return String(e.value);
		case 'var':
			return `x${e.index}`;
		case 'unary':
			return `${e.op}(${exprKey(e.child)})`;
		case 'binary':
			return `${e.op}(${exprKey(e.left)},${exprKey(e.right)})`;
	}
}

/** Like `exprKey` but every constant becomes `c`: equal shapes, any constants. */
export function shapeKey(e: Expr): string {
	switch (e.kind) {
		case 'const':
			return 'c';
		case 'var':
			return `x${e.index}`;
		case 'unary':
			return `${e.op}(${shapeKey(e.child)})`;
		case 'binary':
			return `${e.op}(${shapeKey(e.left)},${shapeKey(e.right)})`;
	}
}

export function exprEquals(a: Expr, b: Expr): boolean {
	if (a.kind !== b.kind) return false;
	switch (a.kind) {
		case 'const':
			return Object.is(a.value, (b as typeof a).value);
		case 'var':
			return a.index === (b as typeof a).index;
		case 'unary': {
			const u = b as typeof a;
			return a.op === u.op && exprEquals(a.child, u.child);
		}
		case 'binary': {
			const u = b as typeof a;
			return a.op === u.op && exprEquals(a.left, u.left) && exprEquals(a.right, u.right);
		}
	}
}

/** Constant values, leaves left to right. */
export function getConstants(e: Expr): number[] {
	const out: number[] = [];
	const walk = (n: Expr): void => {
		if (n.kind === 'const') out.push(n.value);
		else if (n.kind === 'unary') walk(n.child);
		else if (n.kind === 'binary') {
			walk(n.left);
			walk(n.right);
		}
	};
	walk(e);
	return out;
}

/** A copy of `e` with its constants (left to right) replaced by `values`. */
export function setConstants(e: Expr, values: ArrayLike<number>): Expr {
	let i = 0;
	const walk = (n: Expr): Expr => {
		switch (n.kind) {
			case 'const':
				return constant(values[i++]);
			case 'var':
				return n;
			case 'unary':
				return unary(n.op, walk(n.child));
			case 'binary': {
				const l = walk(n.left);
				return binary(n.op, l, walk(n.right));
			}
		}
	};
	return walk(e);
}

// ---------------------------------------------------------------------------
// Postfix programs

const OP_CONST = 0;
const OP_VAR = 1;
const BINARY_CODE: Record<BinaryOp, number> = { add: 2, sub: 3, mul: 4, div: 5, pow: 6 };
const UNARY_CODE: Record<UnaryOp, number> = {
	square: 10,
	cube: 11,
	sqrt: 12,
	exp: 13,
	log: 14,
	sin: 15,
	cos: 16,
	abs: 17
};

/** A tree compiled to postfix. `arg` holds the constant value or the variable index. */
export interface Program {
	code: Int32Array;
	arg: Float64Array;
	/** Positions in `code` of the constants, leaves left to right. */
	constSlots: Int32Array;
	/**
	 * 1 where the instruction's result must be checked for NaN/±Inf: where it
	 * feeds an op that could turn a non-finite value finite (the divisor of a
	 * division, exp, either side of pow), and the last instruction. Everywhere
	 * else NaN and ±Inf propagate to a checked value.
	 */
	check: Uint8Array;
}

export function compile(e: Expr): Program {
	const size = complexity(e);
	const code = new Int32Array(size);
	const arg = new Float64Array(size);
	const check = new Uint8Array(size);
	const slots: number[] = [];
	let k = 0;
	const walk = (n: Expr): void => {
		switch (n.kind) {
			case 'const':
				slots.push(k);
				code[k] = OP_CONST;
				arg[k++] = n.value;
				return;
			case 'var':
				code[k] = OP_VAR;
				arg[k++] = n.index;
				return;
			case 'unary':
				walk(n.child);
				if (n.op === 'exp') check[k - 1] = 1;
				code[k++] = UNARY_CODE[n.op];
				return;
			case 'binary': {
				walk(n.left);
				const li = k - 1;
				walk(n.right);
				if (n.op === 'div' || n.op === 'pow') check[k - 1] = 1;
				if (n.op === 'pow') check[li] = 1;
				code[k++] = BINARY_CODE[n.op];
				return;
			}
		}
	};
	walk(e);
	check[size - 1] = 1;
	return { code, arg, constSlots: Int32Array.from(slots), check };
}

/** Scratch buffers, one set per row count, reused across evaluations. */
const pools = new Map<number, Float64Array[]>();
function buffer(n: number, slot: number): Float64Array {
	let pool = pools.get(n);
	if (!pool) {
		if (pools.size > 8) pools.clear();
		pool = [];
		pools.set(n, pool);
	}
	let b = pool[slot];
	if (!b) b = pool[slot] = new Float64Array(n);
	return b;
}

function unaryScalar(op: number, a: number): number {
	switch (op) {
		case 10:
			return a * a;
		case 11:
			return a * a * a;
		case 12:
			return Math.sqrt(a);
		case 13:
			return Math.exp(a);
		case 14:
			return Math.log(a);
		case 15:
			return Math.sin(a);
		case 16:
			return Math.cos(a);
		default:
			return Math.abs(a);
	}
}

function binaryScalar(op: number, a: number, b: number): number {
	switch (op) {
		case 2:
			return a + b;
		case 3:
			return a - b;
		case 4:
			return a * b;
		case 5:
			return a / b;
		default:
			return Math.pow(a, b);
	}
}

/** Applies a unary op elementwise. */
function unaryArray(op: number, a: Float64Array, o: Float64Array, n: number): void {
	switch (op) {
		case 10:
			for (let i = 0; i < n; i++) {
				const v = a[i];
				o[i] = v * v;
			}
			break;
		case 11:
			for (let i = 0; i < n; i++) {
				const v = a[i];
				o[i] = v * v * v;
			}
			break;
		case 12:
			for (let i = 0; i < n; i++) {
				o[i] = Math.sqrt(a[i]);
			}
			break;
		case 13:
			for (let i = 0; i < n; i++) {
				o[i] = Math.exp(a[i]);
			}
			break;
		case 14:
			for (let i = 0; i < n; i++) {
				o[i] = Math.log(a[i]);
			}
			break;
		case 15:
			for (let i = 0; i < n; i++) {
				o[i] = Math.sin(a[i]);
			}
			break;
		case 16:
			for (let i = 0; i < n; i++) {
				o[i] = Math.cos(a[i]);
			}
			break;
		default:
			for (let i = 0; i < n; i++) o[i] = Math.abs(a[i]);
	}
}

/** Elementwise binary op; `a`/`b` null means the scalar `sa`/`sb`. */
function binaryArray(
	op: number,
	a: Float64Array | null,
	sa: number,
	b: Float64Array | null,
	sb: number,
	o: Float64Array,
	n: number
): void {
	if (a && b) {
		switch (op) {
			case 2:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] + b[i];
				}
				break;
			case 3:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] - b[i];
				}
				break;
			case 4:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] * b[i];
				}
				break;
			case 5:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] / b[i];
				}
				break;
			default:
				for (let i = 0; i < n; i++) {
					o[i] = Math.pow(a[i], b[i]);
				}
		}
	} else if (a) {
		switch (op) {
			case 2:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] + sb;
				}
				break;
			case 3:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] - sb;
				}
				break;
			case 4:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] * sb;
				}
				break;
			case 5:
				for (let i = 0; i < n; i++) {
					o[i] = a[i] / sb;
				}
				break;
			default:
				for (let i = 0; i < n; i++) {
					o[i] = Math.pow(a[i], sb);
				}
		}
	} else if (b) {
		switch (op) {
			case 2:
				for (let i = 0; i < n; i++) {
					o[i] = sa + b[i];
				}
				break;
			case 3:
				for (let i = 0; i < n; i++) {
					o[i] = sa - b[i];
				}
				break;
			case 4:
				for (let i = 0; i < n; i++) {
					o[i] = sa * b[i];
				}
				break;
			case 5:
				for (let i = 0; i < n; i++) {
					o[i] = sa / b[i];
				}
				break;
			default:
				for (let i = 0; i < n; i++) {
					o[i] = Math.pow(sa, b[i]);
				}
		}
	}
}

function allFinite(o: Float64Array, n: number): boolean {
	for (let i = 0; i < n; i++) {
		const v = o[i];
		if (v - v !== 0) return false;
	}
	return true;
}

const stackArr: (Float64Array | null)[] = [];
const stackScalar: number[] = [];

/**
 * Runs a program over `n` rows. The result may alias an input column or a
 * scratch buffer, so it is only valid until the next call. Null if infeasible.
 */
export function runProgram(
	prog: Program,
	x: Float64Array[],
	n: number,
	rows?: ArrayLike<number>
): Float64Array | null {
	const { code, arg, check } = prog;
	let sp = 0;
	for (let k = 0; k < code.length; k++) {
		const op = code[k];
		if (op === OP_CONST) {
			stackArr[sp] = null;
			stackScalar[sp++] = arg[k];
		} else if (op === OP_VAR) {
			const col = x[arg[k]];
			if (rows) {
				const o = buffer(n, sp);
				for (let i = 0; i < n; i++) o[i] = col[rows[i]];
				stackArr[sp++] = o;
			} else stackArr[sp++] = col;
		} else if (op >= 10) {
			const a = stackArr[sp - 1];
			if (a === null) {
				const r = unaryScalar(op, stackScalar[sp - 1]);
				if (!Number.isFinite(r)) return null;
				stackScalar[sp - 1] = r;
			} else {
				const o = buffer(n, sp - 1);
				unaryArray(op, a, o, n);
				if (check[k] && !allFinite(o, n)) return null;
				stackArr[sp - 1] = o;
			}
		} else {
			sp--;
			const a = stackArr[sp - 1];
			const b = stackArr[sp];
			if (a === null && b === null) {
				const r = binaryScalar(op, stackScalar[sp - 1], stackScalar[sp]);
				if (!Number.isFinite(r)) return null;
				stackScalar[sp - 1] = r;
			} else {
				const o = buffer(n, sp - 1);
				binaryArray(op, a, stackScalar[sp - 1], b, stackScalar[sp], o, n);
				if (check[k] && !allFinite(o, n)) return null;
				stackArr[sp - 1] = o;
			}
		}
	}
	const top = stackArr[0];
	if (top !== null) return top;
	const o = buffer(n, 0);
	o.fill(stackScalar[0], 0, n);
	return o;
}

/** Mean squared error of a program against `y`; Infinity when infeasible. */
export function programMse(
	prog: Program,
	x: Float64Array[],
	y: Float64Array,
	rows?: ArrayLike<number>
): number {
	const n = rows ? rows.length : y.length;
	if (n === 0) return 0;
	const p = runProgram(prog, x, n, rows);
	if (!p) return Infinity;
	let s = 0;
	if (rows) {
		for (let i = 0; i < n; i++) {
			const d = p[i] - y[rows[i]];
			s += d * d;
		}
	} else {
		for (let i = 0; i < n; i++) {
			const d = p[i] - y[i];
			s += d * d;
		}
	}
	const m = s / n;
	return Number.isFinite(m) ? m : Infinity;
}

/**
 * Evaluates `expr` on every row (or on `rows`, indices into the columns).
 * Returns null if any intermediate or final value is NaN or ±Inf (infeasible).
 */
export function evaluate(
	expr: Expr,
	x: Float64Array[],
	rows?: ArrayLike<number>,
	out?: Float64Array
): Float64Array | null {
	const n = rows ? rows.length : (x[0]?.length ?? out?.length ?? 0);
	const r = runProgram(compile(expr), x, n, rows);
	if (!r) return null;
	const o = out ?? new Float64Array(n);
	o.set(r.subarray(0, n));
	return o;
}

/** MSE of `expr` on a dataset; Infinity when infeasible. */
export function mse(expr: Expr, data: Dataset, rows?: ArrayLike<number>): number {
	return programMse(compile(expr), data.x, data.y, rows);
}
