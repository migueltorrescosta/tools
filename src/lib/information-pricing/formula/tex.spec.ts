import { describe, expect, it } from 'vitest';
import { renderTex } from '$lib/tex';
import { Prng } from '$lib/prng';
import { parse } from './parse';
import { randomTree } from './test-helpers';
import { tex, texNumber, texSymbol } from './tex';

const t = (text: string) => {
	const r = parse(text);
	if (!r.ok) throw new Error(r.error.message);
	return tex(r.ast);
};

describe('tex', () => {
	it.each([
		['a / b', '\\frac{a}{b}'],
		['(a + b) / c * d', '\\frac{a + b}{c} \\cdot d'],
		['a * (b + c)', 'a \\cdot \\left(b + c\\right)'],
		['a - (b - c)', 'a - \\left(b - c\\right)'],
		['(a / b)^2', '{\\left(\\frac{a}{b}\\right)}^{2}'],
		['-x^2', '-{x}^{2}'],
		['(-x)^2', '{\\left(-x\\right)}^{2}'],
		['(1 + i)^5', '{\\left(1 + i\\right)}^{5}'],
		['Rev - Fuel', '\\mathrm{Rev} - \\mathrm{Fuel}'],
		['a_1 * x', '\\mathrm{a\\_1} \\cdot x'],
		['x <= y and y != 2', 'x \\le y \\land y \\ne 2'],
		['not x or y >= 1', '\\lnot x \\lor y \\ge 1'],
		['sqrt(x) + exp(y) + ln(z)', '\\sqrt{x} + \\exp\\left(y\\right) + \\ln\\left(z\\right)'],
		['min(N, t*T)', '\\min\\left(N, t \\cdot T\\right)'],
		['abs(x) + floor(y)', '\\left|x\\right| + \\left\\lfloor y \\right\\rfloor'],
		['ind(x > 0)', '\\mathbb{1}\\left[x > 0\\right]'],
		['pow(a + b, 2)', '{\\left(a + b\\right)}^{2}'],
		[
			'x > 0 ? x : y > 0 ? y : 0',
			'\\begin{cases} x & \\text{if } x > 0 \\\\ y & \\text{if } y > 0 \\\\ 0 & \\text{otherwise} \\end{cases}'
		],
		[
			'1 + if(c, a, b)',
			'1 + \\left(\\begin{cases} a & \\text{if } c \\\\ b & \\text{otherwise} \\end{cases}\\right)'
		]
	])('%s', (text, expected) => expect(t(text)).toBe(expected));

	it('formats numbers', () => {
		expect(texNumber(1e6)).toBe('1{,}000{,}000');
		expect(texNumber(1e21)).toBe('10^{21}');
		expect(texNumber(2.5e-7)).toBe('2.5 \\times 10^{-7}');
		expect(texNumber(1234)).toBe('1234');
		expect(texNumber(0.5)).toBe('0.5');
		expect(texNumber(Infinity)).toBe('\\infty');
	});

	it('refuses anything but an identifier as a symbol', () => {
		expect(() => texSymbol('a}\\x')).toThrow();
	});

	it('renders random formulas in KaTeX without errors', () => {
		const prng = new Prng(41);
		for (let k = 0; k < 200; k++) {
			const html = renderTex(tex(randomTree(prng, ['x', 'Rev', 'b_2'], 5)));
			expect(html).not.toContain('katex-error');
		}
	});
});
