/** The dataset as a CSV with an equation's predictions added. No DOM imports. */

import type { ParsedCsv } from './csv';
import type { BuiltDataset } from './dataset';

/** `name`, or `name_2`, `name_3`, … when the header already has it. */
function uniqueName(header: string[], name: string): string {
	const taken = new Set(header);
	if (!taken.has(name)) return name;
	let k = 2;
	while (taken.has(`${name}_${k}`)) k++;
	return `${name}_${k}`;
}

/** Quote a field when it holds a comma, a quote or a line break (RFC 4180). */
function field(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Every row and column of `parsed`, in order, plus `{target}_predicted` and
 * `split` (train, validation or dropped). `pred[i]` and `validation` refer to
 * the rows `built` kept; a dropped row gets an empty prediction.
 */
export function predictionsCsv(
	parsed: ParsedCsv,
	built: BuiltDataset,
	pred: Float64Array,
	validation: readonly number[]
): string {
	const n = parsed.rows.length;
	const predicted: string[] = new Array(n).fill('');
	const split: string[] = new Array(n).fill('dropped');
	built.sourceRows.forEach((r, i) => {
		predicted[r] = Number.isFinite(pred[i]) ? String(pred[i]) : '';
		split[r] = 'train';
	});
	for (const i of validation) split[built.sourceRows[i]] = 'validation';
	const predName = uniqueName(parsed.header, `${built.targetName}_predicted`);
	const header = [...parsed.header, predName, uniqueName([...parsed.header, predName], 'split')];
	const lines = [header.map(field).join(',')];
	parsed.rows.forEach((row, r) =>
		lines.push([...row, predicted[r], split[r]].map(field).join(','))
	);
	return lines.join('\n') + '\n';
}
