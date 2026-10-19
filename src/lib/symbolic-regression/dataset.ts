/** Turn a parsed CSV into numeric columns and a seeded train/validation split. */

import type { ParsedCsv } from './csv';
import { Prng } from '$lib/prng';
import { CATEGORY_MAX, type Dataset, type InputMode, type PreparedData } from './types';

/** The level an empty cell of a categorical input falls in. */
export const EMPTY_LEVEL = '(empty)';
/** Counting distinct values stops past this, so huge text columns stay cheap. */
const LEVEL_COUNT_CAP = 1000;

export interface ColumnInfo {
	name: string;
	index: number;
	/** True when most non-empty values parse as finite numbers. */
	numeric: boolean;
	/** Distinct values, an empty cell counting as one; capped just above 1000. */
	levels: number;
}

/** One selected input and whether it is categorical. */
export interface InputChoice {
	index: number;
	categorical: boolean;
}

export interface BuiltDataset {
	inputNames: string[];
	/** Per input: its sorted level names when categorical, else null. */
	levels: (string[] | null)[];
	targetName: string;
	data: Dataset;
	/** Rows dropped for a missing or non-numeric value in a selected column. */
	droppedRows: number;
	totalRows: number;
}

const NUMBER = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\s*$/;

/** Strict number parsing: `1`, `-2.5`, `1e-3`, `.5`, surrounding spaces; NaN otherwise. */
export function parseNumber(value: string): number {
	return NUMBER.test(value) ? Number(value) : NaN;
}

/** A cell as a categorical level: trimmed, empty cells as `EMPTY_LEVEL`. */
export function levelOf(value: string | undefined): string {
	const v = (value ?? '').trim();
	return v === '' ? EMPTY_LEVEL : v;
}

export function analyzeColumns(parsed: ParsedCsv): ColumnInfo[] {
	return parsed.header.map((name, index) => {
		let nonEmpty = 0;
		let numbers = 0;
		const distinct = new Set<string>();
		for (const row of parsed.rows) {
			const v = row[index];
			if (distinct.size <= LEVEL_COUNT_CAP) distinct.add(levelOf(v));
			if (v === undefined || v.trim() === '') continue;
			nonEmpty++;
			if (Number.isFinite(parseNumber(v))) numbers++;
		}
		return {
			name,
			index,
			numeric: nonEmpty > 0 && numbers * 2 > nonEmpty,
			levels: distinct.size
		};
	});
}

/** Whether a column may be categorical: 2 to `CATEGORY_MAX` levels. */
export function canBeCategorical(c: ColumnInfo): boolean {
	return c.levels >= 2 && c.levels <= CATEGORY_MAX;
}

/**
 * The mode of every column (indexed by column): numeric inputs included, text
 * columns categorical when they can be, everything else and the target excluded.
 */
export function defaultModes(columns: ColumnInfo[], targetIndex: number): InputMode[] {
	return columns.map((c) =>
		c.index === targetIndex
			? 'exclude'
			: c.numeric
				? 'include'
				: canBeCategorical(c)
					? 'categorical'
					: 'exclude'
	);
}

/** The selected inputs, in column order, from per-column modes. */
export function inputChoices(modes: InputMode[]): InputChoice[] {
	return modes.flatMap((m, index) =>
		m === 'exclude' ? [] : [{ index, categorical: m === 'categorical' }]
	);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sorted levels of a column, `EMPTY_LEVEL` last. Numeric-looking levels sort by value. */
export function columnLevels(parsed: ParsedCsv, index: number): string[] {
	const set = new Set<string>();
	for (const row of parsed.rows) set.add(levelOf(row[index]));
	const all = [...set];
	const numeric = all.every((l) => l === EMPTY_LEVEL || Number.isFinite(parseNumber(l)));
	return all.sort((a, b) => {
		if (a === EMPTY_LEVEL || b === EMPTY_LEVEL) return a === EMPTY_LEVEL ? 1 : -1;
		return numeric ? parseNumber(a) - parseNumber(b) : collator.compare(a, b);
	});
}

/**
 * Numeric columns for the target and inputs. A categorical input becomes level
 * codes (see `columnLevels`) and never drops a row; a numeric one drops rows
 * with a missing or non-numeric value.
 */
export function buildDataset(
	parsed: ParsedCsv,
	targetIndex: number,
	inputs: InputChoice[]
): BuiltDataset {
	const totalRows = parsed.rows.length;
	const levels = inputs.map((c) => (c.categorical ? columnLevels(parsed, c.index) : null));
	const codes = levels.map((l) => (l ? new Map(l.map((name, k) => [name, k])) : null));
	const x = inputs.map(() => new Float64Array(totalRows));
	const y = new Float64Array(totalRows);
	const values = new Float64Array(inputs.length);
	let kept = 0;
	rows: for (const row of parsed.rows) {
		const t = parseNumber(row[targetIndex] ?? '');
		if (!Number.isFinite(t)) continue;
		for (let j = 0; j < inputs.length; j++) {
			const cell = row[inputs[j].index];
			const code = codes[j];
			const v = code ? code.get(levelOf(cell))! : parseNumber(cell ?? '');
			if (!Number.isFinite(v)) continue rows;
			values[j] = v;
		}
		for (let j = 0; j < inputs.length; j++) x[j][kept] = values[j];
		y[kept] = t;
		kept++;
	}
	return {
		inputNames: inputs.map((c) => parsed.header[c.index]),
		levels,
		targetName: parsed.header[targetIndex],
		data: { x: x.map((col) => col.slice(0, kept)), y: y.slice(0, kept) },
		droppedRows: totalRows - kept,
		totalRows
	};
}

function pick(data: Dataset, indices: number[]): Dataset {
	const take = (col: Float64Array) => Float64Array.from(indices, (i) => col[i]);
	return { x: data.x.map(take), y: take(data.y) };
}

/**
 * Seeded random split. With at least 2 rows each part gets at least 1 row;
 * a single row goes to train. Rows keep their original order within each part.
 */
export function splitDataset(
	built: BuiltDataset,
	validationFraction: number,
	seed: number
): PreparedData {
	const n = built.data.y.length;
	const order = Array.from({ length: n }, (_, i) => i);
	const prng = new Prng(seed);
	for (let i = n - 1; i > 0; i--) {
		const j = prng.int(i + 1);
		[order[i], order[j]] = [order[j], order[i]];
	}
	const nVal = n < 2 ? 0 : Math.min(n - 1, Math.max(1, Math.round(n * validationFraction)));
	const byIndex = (a: number, b: number) => a - b;
	return {
		inputNames: built.inputNames,
		levels: built.levels,
		targetName: built.targetName,
		train: pick(built.data, order.slice(nVal).sort(byIndex)),
		validation: pick(built.data, order.slice(0, nVal).sort(byIndex))
	};
}
