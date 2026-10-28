/**
 * Parsing an uploaded or pasted sample of Z (one or two numeric columns), and the
 * CSV export of a simulated sample. No DOM or Svelte imports.
 */

/** Most rows an upload may hold. */
export const MAX_ROWS = 100_000;
/** Problem rows listed by line number; the rest are only counted. */
const LISTED = 5;

export interface ParsedSample {
	/** 1 or 2: the number of numeric columns. */
	dim: 1 | 2;
	/** First column. */
	data: Float64Array;
	/** Second column when dim is 2, else an empty array. */
	data2: Float64Array;
	/** True when the first non-empty line was a header and was skipped. */
	header: boolean;
	/** Rows that held no single number, with their 1-based line numbers (first few only). */
	invalid: { line: number; text: string }[];
	invalidCount: number;
	/** Set when the input can't be used at all (no numbers, too many rows, several columns). */
	error: string | null;
}

/** Fields of one line: split on commas, semicolons, tabs or runs of spaces. */
const fields = (line: string) =>
	line
		.trim()
		.split(/\s*[,;\t]\s*|\s+/)
		.filter((f) => f !== '');

const asNumber = (f: string): number =>
	/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(f) ? Number(f) : NaN;

/**
 * One or two numeric columns, an optional header line, any common delimiter.
 * The dimension is the width of most all-numeric rows; other rows are listed as invalid.
 */
export function parseSample(text: string): ParsedSample {
	const rows = text
		.split(/\r\n|\n|\r/)
		.map((raw, i) => {
			const f = fields(raw);
			const v = f.map(asNumber);
			return { line: i + 1, raw, f, v, numeric: f.length > 0 && v.every(Number.isFinite) };
		})
		.filter((r) => r.f.length > 0);
	const widths = [0, 0, 0];
	for (const r of rows) if (r.numeric) widths[Math.min(r.f.length, 3) - 1]++;
	const header = rows.length > 0 && !rows[0].f.some((x) => Number.isFinite(asNumber(x)));
	const dim: 1 | 2 = widths[1] > widths[0] ? 2 : 1;
	const data: number[] = [];
	const data2: number[] = [];
	const invalid: { line: number; text: string }[] = [];
	let invalidCount = 0;
	rows.forEach((r, k) => {
		if (r.numeric && r.f.length === dim) {
			data.push(r.v[0]);
			if (dim === 2) data2.push(r.v[1]);
		} else if (!(k === 0 && header)) {
			invalidCount++;
			if (invalid.length < LISTED) invalid.push({ line: r.line, text: r.raw.trim().slice(0, 40) });
		}
	});
	const result = (error: string | null): ParsedSample => ({
		dim,
		data: error ? new Float64Array(0) : Float64Array.from(data),
		data2: error || dim === 1 ? new Float64Array(0) : Float64Array.from(data2),
		header,
		invalid,
		invalidCount,
		error
	});
	if (widths[2] > widths[0] && widths[2] > widths[1])
		return result('Expected one or two columns of numbers.');
	if (data.length > MAX_ROWS)
		return result(
			`At most ${MAX_ROWS.toLocaleString('en')} rows; this has ${data.length.toLocaleString('en')}.`
		);
	if (data.length < 10) return result('Add at least 10 numbers.');
	return result(null);
}

/** A sample as a one-column CSV with a `z` header. */
export function sampleCsv(data: ArrayLike<number>): string {
	let out = 'z\n';
	for (let i = 0; i < data.length; i++) out += `${data[i]}\n`;
	return out;
}

/** A sample as a two-column CSV with `x,y` header. */
export function sampleCsv2(x: ArrayLike<number>, y: ArrayLike<number>): string {
	let out = 'x,y\n';
	const n = Math.min(x.length, y.length);
	for (let i = 0; i < n; i++) out += `${x[i]},${y[i]}\n`;
	return out;
}
