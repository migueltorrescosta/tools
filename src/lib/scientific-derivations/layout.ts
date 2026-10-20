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

/** Top-to-bottom layered layout; edge labels get their own space so they never cover nodes. */
export function layoutGraph(
	nodes: Record<string, Size>,
	edges: { id: string; from: string; to: string; label: Size }[]
): GraphLayout {
	const g = new dagre.graphlib.Graph({ multigraph: true });
	g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 36, edgesep: 16, marginx: 8, marginy: 8 });
	for (const [id, size] of Object.entries(nodes)) g.setNode(id, { ...size });
	for (const edge of edges) {
		g.setEdge(edge.from, edge.to, { ...edge.label, labelpos: 'c' }, edge.id);
	}
	dagre.layout(g);

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
