/**
 * TeX to HTML with KaTeX, shared by every tool. The output carries a hidden
 * MathML copy for screen readers; render it inside `$lib/ui/Tex.svelte`, which
 * loads the KaTeX stylesheet and fonts. Safe in prerender and in the browser.
 */
import katex from 'katex';

export function renderTex(tex: string, displayMode = false): string {
	return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'htmlAndMathml' });
}
