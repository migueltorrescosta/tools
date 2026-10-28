import { describe, expect, it } from 'vitest';
import { MAX_ROWS, parseSample, sampleCsv } from './upload';

const numbers = (n: number) => Array.from({ length: n }, (_, i) => String(i / 10));

describe('parseSample', () => {
	it('reads one column and skips a header', () => {
		const r = parseSample(['height', ...numbers(12)].join('\n'));
		expect(r.error).toBeNull();
		expect(r.header).toBe(true);
		expect(Array.from(r.data)).toEqual(numbers(12).map(Number));
	});

	it('accepts CRLF, blank lines, signs and exponents', () => {
		const r = parseSample(['-1', '+2.5', '', '3e-2', '.5', ...numbers(8)].join('\r\n'));
		expect(r.error).toBeNull();
		expect(Array.from(r.data.slice(0, 4))).toEqual([-1, 2.5, 0.03, 0.5]);
	});

	it('reports lines without a single number, by line number', () => {
		const r = parseSample([...numbers(10), 'n/a', '1,2', '4'].join('\n'));
		expect(r.error).toBeNull();
		expect(r.data.length).toBe(11);
		expect(r.invalidCount).toBe(2);
		expect(r.invalid).toEqual([
			{ line: 11, text: 'n/a' },
			{ line: 12, text: '1,2' }
		]);
	});

	it('refuses several columns of numbers', () => {
		const text = Array.from({ length: 20 }, (_, i) => `${i};${i * 2}`).join('\n');
		expect(parseSample(text).error).toBe('Expected one column of numbers.');
	});

	it('refuses too few or too many rows', () => {
		expect(parseSample(numbers(5).join('\n')).error).toBe('Add at least 10 numbers.');
		const r = parseSample(numbers(MAX_ROWS + 1).join('\n'));
		expect(r.error).toMatch(/^At most 100,000 rows/);
		expect(r.data.length).toBe(0);
	});

	it('rejects partial numbers like 1.2.3 or 12abc', () => {
		const r = parseSample([...numbers(10), '1.2.3', '12abc', 'Infinity'].join('\n'));
		expect(r.invalidCount).toBe(3);
	});
});

describe('sampleCsv', () => {
	it('round-trips through parseSample', () => {
		const data = Float64Array.from({ length: 15 }, (_, i) => Math.sin(i) * 1e-3);
		const r = parseSample(sampleCsv(data));
		expect(r.header).toBe(true);
		expect(Array.from(r.data)).toEqual(Array.from(data));
	});
});
