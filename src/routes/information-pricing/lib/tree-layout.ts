/**
 * Dagre layout of the policy tree: one box per tree node, a diamond per split
 * between an internal node and its children, edge labels on the diamond's
 * outgoing edges.
 */
import dagre from '@dagrejs/dagre';
import type { PolicyTreeView } from '$lib/information-pricing/analysis';

export interface Point {
	x: number;
	y: number;
}

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

/** Lines of text a node box shows. */
export function nodeLines(n: PolicyTreeView['nodes'][number]): string[] {
	return [n.decisionLabel, `saves ${n.savingsLabel}`, `${n.shareLabel} of scenarios`];
}

export const LINE_HEIGHT = 16;
const PAD = 8;

/** Text of a split pill: the input's name from `names` (model order), else the view's label. */
export function splitText(s: PolicyTreeView['splits'][number], names?: readonly string[]): string {
	return names?.[s.input] || s.inputLabel;
}

export const SPLIT_HEIGHT = 26;

export function layoutTree(view: PolicyTreeView, names?: readonly string[]): TreeLayout {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: 'TB', nodesep: 10, ranksep: 26, edgesep: 8, marginx: 6, marginy: 6 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const n of view.nodes) {
		const lines = nodeLines(n);
		g.setNode(`n${n.id}`, {
			width: Math.max(80, ...lines.map(textWidth)) + 2 * PAD,
			height: lines.length * LINE_HEIGHT + 2 * PAD
		});
	}
	for (const s of view.splits) {
		g.setNode(`s${s.node}`, {
			width: textWidth(splitText(s, names)) + 24,
			height: SPLIT_HEIGHT
		});
		g.setEdge(`n${s.node}`, `s${s.node}`, {});
		for (const e of s.edges)
			g.setEdge(`s${s.node}`, `n${e.child}`, {
				width: textWidth(e.label) + 8,
				height: 16,
				labelpos: 'c'
			});
	}
	dagre.layout(g);
	const box = (key: string) => {
		const { x, y, width, height } = g.node(key);
		return { x, y, width, height };
	};
	const route = (from: string, to: string) => {
		const e = g.edge(from, to);
		return { points: (e.points ?? []).map((p: Point) => ({ x: p.x, y: p.y })), x: e.x, y: e.y };
	};
	const edges: LaidOutEdge[] = [];
	for (const s of view.splits) {
		edges.push({ id: `n${s.node}-s${s.node}`, points: route(`n${s.node}`, `s${s.node}`).points });
		for (const e of s.edges) {
			const r = route(`s${s.node}`, `n${e.child}`);
			edges.push({
				id: `s${s.node}-n${e.child}`,
				points: r.points,
				label: { text: e.label, x: r.x ?? 0, y: r.y ?? 0 }
			});
		}
	}
	const graph = g.graph();
	return {
		width: Math.ceil(graph.width ?? 0),
		height: Math.ceil(graph.height ?? 0),
		nodes: view.nodes.map((n) => ({ id: n.id, ...box(`n${n.id}`) })),
		splits: view.splits.map((s) => ({ node: s.node, ...box(`s${s.node}`) })),
		edges
	};
}

/** An SVG path through the points. */
export function edgePath(points: Point[]): string {
	return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
}
