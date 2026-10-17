/** Turn a parsed CSV into numeric columns and a seeded train/validation split. */

import type { ParsedCsv } from './csv';
import { Prng } from './prng';
import type { Dataset, PreparedData } from './types';

export interface ColumnInfo {
	name: string;
	index: number;
	/** True when most non-empty values parse as finite numbers. */
	numeric: boolean;
}

export interface BuiltDataset {
	inputNames: string[];
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

export function analyzeColumns(parsed: ParsedCsv): ColumnInfo[] {
	return parsed.header.map((name, index) => {
		let nonEmpty = 0;
		let numbers = 0;
		for (const row of parsed.rows) {
			const v = row[index];
			if (v === undefined || v.trim() === '') continue;
			nonEmpty++;
			if (Number.isFinite(parseNumber(v))) numbers++;
		}
		return { name, index, numeric: nonEmpty > 0 && numbers * 2 > nonEmpty };
	});
}

/** Every numeric column except the target. */
export function defaultInputs(columns: ColumnInfo[], targetIndex: number): number[] {
	return columns.filter((c) => c.numeric && c.index !== targetIndex).map((c) => c.index);
}

export function buildDataset(
	parsed: ParsedCsv,
	targetIndex: number,
	inputIndices: number[]
): BuiltDataset {
	const totalRows = parsed.rows.length;
	const x = inputIndices.map(() => new Float64Array(totalRows));
	const y = new Float64Array(totalRows);
	const values = new Float64Array(inputIndices.length);
	let kept = 0;
	rows: for (const row of parsed.rows) {
		const t = parseNumber(row[targetIndex] ?? '');
		if (!Number.isFinite(t)) continue;
		for (let j = 0; j < inputIndices.length; j++) {
			const v = parseNumber(row[inputIndices[j]] ?? '');
			if (!Number.isFinite(v)) continue rows;
			values[j] = v;
		}
		for (let j = 0; j < inputIndices.length; j++) x[j][kept] = values[j];
		y[kept] = t;
		kept++;
	}
	return {
		inputNames: inputIndices.map((i) => parsed.header[i]),
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
		targetName: built.targetName,
		train: pick(built.data, order.slice(nVal).sort(byIndex)),
		validation: pick(built.data, order.slice(0, nVal).sort(byIndex))
	};
}
