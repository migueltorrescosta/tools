/**
 * Parsing an uploaded or pasted sample of Z (one numeric column), and the
 * CSV export of a simulated sample. No DOM or Svelte imports.
 */

/** Most rows an upload may hold. */
export const MAX_ROWS = 100_000;
/** Problem rows listed by line number; the rest are only counted. */
const LISTED = 5;

export interface ParsedSample {
	data: Float64Array;
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

/** One numeric column, an optional header line, any common delimiter. */
export function parseSample(text: string): ParsedSample {
	const lines = text.split(/\r\n|\n|\r/);
	const values: number[] = [];
	const invalid: { line: number; text: string }[] = [];
	let invalidCount = 0;
	let header = false;
	let seenContent = false;
	let multiColumn = 0;
	for (let i = 0; i < lines.length; i++) {
		const f = fields(lines[i]);
		if (f.length === 0) continue;
		const first = !seenContent;
		seenContent = true;
		const v = f.length === 1 ? asNumber(f[0]) : NaN;
		if (f.length > 1 && f.every((x) => Number.isFinite(asNumber(x)))) multiColumn++;
		if (Number.isFinite(v)) {
			values.push(v);
			continue;
		}
		if (first && f.every((x) => !Number.isFinite(asNumber(x)))) {
			header = true;
			continue;
		}
		invalidCount++;
		if (invalid.length < LISTED) invalid.push({ line: i + 1, text: lines[i].trim().slice(0, 40) });
	}
	const result = (error: string | null): ParsedSample => ({
		data: error ? new Float64Array(0) : Float64Array.from(values),
		header,
		invalid,
		invalidCount,
		error
	});
	if (multiColumn > values.length) return result('Expected one column of numbers.');
	if (values.length > MAX_ROWS)
		return result(
			`At most ${MAX_ROWS.toLocaleString('en')} rows; this has ${values.length.toLocaleString('en')}.`
		);
	if (values.length < 10) return result('Add at least 10 numbers.');
	return result(null);
}

/** A sample as a one-column CSV with a `z` header. */
export function sampleCsv(data: ArrayLike<number>): string {
	let out = 'z\n';
	for (let i = 0; i < data.length; i++) out += `${data[i]}\n`;
	return out;
}
