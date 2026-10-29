/**
 * Parsing an uploaded or pasted sample of Z (one to five numeric columns), and the
 * CSV export of a simulated sample. No DOM or Svelte imports.
 */

/** Most rows an upload may hold. */
export const MAX_ROWS = 100_000;
/** Most columns: z with errors or replicates (1D), or x, y, σx, σy, ρ (2D). */
export const MAX_COLUMNS = 5;
/** Problem rows listed by line number; the rest are only counted. */
const LISTED = 5;

export interface ParsedSample {
	/** 1 or 2: the dimension when the columns are plain data (2 for two columns). */
	dim: 1 | 2;
	/** The number of numeric columns, 1–5; the noise regime says what they are. */
	width: number;
	/** Every column, each with one entry per valid row. */
	columns: Float64Array[];
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
 * One to five numeric columns, an optional header line, any common delimiter.
 * The width is that of most all-numeric rows; other rows are listed as invalid.
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
	const widths = new Array<number>(MAX_COLUMNS + 1).fill(0);
	for (const r of rows) if (r.numeric) widths[Math.min(r.f.length, MAX_COLUMNS + 1) - 1]++;
	const header = rows.length > 0 && !rows[0].f.some((x) => Number.isFinite(asNumber(x)));
	// The most common width; ties go to the narrower.
	const width = widths.indexOf(Math.max(...widths)) + 1;
	const dim: 1 | 2 = width === 2 ? 2 : 1;
	const cols: number[][] = Array.from({ length: Math.min(width, MAX_COLUMNS) }, () => []);
	const invalid: { line: number; text: string }[] = [];
	let invalidCount = 0;
	rows.forEach((r, k) => {
		if (r.numeric && r.f.length === width) {
			cols.forEach((c, j) => c.push(r.v[j]));
		} else if (!(k === 0 && header)) {
			invalidCount++;
			if (invalid.length < LISTED) invalid.push({ line: r.line, text: r.raw.trim().slice(0, 40) });
		}
	});
	const columns = cols.map((c) => Float64Array.from(c));
	const empty = new Float64Array(0);
	const result = (error: string | null): ParsedSample => ({
		dim,
		width,
		columns: error ? [] : columns,
		data: error ? empty : (columns[0] ?? empty),
		data2: error || dim === 1 ? empty : columns[1],
		header,
		invalid,
		invalidCount,
		error
	});
	const rowCount = columns[0]?.length ?? 0;
	if (width > MAX_COLUMNS) return result(`Expected one to ${MAX_COLUMNS} columns of numbers.`);
	if (rowCount > MAX_ROWS)
		return result(
			`At most ${MAX_ROWS.toLocaleString('en')} rows; this has ${rowCount.toLocaleString('en')}.`
		);
	if (rowCount < 10) return result('Add at least 10 numbers.');
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
