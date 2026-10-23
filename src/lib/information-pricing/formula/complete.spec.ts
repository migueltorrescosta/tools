import { describe, expect, it } from 'vitest';
import { complete } from './complete';

const symbols = ['Rev', 'rate', 'R', 'Delta', 'm'];

describe('complete', () => {
	it('suggests symbols then functions matching the prefix, case-insensitively', () => {
		const c = complete('1 + r', 5, symbols)!;
		expect(c).toMatchObject({ prefix: 'r', start: 4, end: 5 });
		expect(c.suggestions.map((s) => s.label)).toEqual(['R', 'rate', 'Rev']);
		const m = complete('m', 1, symbols)!;
		expect(m.suggestions.map((s) => s.insert)).toEqual(['m', 'max(', 'min(']);
		expect(m.suggestions.map((s) => s.kind)).toEqual(['symbol', 'function', 'function']);
	});

	it('covers the whole identifier around the caret', () => {
		expect(complete('a + Revenue * 2', 6, symbols)).toMatchObject({
			prefix: 'Re',
			start: 4,
			end: 11
		});
	});

	it('returns null outside an identifier or inside a number', () => {
		expect(complete('a + ', 4, symbols)).toBeNull();
		expect(complete('1e', 2, symbols)).toBeNull();
		expect(complete('x', 0, symbols)).toBeNull();
	});

	it('offers functions alone when no symbol matches', () => {
		expect(complete('sq', 2, symbols)!.suggestions).toEqual([
			{ label: 'sqrt()', insert: 'sqrt(', kind: 'function' }
		]);
	});
});
