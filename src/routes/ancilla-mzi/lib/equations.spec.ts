import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUT, serialize, typesetAll } from '../../../../scripts/typeset-ancilla-mzi';
import { EQUATIONS } from './equations';

describe('typeset equations', () => {
	it('match the TeX sources (run pnpm typeset:ancilla-mzi after editing equations.ts)', async () => {
		const fresh = serialize(await typesetAll());
		expect(readFileSync(OUT, 'utf8') === fresh).toBe(true);
	});

	it('are inline SVG in currentColor with MathML for screen readers', async () => {
		const { equations } = await typesetAll();
		expect(Object.keys(equations)).toEqual(Object.keys(EQUATIONS));
		for (const html of Object.values(equations)) {
			expect(html).toContain('fill="currentColor"');
			expect(html).toContain('<mjx-assistive-mml');
			expect(html).not.toContain('merror');
		}
	});
});
