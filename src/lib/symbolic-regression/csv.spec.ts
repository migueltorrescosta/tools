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

describe('detectDelimiter consistency preference', () => {
	// Kills the consistency mutants: a ';' on every line beats a more frequent but uneven ','.
	it('prefers a consistent ; over a more frequent, uneven , (decimal commas)', () => {
		const text = 'a;b;c\n1,5;2,25;3,125\n4,5;5,25;6,125\n';
		expect(detectDelimiter(text)).toBe(';');
		const parsed = parseCsv(text);
		expect(parsed.header).toEqual(['a', 'b', 'c']);
		expect(parsed.rows[0]).toEqual(['1,5', '2,25', '3,125']);
	});

	it('keeps the first delimiter on a consistent tie', () => {
		expect(detectDelimiter('a,b;c\n1,2;3\n4,5;6\n')).toBe(',');
	});

	it('takes the higher total among consistent delimiters', () => {
		expect(detectDelimiter('a\tb\tc,d\n1\t2\t3,4\n')).toBe('\t');
	});

	it('takes the higher total when none is consistent', () => {
		expect(detectDelimiter('a,b,c,d\n1;2\n3;4;5;6;7\n')).toBe(';');
	});

	it('does not let a later uneven delimiter with a higher total beat a consistent one', () => {
		expect(detectDelimiter('a,b\n1,2\n3,4\n5;6;7;8;9\n')).toBe(';');
	});

	it('replaces an earlier uneven delimiter by a later consistent one', () => {
		expect(detectDelimiter('a;b,c,d\n1;2,3\n4;5\n')).toBe(';');
	});

	it('ignores delimiters inside quotes and counts CRLF and lone CR as one line break each', () => {
		expect(detectDelimiter('"a,b,c,d";e\r\n"1,2,3,4";5\r\n')).toBe(';');
		expect(detectDelimiter('a;b;c,d\r1;2;3,4\r')).toBe(';');
		expect(detectDelimiter('a;b;c,d\r\n1;2;3,4\r\n')).toBe(';');
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

	it('parses 50,000 rows × 20 columns', () => {
		const cols = 20;
		const nRows = 50_000;
		const lines = [Array.from({ length: cols }, (_, j) => `c${j}`).join(',')];
		for (let i = 0; i < nRows; i++) {
			const row: string[] = [];
			for (let j = 0; j < cols; j++) row.push(((i * 31 + j * 7) % 1000) / 7 + '');
			lines.push(row.join(','));
		}
		const text = lines.join('\n') + '\n';
		const parsed = parseCsv(text);
		expect(parsed.header).toHaveLength(cols);
		expect(parsed.rows).toHaveLength(nRows);
		expect(parsed.rows[nRows - 1]).toHaveLength(cols);
		expect(Number(parsed.rows[123][4])).toBeCloseTo(((123 * 31 + 4 * 7) % 1000) / 7, 10);
		// Last row (i = 49999), last column (j = 19): ((49999*31 + 19*7) % 1000) / 7 = 102/7
		expect(parsed.rows[nRows - 1][19]).toBe('14.571428571428571');
	});
});
