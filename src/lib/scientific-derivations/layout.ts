import dagre from '@dagrejs/dagre';

export interface Size {
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface GraphLayout {
	width: number;
	height: number;
	/** Node centres. */
	nodes: Record<string, Point>;
	/** Edge routes from source to target boundary, and the label centre. */
	edges: Record<string, { points: Point[]; label: Point }>;
}

/** Boxes allowed side by side before extra inputs are pushed up a row. */
export const MAX_PER_ROW = 3;

/**
 * Top-to-bottom layered layout; edge labels get their own space so they never cover nodes.
 * Rows with more than `maxPerRow` boxes send their inputs (nodes nothing points to) one row
 * higher, so graphs grow taller instead of wider.
 */
export function layoutGraph(
	nodes: Record<string, Size>,
	edges: { id: string; from: string; to: string; label: Size }[],
	maxPerRow = MAX_PER_ROW
): GraphLayout {
	const minlen: Record<string, number> = Object.fromEntries(edges.map((e) => [e.id, 1]));
	const inputs = new Set(Object.keys(nodes).filter((id) => !edges.some((e) => e.to === id)));

	let g = run(nodes, edges, minlen);
	for (let pass = 0; pass < 8; pass++) {
		const rows = new Map<number, string[]>();
		for (const id of Object.keys(nodes)) {
			const y = Math.round(g.node(id).y);
			rows.set(y, [...(rows.get(y) ?? []), id]);
		}
		let moved = false;
		for (const row of rows.values()) {
			const movable = row.filter((id) => inputs.has(id));
			for (const id of movable.slice(0, Math.max(0, row.length - maxPerRow))) {
				for (const e of edges) if (e.from === id) minlen[e.id]++;
				moved = true;
			}
		}
		if (!moved) break;
		g = run(nodes, edges, minlen);
	}

	const graph = g.graph();
	return {
		width: Math.ceil(graph.width ?? 0),
		height: Math.ceil(graph.height ?? 0),
		nodes: Object.fromEntries(
			Object.keys(nodes).map((id) => {
				const { x, y } = g.node(id);
				return [id, { x, y }];
			})
		),
		edges: Object.fromEntries(
			edges.map((edge) => {
				const { points = [], x = 0, y = 0 } = g.edge(edge.from, edge.to, edge.id);
				return [
					edge.id,
					{ points: points.map((p: Point) => ({ x: p.x, y: p.y })), label: { x, y } }
				];
			})
		)
	};
}

function run(
	nodes: Record<string, Size>,
	edges: { id: string; from: string; to: string; label: Size }[],
	minlen: Record<string, number>
) {
	const g = new dagre.graphlib.Graph({ multigraph: true });
	g.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 44, edgesep: 8, marginx: 8, marginy: 8 });
	for (const [id, size] of Object.entries(nodes)) g.setNode(id, { ...size });
	for (const edge of edges) {
		g.setEdge(
			edge.from,
			edge.to,
			{ ...edge.label, labelpos: 'c', minlen: minlen[edge.id] },
			edge.id
		);
	}
	dagre.layout(g);
	return g;
}

/** An SVG path through the points, rounded with quadratic curves at each bend. */
export function edgePath(points: Point[]): string {
	if (points.length === 0) return '';
	const [first, ...rest] = points;
	let d = `M${first.x},${first.y}`;
	for (let i = 0; i < rest.length - 1; i++) {
		const p = rest[i];
		const q = rest[i + 1];
		d += ` Q${p.x},${p.y} ${(p.x + q.x) / 2},${(p.y + q.y) / 2}`;
	}
	const last = rest.at(-1);
	if (last) d += ` L${last.x},${last.y}`;
	return d;
}
