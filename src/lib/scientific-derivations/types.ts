/**
 * A paper's key derivations as directed graphs: nodes are equations, edges are
 * the facts that take one equation to the next. Prose fields may hold inline
 * TeX between dollar signs, rendered by `renderProse`.
 */

/** assumption: an input (model, hypothesis, or a result imported from elsewhere); result: a conclusion. */
export type NodeKind = 'assumption' | 'step' | 'result';

export interface EquationNode {
	id: string;
	/** Short name shown above the equation. */
	title: string;
	/** Display-mode TeX. */
	tex: string;
	kind: NodeKind;
	/** Explanation for the detail panel. */
	detail?: string;
	/** Where the paper states it, e.g. "Eq. (17)". */
	ref?: string;
	/** Not in the paper: a step added to fill a gap. */
	added?: boolean;
	/** Where and why this deviates from the paper. */
	correction?: string;
	/** Id of another derivation of the same paper this node is taken from. */
	from?: string;
}

export interface FactEdge {
	from: string;
	to: string;
	/** Short label drawn on the edge. */
	label: string;
	detail?: string;
	ref?: string;
	correction?: string;
}

export interface Derivation {
	id: string;
	title: string;
	/** Where in the paper, e.g. "Supplementary Material, Sec. I". */
	section: string;
	summary: string;
	nodes: EquationNode[];
	edges: FactEdge[];
}

export interface Paper {
	id: string;
	title: string;
	authors: string;
	/** Journal reference, e.g. "Phys. Rev. Lett. 136, 040201 (2026)". */
	venue: string;
	url: string;
	/** Which version the equation numbers refer to. */
	numbering: string;
	derivations: Derivation[];
}

export function edgeId(edge: Pick<FactEdge, 'from' | 'to'>): string {
	return `${edge.from}->${edge.to}`;
}
