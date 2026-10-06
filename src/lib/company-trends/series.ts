export type Quality = 'reported' | 'estimated' | 'interpolated';

export interface CompanyPoint {
	/** Quarter label in the form `YYYYQn`, e.g. `2005Q3`. */
	quarter: string;
	/** EUR millions. */
	revenue: number;
	/** EUR millions; negative for operating losses. */
	operatingIncome: number;
	quality: Quality;
	/** Provenance for reported/estimated points (report, filing, press estimate). */
	source?: string;
}

const QUARTER_RE = /^(\d{4})Q([1-4])$/;
const BASE_YEAR = 2000;

export function isQuarterLabel(value: unknown): boolean {
	return typeof value === 'string' && QUARTER_RE.test(value);
}

/** Absolute quarter index with `2000Q1` = 0. Throws on malformed or pre-2000 labels. */
export function quarterIndex(quarter: string): number {
	const match = QUARTER_RE.exec(quarter);
	if (!match) throw new Error(`Malformed quarter label '${quarter}'`);
	const year = Number(match[1]);
	if (year < BASE_YEAR) throw new Error(`Quarter before ${BASE_YEAR}: '${quarter}'`);
	return (year - BASE_YEAR) * 4 + Number(match[2]) - 1;
}

/** Inverse of {@link quarterIndex}. */
export function quarterLabel(index: number): string {
	if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid quarter index ${index}`);
	return `${BASE_YEAR + Math.floor(index / 4)}Q${(index % 4) + 1}`;
}

/** Inclusive list of quarter labels from `start` to `end`; empty when `start` > `end`. */
export function quarterRange(start: string, end: string): string[] {
	const from = quarterIndex(start);
	const to = quarterIndex(end);
	const quarters: string[] = [];
	for (let i = from; i <= to; i++) quarters.push(quarterLabel(i));
	return quarters;
}

/** Linear interpolation in log space; falls back to plain linear when an endpoint is not positive. */
export function logInterp(a: number, b: number, t: number): number {
	if (t === 0) return a;
	if (t === 1) return b;
	if (a > 0 && b > 0) return Math.exp(Math.log(a) + t * (Math.log(b) - Math.log(a)));
	return a + (b - a) * t;
}

/** Expenses are uniformly derived: revenue minus operating income. */
export function deriveExpenses(revenue: number, operatingIncome: number): number {
	return revenue - operatingIncome;
}

/**
 * Densify sparse anchor points onto the quarter grid.
 *
 * Every grid quarter between the first and last anchor is filled by
 * interpolating revenue and expenses in log space; filled points get quality
 * `'interpolated'` and no source. Anchors keep their values, quality and
 * source. No extrapolation happens outside the anchor span.
 */
export function interpolateSeries(
	points: readonly CompanyPoint[],
	quarters: readonly string[]
): CompanyPoint[] {
	if (points.length === 0) return [];
	const anchors = [...points].sort((a, b) => quarterIndex(a.quarter) - quarterIndex(b.quarter));
	const firstIndex = quarterIndex(anchors[0].quarter);
	const lastIndex = quarterIndex(anchors[anchors.length - 1].quarter);

	const out: CompanyPoint[] = [];
	for (const quarter of quarters) {
		const qi = quarterIndex(quarter);
		if (qi < firstIndex || qi > lastIndex) continue;

		const exact = anchors.find((anchor) => anchor.quarter === quarter);
		if (exact) {
			out.push(exact);
			continue;
		}

		let lo = 0;
		while (quarterIndex(anchors[lo + 1].quarter) < qi) lo++;
		const a = anchors[lo];
		const b = anchors[lo + 1];
		const span = quarterIndex(b.quarter) - quarterIndex(a.quarter);
		const t = (qi - quarterIndex(a.quarter)) / span;

		const revenue = logInterp(a.revenue, b.revenue, t);
		const expenses = logInterp(
			deriveExpenses(a.revenue, a.operatingIncome),
			deriveExpenses(b.revenue, b.operatingIncome),
			t
		);
		out.push({
			quarter,
			revenue,
			operatingIncome: revenue - expenses,
			quality: 'interpolated'
		});
	}
	return out;
}
