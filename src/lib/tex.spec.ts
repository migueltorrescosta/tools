import { describe, expect, it } from 'vitest';
import { renderTex } from './tex';

describe('renderTex', () => {
	it('renders HTML with a MathML copy', () => {
		const html = renderTex('x^2');
		expect(html).toContain('class="katex"');
		expect(html).toContain('<math');
	});

	it('does not throw on invalid TeX', () => {
		expect(() => renderTex('\\frac{')).not.toThrow();
	});
});
