/** Autocomplete for formula inputs: the identifier being typed and its matches. */
import { FUNCTION_NAMES } from './ast';

export interface Suggestion {
	/** What the list shows. */
	label: string;
	/** What replaces `[start, end)`: the symbol, or the function name with `(`. */
	insert: string;
	kind: 'symbol' | 'function';
}

export interface Completion {
	/** The identifier text before the caret. */
	prefix: string;
	/** The whole identifier around the caret, `[start, end)`, which a suggestion replaces. */
	start: number;
	end: number;
	suggestions: Suggestion[];
}

const WORD = /[A-Za-z0-9_]/;

/**
 * The identifier around `caret` and the declared symbols and whitelisted
 * functions it prefixes (case-insensitive), symbols first, each group sorted.
 * Null when the caret is not at the end of or inside an identifier.
 */
export function complete(
	text: string,
	caret: number,
	symbols: readonly string[]
): Completion | null {
	let start = caret;
	while (start > 0 && WORD.test(text[start - 1])) start--;
	let end = caret;
	while (end < text.length && WORD.test(text[end])) end++;
	const prefix = text.slice(start, caret);
	// Empty, or part of a number such as 1e6.
	if (prefix === '' || /[0-9]/.test(text[start]) || text[start - 1] === '.') return null;
	const lower = prefix.toLowerCase();
	const matches = (name: string) => name.toLowerCase().startsWith(lower);
	const byName = (a: string, b: string) =>
		a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
	const suggestions: Suggestion[] = [
		...[...new Set(symbols)]
			.filter(matches)
			.sort(byName)
			.map((s) => ({ label: s, insert: s, kind: 'symbol' as const })),
		...FUNCTION_NAMES.filter(matches).map((f) => ({
			label: `${f}()`,
			insert: `${f}(`,
			kind: 'function' as const
		}))
	];
	return { prefix, start, end, suggestions };
}
