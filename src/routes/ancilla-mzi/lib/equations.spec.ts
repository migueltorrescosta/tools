import { describe, expect, it } from 'vitest';
import { renderTex } from '$lib/tex';
import { EQUATIONS } from './equations';

describe('EQUATIONS', () => {
	it.each(Object.entries(EQUATIONS))('%s renders with KaTeX and a MathML copy', (_, tex) => {
		const html = renderTex(tex);
		expect(html).toContain('<math');
		expect(html).not.toContain('katex-error');
	});
});
