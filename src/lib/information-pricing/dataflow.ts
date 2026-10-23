/**
 * The model as a dataflow graph for the Setup view: one node per input,
 * intermediate, the decision and the reward, and an edge from each symbol to
 * every node whose formula uses it. Edges come from the tokeniser, so a formula
 * that does not parse still shows where its symbols come from. No DOM or Svelte imports.
 */
import { familyInfo, isFixed } from './distributions';
import { IDENTIFIER } from './formula/ast';
import { parse } from './formula/parse';
import { tex, texNumber, texSymbol } from './formula/tex';
import { tokenise } from './formula/tokenise';
import type { Model } from './types';

export type FlowKind = 'input' | 'fixed' | 'intermediate' | 'decision' | 'reward';

export interface FlowNode {
	id: string;
	kind: FlowKind;
	/** Display name (empty when the row has none). */
	title: string;
	/** Short name for screen readers: the symbol, or "Reward". */
	label: string;
	/** TeX for the node, or null when it is shown as `raw` text. */
	tex: string | null;
	/** The formula as typed, shown when it has an error. */
	raw?: string;
	error: boolean;
}

export interface FlowEdge {
	id: string;
	from: string;
	to: string;
}

export interface Dataflow {
	nodes: FlowNode[];
	edges: FlowEdge[];
}

/** Node ids: stable row keys from the page, so selections survive edits. */
export interface FlowIds {
	input: (index: number) => string;
	intermediate: (index: number) => string;
}

/** Formulas with errors: intermediate indices and the reward. */
export interface FlowErrors {
	intermediates: ReadonlySet<number>;
	reward: boolean;
}

export const DECISION_NODE = 'decision';
export const REWARD_NODE = 'reward';

const TEX_FAMILY: Record<string, string> = {
	lognormal: 'LogNormal'
};

/** A parameter in TeX, large round numbers as `3.5 \times 10^{8}`. */
export function texParam(v: number): string {
	if (Number.isFinite(v) && Math.abs(v) >= 1e5) {
		const [m, e] = v.toExponential().split('e');
		if (m.replace('-', '').length <= 4)
			return `${m === '1' ? '' : m === '-1' ? '-' : `${m} \\times `}10^{${Number(e)}}`;
	}
	return texNumber(v);
}

const sym = (s: string) => (IDENTIFIER.test(s) ? texSymbol(s) : `\\text{?}`);

/** `b \in \{0, 250, \dots, 1000\}`: every value when there are four or fewer. */
function decisionTex(symbol: string, values: readonly number[]): string {
	const shown =
		values.length <= 4
			? values.map(texParam)
			: [texParam(values[0]), texParam(values[1]), '\\dots', texParam(values.at(-1)!)];
	return `${sym(symbol)} \\in \\{${shown.join(', ')}\\}`;
}

/** Symbols of `text` that `owners` knows, in order of first use. */
function usedSymbols(text: string, owners: ReadonlyMap<string, string>): string[] {
	const out = new Set<string>();
	for (const t of tokenise(text).tokens)
		if (t.kind === 'ident' && owners.has(t.text)) out.add(t.text);
	return [...out];
}

/** The dataflow graph of `model`. */
export function dataflow(
	model: Model,
	ids: FlowIds,
	errors: FlowErrors = { intermediates: new Set(), reward: false }
): Dataflow {
	const nodes: FlowNode[] = [];
	const owners = new Map<string, string>();
	const own = (symbol: string, id: string) => {
		if (!owners.has(symbol)) owners.set(symbol, id);
	};

	model.inputs.forEach((input, i) => {
		const id = ids.input(i);
		own(input.symbol, id);
		const params = input.params.map(texParam).join(',\\ ');
		const family = TEX_FAMILY[input.family] ?? familyInfo(input.family).name;
		nodes.push({
			id,
			kind: isFixed(input) ? 'fixed' : 'input',
			title: input.name,
			label: input.symbol,
			tex: isFixed(input)
				? `${sym(input.symbol)} = ${texParam(input.params[0])}`
				: `${sym(input.symbol)} \\sim \\mathrm{${family}}(${params})`,
			error: false
		});
	});
	model.intermediates.forEach((m, i) => own(m.symbol, ids.intermediate(i)));
	own(model.decisions.symbol, DECISION_NODE);

	/** A formula node: TeX when it parses and has no error, else its raw text. */
	const formula = (
		id: string,
		kind: FlowKind,
		title: string,
		label: string,
		lhs: string,
		text: string,
		bad: boolean
	) => {
		const parsed = bad ? null : parse(text);
		const ok = parsed?.ok === true;
		nodes.push({
			id,
			kind,
			title,
			label,
			tex: ok ? `${lhs} = ${tex(parsed.ast)}` : null,
			raw: ok ? undefined : text,
			error: !ok
		});
	};
	model.intermediates.forEach((m, i) =>
		formula(
			ids.intermediate(i),
			'intermediate',
			m.name,
			m.symbol,
			sym(m.symbol),
			m.formula,
			errors.intermediates.has(i)
		)
	);
	const d = model.decisions;
	nodes.push({
		id: DECISION_NODE,
		kind: 'decision',
		title: 'Decision',
		label: d.symbol,
		tex: decisionTex(d.symbol, d.values),
		error: false
	});
	formula(REWARD_NODE, 'reward', '', 'Reward', '\\text{Reward}', d.reward, errors.reward);

	const edges: FlowEdge[] = [];
	const link = (to: string, text: string) => {
		for (const s of usedSymbols(text, owners)) {
			const from = owners.get(s)!;
			if (from !== to) edges.push({ id: `${from}->${to}`, from, to });
		}
	};
	model.intermediates.forEach((m, i) => link(ids.intermediate(i), m.formula));
	link(REWARD_NODE, d.reward);
	return { nodes, edges };
}

/** Every node upstream (`'up'`) or downstream (`'down'`) of `id`, and the edges on the way. */
export function reach(
	graph: Dataflow,
	id: string,
	direction: 'up' | 'down'
): { nodes: Set<string>; edges: Set<string> } {
	const nodes = new Set<string>();
	const edges = new Set<string>();
	const queue = [id];
	while (queue.length) {
		const at = queue.pop()!;
		for (const e of graph.edges) {
			const [here, there] = direction === 'up' ? [e.to, e.from] : [e.from, e.to];
			if (here !== at) continue;
			edges.add(e.id);
			if (!nodes.has(there)) {
				nodes.add(there);
				queue.push(there);
			}
		}
	}
	return { nodes, edges };
}
