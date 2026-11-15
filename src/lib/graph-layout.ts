/**
 * Top-to-bottom layered layout of the app's node-link diagrams (Dataflow, derivations,
 * policy tree) with ELK, which runs in a worker (`graph-layout.worker.ts`) started on the
 * first layout. Node has no workers, so specs pass ELK's bundled build to `useElk`.
 */
import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js';

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

export interface LayoutEdge {
	id: string;
	from: string;
	to: string;
	/** Label box, given its own space so it never covers a node; absent or zero for none. */
	label?: Size;
}

export interface LayoutOptions {
	/** Gap between boxes side by side. */
	nodeGap?: number;
	/** Gap between rows. */
	rowGap?: number;
	/** Keep each row in the order the nodes are given instead of minimising crossings. */
	keepOrder?: boolean;
	/** At most this many boxes per row: wide graphs grow taller instead of wider. */
	maxPerRow?: number;
	/** Gap between parallel edges, and between an edge and a box (twice this). */
	edgeGap?: number;
	/** Let edges that share an end share their route, which saves width on busy graphs. */
	mergeEdges?: boolean;
	/** Crossing-minimisation passes; ELK's default is 7. */
	thoroughness?: number;
}

let engine: Promise<ELK> | undefined;

function elk(): Promise<ELK> {
	engine ??= import('elkjs/lib/elk-api.js').then(
		({ default: Elk }) =>
			new Elk({
				workerFactory: () =>
					new Worker(new URL('./graph-layout.worker.ts', import.meta.url), { type: 'module' })
			})
	);
	return engine;
}

/** Lays out with this ELK instead of the worker; specs pass ELK's bundled build. */
export function useElk(instance: ELK): void {
	engine = Promise.resolve(instance);
}

export async function layoutGraph(
	nodes: Record<string, Size>,
	edges: LayoutEdge[],
	{
		nodeGap = 16,
		rowGap = 44,
		keepOrder = false,
		maxPerRow,
		edgeGap,
		mergeEdges = false,
		thoroughness = 100
	}: LayoutOptions = {}
): Promise<GraphLayout> {
	const graph: ElkNode = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': 'DOWN',
			'elk.edgeRouting': 'ORTHOGONAL',
			'elk.padding': '[top=8,left=8,bottom=8,right=8]',
			'elk.spacing.nodeNode': String(nodeGap),
			'elk.layered.spacing.nodeNodeBetweenLayers': String(rowGap),
			'elk.spacing.edgeNode': '12',
			'elk.spacing.edgeEdge': '8',
			...(edgeGap !== undefined && {
				'elk.spacing.edgeNode': String(edgeGap * 2),
				'elk.spacing.edgeEdge': String(edgeGap),
				'elk.layered.spacing.edgeNodeBetweenLayers': String(edgeGap * 2),
				'elk.layered.spacing.edgeEdgeBetweenLayers': String(edgeGap)
			}),
			...(mergeEdges && { 'elk.layered.mergeEdges': 'true' }),
			// More crossing-minimisation passes: a few ms on the largest graphs, about half the crossings.
			'elk.layered.thoroughness': String(thoroughness),
			'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
			'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
			...(maxPerRow && {
				'elk.layered.layering.strategy': 'COFFMAN_GRAHAM',
				'elk.layered.layering.coffmanGraham.layerBound': String(maxPerRow)
			}),
			...(keepOrder && {
				'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
				'elk.layered.crossingMinimization.forceNodeModelOrder': 'true'
			})
		},
		children: Object.entries(nodes).map(([id, size]) => ({ id, ...size })),
		edges: edges.map((e) => ({
			id: e.id,
			sources: [e.from],
			targets: [e.to],
			// ELK skips labels without text; the text itself is never drawn.
			labels: e.label?.width ? [{ id: `${e.id}:label`, text: e.id, ...e.label }] : []
		}))
	};
	const laidOut = await (await elk()).layout(graph);
	const layout: GraphLayout = {
		width: Math.ceil(laidOut.width ?? 0),
		height: Math.ceil(laidOut.height ?? 0),
		nodes: {},
		edges: {}
	};
	for (const n of laidOut.children ?? [])
		layout.nodes[n.id] = { x: n.x! + n.width! / 2, y: n.y! + n.height! / 2 };
	for (const e of laidOut.edges ?? []) {
		const s = e.sections?.[0];
		const points = s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : [];
		const l = e.labels?.[0];
		layout.edges[e.id] = {
			points: points.map(({ x, y }) => ({ x, y })),
			label: l ? { x: l.x! + l.width! / 2, y: l.y! + l.height! / 2 } : { x: 0, y: 0 }
		};
	}
	return layout;
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
