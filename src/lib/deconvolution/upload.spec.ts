import { describe, expect, it } from 'vitest';
import { MAX_ROWS, columnsCsv, parseSample, sampleCsv, sampleCsv2 } from './upload';

const numbers = (n: number) => Array.from({ length: n }, (_, i) => String(i / 10));

describe('parseSample', () => {
	it('reads one column and skips a header', () => {
		const r = parseSample(['height', ...numbers(12)].join('\n'));
		expect(r.error).toBeNull();
		expect(r.header).toBe(true);
		expect(r.dim).toBe(1);
		expect(Array.from(r.data)).toEqual(numbers(12).map(Number));
		expect(r.data2.length).toBe(0);
	});

	it('accepts CRLF, blank lines, signs and exponents', () => {
		const r = parseSample(['-1', '+2.5', '', '3e-2', '.5', ...numbers(8)].join('\r\n'));
		expect(r.error).toBeNull();
		expect(r.dim).toBe(1);
		expect(Array.from(r.data.slice(0, 4))).toEqual([-1, 2.5, 0.03, 0.5]);
	});

	it('reports lines without a single number, by line number', () => {
		const r = parseSample([...numbers(10), 'n/a', '1,2', '4'].join('\n'));
		expect(r.error).toBeNull();
		expect(r.dim).toBe(1);
		expect(r.data.length).toBe(11);
		expect(r.invalidCount).toBe(2);
		expect(r.invalid).toEqual([
			{ line: 11, text: 'n/a' },
			{ line: 12, text: '1,2' }
		]);
	});

	it('accepts two columns of numbers', () => {
		const text = Array.from({ length: 20 }, (_, i) => `${i};${i * 2}`).join('\n');
		const r = parseSample(text);
		expect(r.error).toBeNull();
		expect(r.dim).toBe(2);
		expect(r.data.length).toBe(20);
		expect(r.data2.length).toBe(20);
		expect(Array.from(r.data)).toEqual(Array.from({ length: 20 }, (_, i) => i));
		expect(Array.from(r.data2)).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
	});

	it('reads three to five columns for the noise regimes to interpret', () => {
		const text = Array.from({ length: 20 }, (_, i) => `${i};${i * 2};${i * 3}`).join('\n');
		const r = parseSample(text);
		expect(r.error).toBeNull();
		expect(r.width).toBe(3);
		expect(Array.from(r.columns[2].slice(0, 3))).toEqual([0, 3, 6]);
	});

	it('rejects six columns of numbers', () => {
		const text = Array.from({ length: 20 }, (_, i) =>
			[1, 2, 3, 4, 5, 6].map((k) => i * k).join(',')
		).join('\n');
		expect(parseSample(text).error).toBe('Expected one to 5 columns of numbers.');
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

	it('reads two columns with a header', () => {
		const r = parseSample(
			['x,y', '1,2', '3,4', '5,6', '7,8', '9,10', '11,12', '13,14', '15,16', '17,18', '19,20'].join(
				'\n'
			)
		);
		expect(r.error).toBeNull();
		expect(r.header).toBe(true);
		expect(r.dim).toBe(2);
		expect(r.data.length).toBe(10);
		expect(r.data2.length).toBe(10);
	});

	it('mixed 1- and 2-field rows: minority reported invalid', () => {
		// Majority 2-field rows
		const text = [
			'1,2',
			'3,4',
			'5',
			'7,8',
			'9,10',
			'11,12',
			'13,14',
			'15,16',
			'17,18',
			'19,20',
			'21,22'
		].join('\n');
		const r = parseSample(text);
		expect(r.error).toBeNull();
		expect(r.dim).toBe(2);
		expect(r.data.length).toBe(10);
		expect(r.data2.length).toBe(10);
		expect(r.invalidCount).toBe(1);
		expect(r.invalid[0].text).toBe('5');
	});

	it('mixed 1- and 2-field rows: majority 1-field', () => {
		const text = ['1', '2', '3,4', '5', '6', '7', '8', '9', '10', '11', '12'].join('\n');
		const r = parseSample(text);
		expect(r.error).toBeNull();
		expect(r.dim).toBe(1);
		expect(r.data.length).toBe(10);
		expect(r.invalidCount).toBe(1);
		expect(r.invalid[0].text).toBe('3,4');
	});

	it('sampleCsv2 round-trips through parseSample', () => {
		const x = Float64Array.from({ length: 15 }, (_, i) => Math.sin(i) * 1e-3);
		const y = Float64Array.from({ length: 15 }, (_, i) => Math.cos(i) * 1e-3);
		const r = parseSample(sampleCsv2(x, y));
		expect(r.header).toBe(true);
		expect(r.dim).toBe(2);
		expect(Array.from(r.data)).toEqual(Array.from(x));
		expect(Array.from(r.data2)).toEqual(Array.from(y));
	});
});

describe('sampleCsv', () => {
	it('round-trips through parseSample', () => {
		const data = Float64Array.from({ length: 15 }, (_, i) => Math.sin(i) * 1e-3);
		const r = parseSample(sampleCsv(data));
		expect(r.header).toBe(true);
		expect(r.dim).toBe(1);
		expect(Array.from(r.data)).toEqual(Array.from(data));
	});
});

describe('sampleCsv2', () => {
	it('produces header and data lines', () => {
		const x = new Float64Array([1, 2, 3]);
		const y = new Float64Array([4, 5, 6]);
		const csv = sampleCsv2(x, y);
		expect(csv).toBe('x,y\n1,4\n2,5\n3,6\n');
	});

	it('truncates to shorter array', () => {
		const x = new Float64Array([1, 2, 3, 4]);
		const y = new Float64Array([5, 6]);
		const csv = sampleCsv2(x, y);
		expect(csv).toBe('x,y\n1,5\n2,6\n');
	});
});

describe('columnsCsv', () => {
	it('round-trips per-point errors and replicates through parseSample', () => {
		const z = Float64Array.from({ length: 20 }, (_, i) => i / 3);
		const s = Float64Array.from({ length: 20 }, (_, i) => 0.1 + i / 100);
		const r = parseSample(columnsCsv(['z1', 'z2', 'z3'], [z, s, z]));
		expect(r.header).toBe(true);
		expect(r.width).toBe(3);
		expect(Array.from(r.columns[1])).toEqual(Array.from(s));
	});
});
