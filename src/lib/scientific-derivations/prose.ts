import { renderTex } from '$lib/tex';

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

/** Prose to HTML: text is escaped, `$…$` spans are rendered as inline TeX. */
export function renderProse(text: string): string {
	return text
		.split(/(\$[^$]+\$)/)
		.map((part) =>
			part.length > 2 && part.startsWith('$') && part.endsWith('$')
				? renderTex(part.slice(1, -1))
				: part.replace(/[&<>"']/g, (c) => ESCAPES[c])
		)
		.join('');
}

/**
 * Display TeX with each `\qquad`-separated part on its own line, to keep boxes narrow.
 * The `{}` after each line break stops a part starting with `[` from being read as its spacing.
 */
export function stackTex(tex: string): string {
	const parts = tex.split(/,?\s*\\qquad\s*/);
	return parts.length === 1
		? tex
		: String.raw`\begin{gathered}${parts.join(String.raw`\\{}`)}\end{gathered}`;
}
