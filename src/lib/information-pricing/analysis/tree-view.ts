/**
 * What the policy-tree diagram shows per node, as plain data for a dagre
 * layout: sample share, scaled savings, decision border, savings fill, and the
 * split diamonds with their edge labels (mirrors the reference Graphviz render).
 */

import { pyFixed, pyGeneral, pyRoundString } from './format';
import { displayedUnit, unitExponent } from './losses';
import type { PolicyTree } from './tree';

export interface TreeNodeView {
	id: number;
	/** Share of the root's training rows, e.g. `80.5%`. */
	shareLabel: string;
	/** Savings scaled and rounded, with the displayed unit, e.g. `125 €`; `–` when missing. */
	savingsLabel: string;
	decision: number;
	decisionLabel: string;
	/** True for the status-quo (root) decision, drawn without a border. */
	isStatusQuo: boolean;
	/**
	 * Savings fill on the green (0) to red (1) scale, log over two decades:
	 * 1 at the tree's largest savings × share, 0.5 at a tenth of it, 0 at a
	 * hundredth or less (and for zero or negative savings); null when missing.
	 */
	fill: number | null;
}

export interface TreeSplitView {
	/** The internal node the split diamond hangs from. */
	node: number;
	input: number;
	/** One edge per child: `≤t`, `∈(a,b]` or `>t`, thresholds to 5 significant digits. */
	edges: { child: number; label: string }[];
}

export interface PolicyTreeView {
	nodes: TreeNodeView[];
	splits: TreeSplitView[];
	/** Decisions in the legend, sorted by name. */
	legend: { decision: number; label: string; isStatusQuo: boolean }[];
	/** Footer lines, e.g. `savings versus the status quo: 10 trucks`. */
	footer: string[];
}

/** Python's `max()` over a sequence: NaN after the first element is skipped. */
function pyMax(values: number[]): number {
	if (values.length === 0) return NaN;
	let m = values[0];
	for (const v of values.slice(1)) if (v > m) m = v;
	return m;
}

const SUPERSCRIPT: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻'
};

/** Decades of savings × share the fill spans, from red (the largest) down to green. */
export const FILL_DECADES = 2;

/** Fill of a share `r` of the largest savings × share: log10 over `FILL_DECADES`, clamped to [0, 1]. */
export function logFill(r: number): number {
	if (!(r > 0)) return 0;
	return Math.min(1, Math.max(0, 1 + Math.log10(r) / FILL_DECADES));
}

/** A threshold to five significant digits, as the reference labels it. */
export function formatThreshold(threshold: number): string {
	return pyGeneral(threshold, 5);
}

/** Display data for the policy tree. */
export function policyTreeView(
	tree: PolicyTree,
	labels: { decisions: string[]; unit: string }
): PolicyTreeView {
	const { nodes } = tree;
	const rootSamples = nodes[0].samples;
	const maxSavings = pyMax(nodes.map((n) => n.savings));
	const maxWeighted = pyMax(nodes.map((n) => (n.savings * n.samples) / rootSamples));
	const exponent = unitExponent(maxSavings);
	const scale = 10 ** (3 * exponent);
	const unit = displayedUnit(exponent, labels.unit);
	const decisionNames = [...new Set(nodes.map((n) => labels.decisions[n.decision]))].sort();
	const rootDecision = nodes[0].decision;
	const nodeViews: TreeNodeView[] = nodes.map((node) => {
		const share = node.samples / rootSamples;
		const weighted = node.savings * share;
		let fill: number | null;
		if (!Number.isFinite(weighted)) fill = null;
		else if (!Number.isFinite(maxWeighted) || maxWeighted <= 0) fill = 0;
		else fill = logFill(weighted / maxWeighted);
		const decisionLabel = labels.decisions[node.decision];
		const savings = pyRoundString(node.savings / scale);
		return {
			id: node.id,
			shareLabel: `${pyFixed(share * 100, 1)}%`,
			savingsLabel: unit ? `${savings} ${unit}` : savings,
			decision: node.decision,
			decisionLabel,
			isStatusQuo: node.decision === rootDecision,
			fill
		};
	});
	const splits: TreeSplitView[] = [];
	for (const node of nodes) {
		if (node.kind !== 'internal') continue;
		const t = node.thresholds.map(formatThreshold);
		const last = t.length;
		splits.push({
			node: node.id,
			input: node.splitInput,
			edges: node.children.map((child, c) => ({
				child,
				label: c === 0 ? `≤${t[0]}` : c === last ? `>${t[last - 1]}` : `∈(${t[c - 1]},${t[c]}]`
			}))
		});
	}
	const footer: string[] = [];
	if (exponent !== 0 && !labels.unit) {
		const power = String(-3 * exponent).replace(/./g, (ch) => SUPERSCRIPT[ch] ?? ch);
		footer.push(`(savings ×10${power})`);
	}
	footer.push(`savings versus the status quo: ${labels.decisions[tree.statusQuo]}`);
	return {
		nodes: nodeViews,
		splits,
		legend: decisionNames.map((label) => {
			const decision = labels.decisions.indexOf(label);
			return { decision, label, isStatusQuo: decision === rootDecision };
		}),
		footer
	};
}
