/** Formula tokeniser: numbers, identifiers, operators and parentheses, with spans. */
import type { FormulaError, Span } from './ast';

export type Token = Span &
	(
		| { kind: 'num'; value: number; text: string }
		| { kind: 'ident'; text: string }
		| { kind: 'op'; text: string }
		| { kind: 'eof'; text: '' }
	);

/** Tokens up to the first bad character, then `eof`; `error` names that character. */
export interface Tokens {
	tokens: Token[];
	error?: FormulaError;
}

const OPERATORS = [
	'<=',
	'>=',
	'==',
	'!=',
	'+',
	'-',
	'*',
	'/',
	'^',
	'<',
	'>',
	'(',
	')',
	',',
	'?',
	':'
];
const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const SPACE = /\s/;

/** Split `text` into tokens; stops at the first character outside the language. */
export function tokenise(text: string): Tokens {
	const tokens: Token[] = [];
	let i = 0;
	const fail = (message: string, start: number, end: number): Tokens => {
		tokens.push({ kind: 'eof', text: '', start, end: start });
		return { tokens, error: { message, start, end } };
	};
	while (i < text.length) {
		const ch = text[i];
		if (SPACE.test(ch)) {
			i++;
			continue;
		}
		NUMBER.lastIndex = i;
		const num = NUMBER.exec(text);
		if (num) {
			const end = i + num[0].length;
			if (/[A-Za-z_.]/.test(text[end] ?? '')) {
				let bad = end;
				while (bad < text.length && /[A-Za-z0-9_.]/.test(text[bad])) bad++;
				return fail(`Malformed number "${text.slice(i, bad)}"`, i, bad);
			}
			tokens.push({ kind: 'num', value: Number(num[0]), text: num[0], start: i, end });
			i = end;
			continue;
		}
		IDENT.lastIndex = i;
		const id = IDENT.exec(text);
		if (id) {
			tokens.push({ kind: 'ident', text: id[0], start: i, end: i + id[0].length });
			i += id[0].length;
			continue;
		}
		const op = OPERATORS.find((o) => text.startsWith(o, i));
		if (op) {
			tokens.push({ kind: 'op', text: op, start: i, end: i + op.length });
			i += op.length;
			continue;
		}
		const cp = String.fromCodePoint(text.codePointAt(i)!);
		const hint =
			ch === '=' ? ' (use == to compare)' : ch === '!' ? ' (use not, or != to compare)' : '';
		return fail(`Unexpected character "${cp}"${hint}`, i, i + cp.length);
	}
	tokens.push({ kind: 'eof', text: '', start: text.length, end: text.length });
	return { tokens };
}
