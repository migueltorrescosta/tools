import { score, summarise, type Score } from './score.js';
import type { InputKind, Run } from './types.js';

export interface ScoredRun {
	run: Run;
	score: Score;
}

/** Score every run once; runs that cannot be scored (aborted) are dropped. */
export function scoreAll(runs: readonly Run[]): ScoredRun[] {
	return runs.flatMap((run) => {
		const s = score(run.responses, run.firstFocal);
		return s ? [{ run, score: s }] : [];
	});
}

export interface DotRow {
	key: string;
	comparisonId: string;
	label: string;
	input: InputKind;
	runs: ScoredRun[];
	/** Mean of the unflagged runs, with a 95% CI from 3 of them. */
	mean?: number;
	ci?: [number, number];
}

const pairLabel = (pair: readonly [string, string]) => `${pair[0]} / ${pair[1]}`;

/**
 * One row per comparison and input, most recent first. Keyboard and touch never share a
 * row: touch adds latency, so its scores are not comparable.
 */
export function dotRows(scored: readonly ScoredRun[]): DotRow[] {
	const rows = new Map<string, DotRow>();
	for (const s of [...scored].reverse()) {
		const { run } = s;
		const key = `${run.comparisonId}:${run.input}`;
		let row = rows.get(key);
		if (!row) {
			row = {
				key,
				comparisonId: run.comparisonId,
				label: `${pairLabel(run.labels.targets)} × ${pairLabel(run.labels.attributes)}`,
				input: run.input,
				runs: []
			};
			rows.set(key, row);
		}
		row.runs.push(s);
	}
	for (const row of rows.values()) {
		const valid = row.runs.filter((s) => !s.score.flagged).map((s) => s.score.d);
		if (valid.length) Object.assign(row, summarise(valid));
	}
	return [...rows.values()];
}

export interface HeatMap {
	rows: string[];
	columns: string[];
	/** cells[row][column]: mean D of unflagged runs and their count, when there are any. */
	cells: ({ mean: number; n: number } | undefined)[][];
}

/** Target pairs × attribute pairs, each cell the mean D over unflagged runs (all inputs). */
export function heatMap(scored: readonly ScoredRun[]): HeatMap {
	const valid = scored.filter((s) => !s.score.flagged);
	const rows = [...new Set(valid.map((s) => pairLabel(s.run.labels.targets)))];
	const columns = [...new Set(valid.map((s) => pairLabel(s.run.labels.attributes)))];
	const cells = rows.map((r) =>
		columns.map((c) => {
			const ds = valid
				.filter(
					(s) => pairLabel(s.run.labels.targets) === r && pairLabel(s.run.labels.attributes) === c
				)
				.map((s) => s.score.d);
			return ds.length
				? { mean: ds.reduce((a, b) => a + b, 0) / ds.length, n: ds.length }
				: undefined;
		})
	);
	return { rows, columns, cells };
}
