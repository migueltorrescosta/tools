import { describe, it, expect } from 'vitest';
import { detectDelimiter, parseCsv, type Delimiter } from './csv';

describe('detectDelimiter', () => {
	it.each([
		[',', 'a,b,c\n1,2,3\n'],
		[';', 'a;b;c\n1,5;2,5;3\n'],
		['\t', 'a\tb\tc\n1\t2\t3\n']
	] as const)('detects %j', (expected, text) => {
		expect(detectDelimiter(text)).toBe(expected);
	});

	it('ignores delimiters inside quotes', () => {
		expect(detectDelimiter('"a,b,c";d\n"1,2,3";4\n')).toBe(';');
		expect(detectDelimiter('"x;y;z",w\n"p;q;r",s\n')).toBe(',');
	});

	it('handles a quoted newline inside the sample', () => {
		expect(detectDelimiter('a;b\n"multi\nline, with, commas";2\n3;4\n')).toBe(';');
	});

	it('falls back to a comma for a single column', () => {
		expect(detectDelimiter('a\n1\n2\n')).toBe(',');
		expect(detectDelimiter('')).toBe(',');
	});

	it('ignores a BOM', () => {
		expect(detectDelimiter('\ufeffa\tb\n1\t2')).toBe('\t');
	});
});

describe('parseCsv', () => {
	it.each([[','], [';'], ['\t']] as [Delimiter][])('parses a simple table with %j', (d) => {
		const text =
			['x', 'y', 'z'].join(d) + '\n' + ['1', '2', '3'].join(d) + '\n4' + d + '5' + d + '6';
		expect(parseCsv(text)).toEqual({
			header: ['x', 'y', 'z'],
			rows: [
				['1', '2', '3'],
				['4', '5', '6']
			]
		});
		expect(parseCsv(text, d).rows).toHaveLength(2);
	});

	it('handles quoted fields with embedded delimiters, quotes and newlines', () => {
		const text = 'name,note\n"Smith, J.","said ""hi""\nthen left"\nplain,"x"\n';
		expect(parseCsv(text)).toEqual({
			header: ['name', 'note'],
			rows: [
				['Smith, J.', 'said "hi"\nthen left'],
				['plain', 'x']
			]
		});
	});

	it('handles CRLF line endings, including inside quotes', () => {
		const text = 'a,b\r\n1,"two\r\nlines"\r\n3,4\r\n';
		expect(parseCsv(text).rows).toEqual([
			['1', 'two\r\nlines'],
			['3', '4']
		]);
	});

	it('treats a trailing newline as no extra row and skips blank lines', () => {
		expect(parseCsv('a,b\n1,2\n').rows).toEqual([['1', '2']]);
		expect(parseCsv('a,b\n1,2\n\n3,4\n\n').rows).toEqual([
			['1', '2'],
			['3', '4']
		]);
	});

	it('strips a BOM from the header', () => {
		expect(parseCsv('\ufeffa,b\n1,2').header).toEqual(['a', 'b']);
	});

	it('pads short rows and truncates long ones to the header length', () => {
		expect(parseCsv('a,b,c\n1\n1,2,3,4\n').rows).toEqual([
			['1', '', ''],
			['1', '2', '3']
		]);
	});

	it('keeps empty fields, including a trailing one', () => {
		expect(parseCsv('a,b,c\n,,\n1,,3\n1,2,').rows).toEqual([
			['', '', ''],
			['1', '', '3'],
			['1', '2', '']
		]);
	});

	it('uses an explicit delimiter over detection', () => {
		expect(parseCsv('a;b,c\n1;2,3', ',').header).toEqual(['a;b', 'c']);
	});

	it('returns empty header and rows for empty input', () => {
		expect(parseCsv('')).toEqual({ header: [], rows: [] });
	});

	it('accepts an unterminated quoted field', () => {
		expect(parseCsv('a,b\n1,"open').rows).toEqual([['1', 'open']]);
	});

	it('parses 50,000 rows × 20 columns quickly', () => {
		const cols = 20;
		const nRows = 50_000;
		const lines = [Array.from({ length: cols }, (_, j) => `c${j}`).join(',')];
		for (let i = 0; i < nRows; i++) {
			const row: string[] = [];
			for (let j = 0; j < cols; j++) row.push(((i * 31 + j * 7) % 1000) / 7 + '');
			lines.push(row.join(','));
		}
		const text = lines.join('\n') + '\n';
		const t0 = performance.now();
		const parsed = parseCsv(text);
		const ms = performance.now() - t0;
		expect(parsed.header).toHaveLength(cols);
		expect(parsed.rows).toHaveLength(nRows);
		expect(parsed.rows[nRows - 1]).toHaveLength(cols);
		expect(Number(parsed.rows[123][4])).toBeCloseTo(((123 * 31 + 4 * 7) % 1000) / 7, 10);
		expect(ms).toBeLessThan(3000);
	});
});
