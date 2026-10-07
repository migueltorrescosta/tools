import type { Currency, FxTable } from './fx';
import { isQuarterLabel, quarterIndex, type CompanyPoint } from './series';

export interface Meta {
	/** ISO date the dataset was last generated. */
	generated: string;
	/** Unit of all monetary values, e.g. `EUR millions`. */
	units: string;
	/** How FX conversion was applied when normalizing to EUR. */
	fxMethodology: string;
	/** Source URL for the FX rates (ECB). */
	fxSource: string;
}

export interface Company {
	id: string;
	name: string;
	/** Industry type used by the UI filter, e.g. `software`. */
	type: string;
	/** Native reporting currency of the company (points are always EUR). */
	reportingCurrency: Currency;
	country: string;
	/** Definitions used for this company (e.g. which line counts as operating income). */
	notes?: string;
	/** Quarterly points in strictly ascending quarter order, EUR-normalized. */
	points: CompanyPoint[];
}

export interface Dataset {
	meta: Meta;
	fx: FxTable;
	companies: Company[];
}

const META_KEYS = ['generated', 'units', 'fxMethodology', 'fxSource'] as const;

/**
 * Validate an untrusted dataset (e.g. hand-edited `companies.json`).
 * Returns a list of human-readable errors; an empty list means valid.
 */
export function validateDataset(data: unknown): string[] {
	const errors: string[] = [];
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return ['dataset: must be an object'];
	}
	const d = data as Record<string, unknown>;

	const meta = d['meta'];
	if (typeof meta !== 'object' || meta === null) {
		errors.push('meta: must be an object');
	} else {
		const m = meta as Record<string, unknown>;
		for (const key of META_KEYS) {
			const value = m[key];
			if (typeof value !== 'string' || value.trim() === '') {
				errors.push(`meta.${key}: must be a non-empty string`);
			}
		}
		const source = m['fxSource'];
		if (typeof source === 'string' && source !== '' && !/^https?:\/\//.test(source)) {
			errors.push('meta.fxSource: must be an http(s) URL');
		}
	}

	let fxRates: Record<string, unknown> = {};
	const fx = d['fx'];
	if (typeof fx !== 'object' || fx === null) {
		errors.push('fx: must be an object');
	} else {
		const f = fx as Record<string, unknown>;
		if (f['base'] !== 'EUR') errors.push("fx.base: must be 'EUR'");
		const rates = f['rates'];
		if (typeof rates !== 'object' || rates === null) {
			errors.push('fx.rates: must be an object');
		} else {
			fxRates = rates as Record<string, unknown>;
			for (const [quarter, entry] of Object.entries(fxRates)) {
				if (!isQuarterLabel(quarter)) {
					errors.push(`fx.rates: invalid quarter label '${quarter}'`);
				}
				const entryObject = entry as Record<string, unknown> | null | undefined;
				for (const currency of ['USD', 'GBP'] as const) {
					const rate = entryObject?.[currency];
					if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
						errors.push(`fx.rates.'${quarter}'.${currency}: must be a positive number`);
					}
				}
			}
		}
	}

	const companies = d['companies'];
	if (!Array.isArray(companies)) {
		errors.push('companies: must be an array');
		return errors;
	}

	const seenIds = new Set<string>();
	companies.forEach((rawCompany, ci) => {
		const path = `companies[${ci}]`;
		if (typeof rawCompany !== 'object' || rawCompany === null) {
			errors.push(`${path}: must be an object`);
			return;
		}
		const company = rawCompany as Record<string, unknown>;

		for (const key of ['id', 'name', 'type', 'country'] as const) {
			const value = company[key];
			if (typeof value !== 'string' || value.trim() === '') {
				errors.push(`${path}.${key}: must be a non-empty string`);
			}
		}
		const id = company['id'];
		if (typeof id === 'string') {
			if (seenIds.has(id)) errors.push(`${path}: duplicate id '${id}'`);
			seenIds.add(id);
		}
		const currency = company['reportingCurrency'];
		if (currency !== 'EUR' && currency !== 'USD' && currency !== 'GBP') {
			errors.push(`${path}.reportingCurrency: must be one of EUR, USD, GBP`);
		}

		const points = company['points'];
		if (!Array.isArray(points)) {
			errors.push(`${path}.points: must be an array`);
			return;
		}
		if (points.length === 0) {
			errors.push(`${path}.points: must have at least one point`);
			return;
		}

		let prevIndex = -Infinity;
		points.forEach((rawPoint, pi) => {
			const pointPath = `${path}.points[${pi}]`;
			if (typeof rawPoint !== 'object' || rawPoint === null) {
				errors.push(`${pointPath}: must be an object`);
				return;
			}
			const point = rawPoint as Record<string, unknown>;

			const quarter = point['quarter'];
			const validQuarter = typeof quarter === 'string' && isQuarterLabel(quarter);
			if (!validQuarter) {
				errors.push(`${pointPath}.quarter: invalid quarter label '${String(quarter)}'`);
			}

			const revenue = point['revenue'];
			if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue < 0) {
				errors.push(`${pointPath}.revenue: must be a finite number >= 0`);
			}
			const operatingIncome = point['operatingIncome'];
			if (typeof operatingIncome !== 'number' || !Number.isFinite(operatingIncome)) {
				errors.push(`${pointPath}.operatingIncome: must be a finite number`);
			}

			const quality = point['quality'];
			if (quality !== 'reported' && quality !== 'estimated' && quality !== 'interpolated') {
				errors.push(`${pointPath}.quality: must be one of reported, estimated, interpolated`);
			} else if (quality !== 'interpolated') {
				const source = point['source'];
				if (typeof source !== 'string' || source.trim() === '') {
					errors.push(`${pointPath}.source: required for quality '${quality}'`);
				}
				const sourceUrl = point['sourceUrl'];
				if (typeof sourceUrl !== 'string' || !/^https?:\/\//.test(sourceUrl)) {
					errors.push(`${pointPath}.sourceUrl: http(s) URL required for quality '${quality}'`);
				}
			}

			if (typeof quarter === 'string' && isQuarterLabel(quarter)) {
				const qi = quarterIndex(quarter);
				if (qi === prevIndex) {
					errors.push(`${pointPath}: duplicate quarter '${quarter}'`);
				} else if (qi < prevIndex) {
					errors.push(`${pointPath}: quarter '${quarter}' out of order`);
				} else if (!(quarter in fxRates)) {
					errors.push(`${pointPath}: no fx rates for quarter '${quarter}'`);
				}
				prevIndex = qi;
			}
		});
	});

	return errors;
}

/** Cast-through loader: returns the typed dataset plus its validation errors. */
export function loadDataset(json: unknown): { dataset: Dataset; errors: string[] } {
	return { dataset: json as Dataset, errors: validateDataset(json) };
}
