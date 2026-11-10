import type { Company } from './schema';

/** A small default whose lines and labels stand apart; the rest are one click away. */
export const DEFAULT_COMPANY_IDS: readonly string[] = [
	'anthropic',
	'tesla',
	'coca-cola',
	'exxonmobil',
	'apple',
	'nvidia'
];

export interface FilterState {
	/** Allow-list of company ids; empty matches nothing. */
	selectedIds: string[];
	/** Allow-list of company types; empty matches nothing. */
	types: string[];
}

/** Companies allowed by both allow-lists (id selection ∩ type filter). */
export function filterCompanies(companies: readonly Company[], state: FilterState): Company[] {
	const ids = new Set(state.selectedIds);
	const types = new Set(state.types);
	return companies.filter((company) => ids.has(company.id) && types.has(company.type));
}

/** Distinct company types in sorted order, for building the type filter UI. */
export function companyTypes(companies: readonly Company[]): string[] {
	return [...new Set(companies.map((company) => company.type))].sort();
}
