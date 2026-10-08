export type Currency = 'EUR' | 'USD' | 'GBP';

/** ECB reference rates: foreign currency units per 1 EUR, keyed by quarter label. */
export type FxRate = Partial<Record<Exclude<Currency, 'EUR'>, number>>;

export interface FxTable {
	base: 'EUR';
	rates: Record<string, FxRate>;
}

// Quarter arithmetic relative to 2000Q1; negative for 1999, whose rates the
// fiscal years ending in early 2000 average over.
function quarterIndex(label: string): number {
	const m = /^(\d{4})Q([1-4])$/.exec(label);
	if (!m) throw new Error(`Invalid quarter label: ${label}`);
	return (Number(m[1]) - 2000) * 4 + Number(m[2]) - 1;
}

function quarterLabel(index: number): string {
	return `${2000 + Math.floor(index / 4)}Q${(((index % 4) + 4) % 4) + 1}`;
}

/** Number of quarters a fiscal-year (trailing-twelve-month) rate averages over. */
export const FISCAL_YEAR_QUARTERS = 4;

/**
 * Mean foreign-units-per-EUR rate over the fiscal year ending at `quarter`: the
 * quarterly rates of the four quarters ending there. Throws when any of them is
 * missing rather than averaging fewer, which would misprice fiscal years ending
 * in early 2000 with mostly-1999 trading at 2000 rates. Values are fiscal-year totals, so the build converts filed figures
 * to EUR with this rate and the display must convert back with the same one,
 * otherwise a company shown in its reporting currency would not match its filing.
 */
export function fiscalYearRate(
	quarter: string,
	currency: Exclude<Currency, 'EUR'>,
	fx: FxTable
): number {
	const end = quarterIndex(quarter);
	let sum = 0;
	let count = 0;
	for (let i = end - FISCAL_YEAR_QUARTERS + 1; i <= end; i++) {
		const label = quarterLabel(i);
		const rate = fx.rates[label]?.[currency];
		if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
			throw new Error(`No FX rate for ${currency} at ${label} (fiscal year ending ${quarter})`);
		}
		sum += rate;
		count++;
	}
	return sum / count;
}

/** Convert a fiscal-year amount in `currency` ending at `quarter` into EUR (the dataset base). */
export function convertToEur(
	value: number,
	quarter: string,
	currency: Currency,
	fx: FxTable
): number {
	if (currency === 'EUR') return value;
	return value / fiscalYearRate(quarter, currency, fx);
}

/** Convert a fiscal-year EUR amount ending at `quarter` into a display currency. */
export function convertFromEur(
	value: number,
	quarter: string,
	currency: Currency,
	fx: FxTable
): number {
	if (currency === 'EUR') return value;
	return value * fiscalYearRate(quarter, currency, fx);
}

/** Convert between any two supported currencies at `quarter` (via the EUR pivot). */
export function convert(
	value: number,
	quarter: string,
	from: Currency,
	to: Currency,
	fx: FxTable
): number {
	if (from === to) return value;
	if (to === 'EUR') return convertToEur(value, quarter, from, fx);
	if (from === 'EUR') return convertFromEur(value, quarter, to, fx);
	return convertFromEur(convertToEur(value, quarter, from, fx), quarter, to, fx);
}
