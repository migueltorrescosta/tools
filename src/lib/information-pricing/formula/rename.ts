/** Rename a symbol inside formula text by rewriting identifier tokens, keeping the rest verbatim. */
import { IDENTIFIER } from './ast';
import { tokenise } from './tokenise';

/**
 * `text` with every identifier token `from` replaced by `to`. Works on any
 * text that tokenises up to some point; text after a bad character is kept as
 * is. Returns `text` unchanged when `to` is not an identifier.
 */
export function renameInFormula(text: string, from: string, to: string): string {
	if (from === to || !IDENTIFIER.test(to)) return text;
	const { tokens } = tokenise(text);
	let out = '';
	let last = 0;
	for (const t of tokens) {
		if (t.kind !== 'ident' || t.text !== from) continue;
		out += text.slice(last, t.start) + to;
		last = t.end;
	}
	return out + text.slice(last);
}
