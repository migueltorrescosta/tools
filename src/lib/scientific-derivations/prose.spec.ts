import { describe, expect, it } from 'vitest';
import { renderProse, stackTex } from './prose';

describe('renderProse', () => {
	it('escapes text and renders $…$ as TeX', () => {
		const html = renderProse('a <b> & $x^2$ end');
		expect(html.startsWith('a &lt;b&gt; &amp; ')).toBe(true);
		expect(html).toContain('class="katex"');
		expect(html.endsWith(' end')).toBe(true);
	});

	it('leaves a lone dollar sign as text', () => {
		expect(renderProse('costs $5')).toBe('costs $5');
	});
});

describe('stackTex', () => {
	it('puts each \\qquad-separated part on its own line', () => {
		expect(stackTex(String.raw`a = 1,\qquad b = 2`)).toBe(
			String.raw`\begin{gathered}a = 1\\{}b = 2\end{gathered}`
		);
		expect(stackTex('a = 1')).toBe('a = 1');
	});
});
