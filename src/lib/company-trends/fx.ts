export type Currency = 'EUR' | 'USD' | 'GBP';

/** ECB reference rates: foreign currency units per 1 EUR, keyed by quarter label. */
export type FxRate = Partial<Record<Exclude<Currency, 'EUR'>, number>>;

export interface FxTable {
	base: 'EUR';
	rates: Record<string, FxRate>;
}

function rateFor(quarter: string, currency: Exclude<Currency, 'EUR'>, fx: FxTable): number {
	const rate = fx.rates[quarter]?.[currency];
	if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
		throw new Error(`No FX rate for ${currency} at ${quarter}`);
	}
	return rate;
}

/** Convert an amount in `currency` at `quarter` into EUR (the dataset base). */
export function convertToEur(
	value: number,
	quarter: string,
	currency: Currency,
	fx: FxTable
): number {
	if (currency === 'EUR') return value;
	return value / rateFor(quarter, currency, fx);
}

/** Convert a EUR amount at `quarter` into a display currency. */
export function convertFromEur(
	value: number,
	quarter: string,
	currency: Currency,
	fx: FxTable
): number {
	if (currency === 'EUR') return value;
	return value * rateFor(quarter, currency, fx);
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
