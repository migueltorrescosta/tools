/**
 * Scenario export as RFC 4180 CSV, with babslell's `simulation.parquet` columns:
 * random inputs, decision-independent intermediates, each decision's reward and
 * opportunity loss, and the optimal reward. No DOM imports.
 */
import type { Scenarios } from './types';

/** babslell's `OPPORTUNITY_LOSS_SUFFIX`. */
export const OPPORTUNITY_LOSS_SUFFIX = ' Opportunity Loss';
export const OPTIMAL_REWARD = 'Optimal Reward';

/** Quote a field when it holds a comma, quote, CR or LF (RFC 4180). */
export function csvField(text: string): string {
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvOptions {
	/** Header per input or intermediate symbol (e.g. its display name); the symbol when absent or empty. */
	names?: ReadonlyMap<string, string>;
	/** Rows per yielded chunk. */
	chunkRows?: number;
}

/** Header cells, in column order. */
export function csvHeader(s: Scenarios, names?: ReadonlyMap<string, string>): string[] {
	const named = ({ symbol }: { symbol: string }) => names?.get(symbol) || symbol;
	return [
		...s.inputs.map(named),
		...s.intermediates.map(named),
		...s.decisions,
		...s.decisions.map((d) => d + OPPORTUNITY_LOSS_SUFFIX),
		OPTIMAL_REWARD
	];
}

/**
 * The CSV as chunks of whole lines (CRLF-terminated, header first), so a
 * million rows never build one string: `new Blob([...scenariosCsv(s)])`.
 * Numbers print with `String(x)`, which round-trips exactly.
 */
export function* scenariosCsv(s: Scenarios, options: CsvOptions = {}): Generator<string> {
	const { names, chunkRows = 10_000 } = options;
	yield csvHeader(s, names).map(csvField).join(',') + '\r\n';
	const columns = [...s.inputs.map((c) => c.column), ...s.intermediates.map((c) => c.column)];
	const { rewards, optimal } = s;
	const row: string[] = [];
	for (let start = 0; start < s.n; start += chunkRows) {
		const end = Math.min(start + chunkRows, s.n);
		const lines: string[] = [];
		for (let i = start; i < end; i++) {
			row.length = 0;
			for (const c of columns) row.push(String(c[i]));
			for (const r of rewards) row.push(String(r[i]));
			for (const r of rewards) row.push(String(optimal[i] - r[i]));
			row.push(String(optimal[i]));
			lines.push(row.join(','));
		}
		yield lines.join('\r\n') + '\r\n';
	}
}
