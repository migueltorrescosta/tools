/**
 * Formula syntax trees and the function whitelist shared by the parser, the
 * evaluator, the TeX printer and the code generator. No DOM or Svelte imports.
 */

/** A character range `[start, end)` in the formula text. */
export interface Span {
	start: number;
	end: number;
}

/** A located error: `[start, end)` is the offending text. */
export interface FormulaError extends Span {
	message: string;
}

export type CompareOp = '<' | '<=' | '>' | '>=' | '==' | '!=';
export type BinaryOp = '+' | '-' | '*' | '/' | '^' | CompareOp | 'and' | 'or';
export type UnaryOp = '-' | 'not';

/** Whitelisted functions. */
export type FnName =
	'if' | 'ind' | 'min' | 'max' | 'abs' | 'exp' | 'ln' | 'sqrt' | 'floor' | 'ceil' | 'clamp' | 'pow';

export type Node = Span &
	(
		| { kind: 'num'; value: number }
		| { kind: 'sym'; name: string }
		| { kind: 'unary'; op: UnaryOp; arg: Node }
		| { kind: 'binary'; op: BinaryOp; left: Node; right: Node }
		| { kind: 'ternary'; cond: Node; then: Node; else: Node }
		| { kind: 'call'; fn: FnName; args: Node[] }
	);

/** Arity of each whitelisted function: `[min, max]`, max `Infinity` for variadic. */
export const FUNCTIONS: ReadonlyMap<FnName, readonly [number, number]> = new Map<
	FnName,
	readonly [number, number]
>([
	['if', [3, 3]],
	['ind', [1, 1]],
	['min', [2, Infinity]],
	['max', [2, Infinity]],
	['abs', [1, 1]],
	['exp', [1, 1]],
	['ln', [1, 1]],
	['sqrt', [1, 1]],
	['floor', [1, 1]],
	['ceil', [1, 1]],
	['clamp', [3, 3]],
	['pow', [2, 2]]
]);

/** Whitelisted function names, sorted. */
export const FUNCTION_NAMES: readonly FnName[] = [...FUNCTIONS.keys()].sort();

/** Word operators; never usable as symbols. */
export const KEYWORDS: ReadonlySet<string> = new Set(['and', 'or', 'not']);

export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const MAX_FORMULA_LENGTH = 2000;
export const MAX_DEPTH = 64;

/** True if `name` is a whitelisted function (own entries only). */
export const isFunction = (name: string): name is FnName => FUNCTIONS.has(name as FnName);

/** Every symbol name the formula references, in first-use order. */
export const symbolsOf = (node: Node): Set<string> => new Set(symbolNodes(node).map((s) => s.name));

/** Every `sym` node, for locating unknown names. */
export function symbolNodes(node: Node, out: (Node & { kind: 'sym' })[] = []) {
	switch (node.kind) {
		case 'num':
			break;
		case 'sym':
			out.push(node);
			break;
		case 'unary':
			symbolNodes(node.arg, out);
			break;
		case 'binary':
			symbolNodes(node.left, out);
			symbolNodes(node.right, out);
			break;
		case 'ternary':
			symbolNodes(node.cond, out);
			symbolNodes(node.then, out);
			symbolNodes(node.else, out);
			break;
		case 'call':
			for (const a of node.args) symbolNodes(a, out);
			break;
	}
	return out;
}
