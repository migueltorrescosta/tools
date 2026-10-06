import type { Company } from './schema';

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
