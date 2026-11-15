/**
 * Institutional maps: each context (EU and international, Portugal, the AI industry) is a
 * directed graph of institutions joined by relations. An institution id shared by two
 * contexts names the same body, and the detail panel links between them.
 */

export type InstitutionKind =
	| 'intergovernmental'
	| 'supranational'
	| 'legislature'
	| 'executive'
	| 'court'
	| 'agency'
	| 'programme'
	| 'state'
	| 'company'
	| 'investor'
	| 'nonprofit'
	| 'standards-body';

export type Level = 'global' | 'european' | 'national' | 'regional' | 'local' | 'private';

export interface Overlap {
	/** Id of the other institution, in this context or another. */
	with: string;
	/** Where their remits overlap, and how the overlap is resolved. */
	note: string;
}

export interface Institution {
	id: string;
	/** English name. */
	name: string;
	/** Name in the official language, when it differs. */
	officialName?: string;
	acronym?: string;
	kind: InstitutionKind;
	level: Level;
	founded?: string;
	seat?: string;
	url?: string;
	summary: string;
	responsibilities: string[];
	/** What binds it: treaties, laws, reporting duties. */
	obligations: string[];
	/** Institution ids or free text. */
	accountableTo: string[];
	overlaps: Overlap[];
	sources: string[];
}

export type RelationKind =
	| 'oversees'
	| 'appoints'
	| 'regulates'
	| 'funds'
	| 'invests-in'
	| 'appeals-to'
	| 'member-of'
	| 'part-of'
	| 'implements'
	| 'supplies'
	| 'partners'
	| 'competes';

export interface Relation {
	from: string;
	to: string;
	kind: RelationKind;
	/** A few words, read as "from <label> to". */
	label: string;
	detail?: string;
	sources: string[];
}

/** A themed part of a context, drawn on its own: a smaller map is faster and easier to read. */
export interface Part {
	id: string;
	title: string;
	/** Its institutions; a body may sit in several parts. */
	ids: string[];
}

/** A common situation, walked through as a path of institutions inside one part. */
export interface Route {
	id: string;
	/** The situation, e.g. "I lost my job". */
	title: string;
	steps: { id: string; note: string }[];
}

export interface Context {
	id: string;
	title: string;
	summary: string;
	/** Date the facts were last checked, ISO format. */
	asOf: string;
	institutions: Institution[];
	relations: Relation[];
	parts: Part[];
	routes: Route[];
}

export function relationId(r: Pick<Relation, 'from' | 'to' | 'kind'>): string {
	return `${r.from}-${r.kind}-${r.to}`;
}
