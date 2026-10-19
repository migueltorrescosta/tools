import { describe, expect, it } from 'vitest';
import { EQUATIONS } from './equations';
import { typesetAll } from './typeset';

describe('typesetAll', () => {
	it('gives inline SVG in currentColor with MathML for screen readers', async () => {
		const { defs, equations } = await typesetAll();
		expect(defs).toContain('<defs');
		expect(Object.keys(equations)).toEqual(Object.keys(EQUATIONS));
		for (const html of Object.values(equations)) {
			expect(html).toContain('fill="currentColor"');
			expect(html).toContain('<mjx-assistive-mml');
			expect(html).not.toContain('merror');
		}
	});
});
