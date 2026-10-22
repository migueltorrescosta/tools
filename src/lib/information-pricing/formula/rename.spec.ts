import { describe, expect, it } from 'vitest';
import { renameInFormula } from './rename';

describe('renameInFormula', () => {
	it('rewrites whole identifiers only and keeps whitespace', () => {
		expect(renameInFormula('L*(1+ i)^5  +Lr - i_2 + min(i,i)', 'i', 'rate')).toBe(
			'L*(1+ rate)^5  +Lr - i_2 + min(rate,rate)'
		);
	});

	it('leaves numbers alone', () => {
		expect(renameInFormula('1e6 * e', 'e', 'E')).toBe('1e6 * E');
	});

	it('works on formulas that do not parse', () => {
		expect(renameInFormula('x + + (x', 'x', 'y')).toBe('y + + (y');
	});

	it('rewrites up to a bad character and keeps the rest verbatim', () => {
		expect(renameInFormula('x + 1; x', 'x', 'y')).toBe('y + 1; x');
	});

	it('ignores an invalid new name', () => {
		expect(renameInFormula('x + 1', 'x', 'a b')).toBe('x + 1');
		expect(renameInFormula('x + 1', 'x', '')).toBe('x + 1');
	});
});
