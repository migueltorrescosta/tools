/**
 * Layout of the policy tree: one box per tree node, a pill per split between an internal node
 * and its children, edge labels on the pill's outgoing edges. Children run left to right in
 * the order of their intervals, smaller values on the left.
 */
import { layoutGraph, type Point, type Size } from '#lib/graph-layout.js';
import type { PolicyTreeView } from '#lib/information-pricing/analysis/index.js';
import { thresholdLabels } from './format';

export interface LaidOutNode {
	/** Tree node id. */
	id: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LaidOutSplit {
	/** The internal node the split hangs from. */
	node: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LaidOutEdge {
	id: string;
	points: Point[];
	/** Label text and centre, on split → child edges. */
	label?: { text: string; x: number; y: number };
}

export interface TreeLayout {
	width: number;
	height: number;
	nodes: LaidOutNode[];
	splits: LaidOutSplit[];
	edges: LaidOutEdge[];
}

/** Approximate text width in px at the diagram's 12px font. */
export const textWidth = (text: string) => Math.ceil(text.length * 7);

/** Lines of text a node box shows: its savings and its share. The decision is the border colour. */
export function nodeLines(n: PolicyTreeView['nodes'][number]): string[] {
	return [n.savingsLabel, n.shareLabel];
}

export const LINE_HEIGHT = 16;
const PAD = 8;

/** Text of a split pill: the input's name from `names` (model order). */
export function splitText(s: PolicyTreeView['splits'][number], names: readonly string[]): string {
	return names[s.input];
}

export const SPLIT_HEIGHT = 26;

export async function layoutTree(
	view: PolicyTreeView,
	names: readonly string[]
): Promise<TreeLayout> {
	const sizes = new Map<string, Size>();
	for (const n of view.nodes) {
		const lines = nodeLines(n);
		sizes.set(`n${n.id}`, {
			width: Math.max(80, ...lines.map(textWidth)) + 2 * PAD,
			height: lines.length * LINE_HEIGHT + 2 * PAD
		});
	}
	const labels = new Map(view.splits.map((s) => [s.node, thresholdLabels(s.thresholds)]));
	const splitOf = new Map(view.splits.map((s) => [s.node, s]));
	for (const s of view.splits)
		sizes.set(`s${s.node}`, { width: textWidth(splitText(s, names)) + 24, height: SPLIT_HEIGHT });
	// Nodes and edges depth first, children in interval order: ELK keeps each row in this order.
	const order: string[] = [];
	const edges: { id: string; from: string; to: string; label?: Size; text?: string }[] = [];
	const visit = (id: number) => {
		order.push(`n${id}`);
		const s = splitOf.get(id);
		if (!s) return;
		order.push(`s${id}`);
		edges.push({ id: `n${id}-s${id}`, from: `n${id}`, to: `s${id}` });
		for (const [c, e] of s.edges.entries()) {
			const text = labels.get(id)![c];
			edges.push({
				id: `s${id}-n${e.child}`,
				from: `s${id}`,
				to: `n${e.child}`,
				label: { width: textWidth(text) + 8, height: 16 },
				text
			});
		}
		for (const e of s.edges) visit(e.child);
	};
	visit(view.nodes[0].id);
	const g = await layoutGraph(Object.fromEntries(order.map((id) => [id, sizes.get(id)!])), edges, {
		nodeGap: 10,
		rowGap: 26,
		keepOrder: true
	});
	const box = (key: string, size: Size) => ({ ...g.nodes[key], ...size });
	return {
		width: g.width,
		height: g.height,
		nodes: view.nodes.map((n) => ({ id: n.id, ...box(`n${n.id}`, sizes.get(`n${n.id}`)!) })),
		splits: view.splits.map((s) => ({
			node: s.node,
			...box(`s${s.node}`, sizes.get(`s${s.node}`)!)
		})),
		edges: edges.map((e) => ({
			id: e.id,
			points: g.edges[e.id].points,
			...(e.text !== undefined && { label: { text: e.text, ...g.edges[e.id].label } })
		}))
	};
}
