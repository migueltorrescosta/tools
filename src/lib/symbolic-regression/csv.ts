/** A hand-written RFC 4180 CSV parser with delimiter auto-detection. */

export type Delimiter = ',' | ';' | '\t';

export interface ParsedCsv {
	header: string[];
	rows: string[][];
}

const DELIMITERS: readonly Delimiter[] = [',', ';', '\t'];
const QUOTE = 34;
const CR = 13;
const LF = 10;

function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Guess the delimiter from the first lines, ignoring characters inside quotes.
 * Prefers a delimiter that appears the same (non-zero) number of times on every
 * sampled line; otherwise the most frequent one; `,` when none appears.
 */
export function detectDelimiter(text: string, sampleLines = 10): Delimiter {
	text = stripBom(text);
	const counts: number[][] = [];
	let line = [0, 0, 0];
	let inQuotes = false;
	for (let i = 0; i < text.length && counts.length < sampleLines; i++) {
		const c = text[i];
		if (c === '"') inQuotes = !inQuotes;
		else if (inQuotes) continue;
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			counts.push(line);
			line = [0, 0, 0];
		} else {
			const d = DELIMITERS.indexOf(c as Delimiter);
			if (d >= 0) line[d]++;
		}
	}
	if (line.some((n) => n > 0)) counts.push(line);
	if (counts.length === 0) return ',';

	let best: Delimiter = ',';
	let bestScore = 0;
	let bestConsistent = false;
	DELIMITERS.forEach((delim, d) => {
		const first = counts[0][d];
		const consistent = first > 0 && counts.every((c) => c[d] === first);
		const score = counts.reduce((s, c) => s + c[d], 0);
		if (score === 0) return;
		if ((consistent && !bestConsistent) || (consistent === bestConsistent && score > bestScore)) {
			best = delim;
			bestScore = score;
			bestConsistent = consistent;
		}
	});
	return best;
}

/**
 * Parse CSV text (RFC 4180): quoted fields, `""` escapes, delimiters and line
 * breaks inside quotes, CRLF or LF. The first record is the header; blank
 * lines are skipped; rows are padded with `''` or truncated to the header length.
 */
export function parseCsv(text: string, delimiter?: Delimiter): ParsedCsv {
	text = stripBom(text);
	const delim = (delimiter ?? detectDelimiter(text)).charCodeAt(0);
	const records: string[][] = [];
	const n = text.length;
	let record: string[] = [];
	let i = 0;

	const endRecord = () => {
		// A line holding only an empty, unquoted field is blank: skip it.
		if (!(record.length === 1 && record[0] === '')) records.push(record);
		record = [];
	};

	while (i < n) {
		let field: string;
		if (text.charCodeAt(i) === QUOTE) {
			// Quoted field: read until a lone closing quote.
			let value = '';
			let start = ++i;
			for (;;) {
				const q = text.indexOf('"', i);
				if (q < 0) {
					value += text.slice(start);
					i = n;
					break;
				}
				if (text.charCodeAt(q + 1) === QUOTE) {
					value += text.slice(start, q + 1);
					i = start = q + 2;
				} else {
					value += text.slice(start, q);
					i = q + 1;
					break;
				}
			}
			// Tolerate stray characters between the closing quote and the delimiter.
			const rest = i;
			while (i < n) {
				const c = text.charCodeAt(i);
				if (c === delim || c === LF || c === CR) break;
				i++;
			}
			field = rest < i ? value + text.slice(rest, i) : value;
		} else {
			const start = i;
			while (i < n) {
				const c = text.charCodeAt(i);
				if (c === delim || c === LF || c === CR) break;
				i++;
			}
			field = text.slice(start, i);
		}
		record.push(field);

		if (i >= n) break;
		const c = text.charCodeAt(i);
		if (c === delim) {
			i++;
			if (i >= n) record.push('');
		} else {
			i += c === CR && text.charCodeAt(i + 1) === LF ? 2 : 1;
			endRecord();
		}
	}
	if (record.length > 0) endRecord();

	const header = records.length > 0 ? records[0] : [];
	const width = header.length;
	const rows = records.slice(1);
	for (let r = 0; r < rows.length; r++) {
		const row = rows[r];
		if (row.length > width) row.length = width;
		else while (row.length < width) row.push('');
	}
	return { header, rows };
}
