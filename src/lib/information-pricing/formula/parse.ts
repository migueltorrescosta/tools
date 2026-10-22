/**
 * Pratt parser from formula text to a syntax tree with character spans.
 * Binding powers, loosest first: `?:` (right), `or`, `and`, `not`, comparisons
 * (non-chaining), `+ -`, `* /`, unary minus, `^` (right). So `-x^2` is `-(x^2)`.
 */
import {
	FUNCTIONS,
	isFunction,
	KEYWORDS,
	MAX_DEPTH,
	MAX_FORMULA_LENGTH,
	type BinaryOp,
	type FormulaError,
	type Node
} from './ast';
import { tokenise, type Token } from './tokenise';

export type ParseResult = { ok: true; ast: Node } | { ok: false; error: FormulaError };

const TERNARY = 1;
const NOT = 4;
const COMPARE = 5;
const NEG = 8;
const POW = 9;

/** Left binding power of each infix operator. */
const INFIX: ReadonlyMap<string, number> = new Map([
	['?', TERNARY],
	['or', 2],
	['and', 3],
	['<', COMPARE],
	['<=', COMPARE],
	['>', COMPARE],
	['>=', COMPARE],
	['==', COMPARE],
	['!=', COMPARE],
	['+', 6],
	['-', 6],
	['*', 7],
	['/', 7],
	['^', POW]
]);

class ParseError extends Error {
	constructor(
		message: string,
		readonly start: number,
		readonly end: number
	) {
		super(message);
	}
}

const describe = (t: Token) => (t.kind === 'eof' ? 'end of formula' : `"${t.text}"`);

/** Parse one formula. Never throws. */
export function parse(text: string): ParseResult {
	if (text.length > MAX_FORMULA_LENGTH) {
		const error = `Formula is longer than ${MAX_FORMULA_LENGTH} characters`;
		return { ok: false, error: { message: error, start: MAX_FORMULA_LENGTH, end: text.length } };
	}
	const { tokens, error } = tokenise(text);
	let pos = 0;
	let depth = 0;
	const peek = () => tokens[pos];
	const fail = (message: string, t: Token = peek()): never => {
		// A tokeniser error at the eof we stopped on is the better message.
		if (t.kind === 'eof' && error) throw new ParseError(error.message, error.start, error.end);
		throw new ParseError(message, t.start, t.kind === 'eof' ? t.start : t.end);
	};
	const isOp = (t: Token, op: string) => (t.kind === 'op' || t.kind === 'ident') && t.text === op;
	const expect = (op: string, context: string) => {
		const t = peek();
		if (!isOp(t, op)) fail(`Expected "${op}" ${context}, found ${describe(t)}`);
		pos++;
		return t;
	};
	const infixPower = (t: Token): number => {
		if (t.kind !== 'op' && t.kind !== 'ident') return 0;
		return INFIX.get(t.text) ?? 0;
	};

	function expression(minPower: number): Node {
		if (++depth > MAX_DEPTH) fail(`Formula is nested more than ${MAX_DEPTH} levels deep`);
		let left = prefix();
		for (;;) {
			const t = peek();
			const power = infixPower(t);
			if (power === 0) {
				if (t.kind !== 'eof' && !isOp(t, ')') && !isOp(t, ',') && !isOp(t, ':'))
					fail(`Expected an operator, found ${describe(t)}`);
				break;
			}
			if (power <= minPower) break;
			pos++;
			if (t.text === '?') {
				const then = expression(0);
				expect(':', 'in "c ? a : b"');
				const otherwise = expression(0);
				left = {
					kind: 'ternary',
					cond: left,
					then,
					else: otherwise,
					start: left.start,
					end: otherwise.end
				};
				continue;
			}
			// ^ is right-associative: its right side may hold another ^.
			const right = expression(t.text === '^' ? POW - 1 : power);
			if (power === COMPARE && infixPower(peek()) === COMPARE)
				fail('Comparisons do not chain; combine them with "and"');
			left = {
				kind: 'binary',
				op: t.text as BinaryOp,
				left,
				right,
				start: left.start,
				end: right.end
			};
		}
		depth--;
		return left;
	}

	function prefix(): Node {
		const t = peek();
		if (t.kind === 'num') {
			pos++;
			return { kind: 'num', value: t.value, start: t.start, end: t.end };
		}
		if (isOp(t, '-') || isOp(t, 'not')) {
			pos++;
			const arg = expression(t.text === '-' ? NEG : NOT);
			const op = t.text === '-' ? '-' : 'not';
			return { kind: 'unary', op, arg, start: t.start, end: arg.end };
		}
		if (isOp(t, '(')) {
			pos++;
			const inner = expression(0);
			const close = expect(')', 'to close "("');
			return { ...inner, start: t.start, end: close.end };
		}
		if (t.kind === 'ident') {
			if (KEYWORDS.has(t.text)) fail(`Unexpected "${t.text}"`);
			pos++;
			if (!isOp(peek(), '(')) return { kind: 'sym', name: t.text, start: t.start, end: t.end };
			if (!isFunction(t.text)) return fail(`Unknown function "${t.text}"`, t);
			const fn = t.text;
			pos++;
			const args: Node[] = [];
			if (!isOp(peek(), ')')) {
				for (;;) {
					args.push(expression(0));
					if (!isOp(peek(), ',')) break;
					pos++;
				}
			}
			const close = expect(')', `to close ${fn}(`);
			const [lo, hi] = FUNCTIONS.get(fn)!;
			if (args.length < lo || args.length > hi) {
				const want = lo === hi ? `${lo}` : hi === Infinity ? `at least ${lo}` : `${lo}–${hi}`;
				throw new ParseError(
					`${fn} takes ${want} argument${lo === 1 && hi === 1 ? '' : 's'}, got ${args.length}`,
					t.start,
					close.end
				);
			}
			return { kind: 'call', fn, args, start: t.start, end: close.end };
		}
		if (t.kind === 'eof' && !error && pos === 0) fail('Formula is empty');
		return fail(`Expected a number, symbol or "(", found ${describe(t)}`);
	}

	try {
		const ast = expression(0);
		const t = peek();
		if (t.kind !== 'eof') fail(isOp(t, ')') ? 'Unmatched ")"' : `Unexpected ${describe(t)}`);
		if (error) throw new ParseError(error.message, error.start, error.end);
		return { ok: true, ast };
	} catch (e) {
		if (e instanceof ParseError)
			return { ok: false, error: { message: e.message, start: e.start, end: e.end } };
		throw e;
	}
}
