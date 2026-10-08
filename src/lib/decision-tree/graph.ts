import type {
	DecisionGraph,
	Node,
	AnswerEdge,
	RawTree,
	TraversalPath,
	QuestionNode,
	ResultNode
} from './types';

export function isQuestionNode(node: Node): node is QuestionNode {
	return node.type === 'question';
}

export function isResultNode(node: Node): node is ResultNode {
	return node.type === 'result';
}

export function buildGraph(raw: RawTree): DecisionGraph {
	const nodes = new Map<string, Node>();
	const edges = new Map<string, AnswerEdge>();
	const edgesBySource = new Map<string, AnswerEdge[]>();

	// Build nodes
	for (const n of raw.nodes) {
		const node: Node =
			n.type === 'question'
				? { id: n.id, type: 'question', prompt: n.content }
				: { id: n.id, type: 'result', result: n.content };
		nodes.set(n.id, node);
	}

	// Build edges
	const hasIncoming = new Set<string>();
	for (const e of raw.edges) {
		const edgeId = `${e.sourceId}|${e.label}`;
		const edge: AnswerEdge = {
			id: edgeId,
			sourceId: e.sourceId,
			targetId: e.targetId,
			label: e.label,
			explanation: e.explanation ?? undefined
		};
		edges.set(edgeId, edge);
		if (!edgesBySource.has(e.sourceId)) {
			edgesBySource.set(e.sourceId, []);
		}
		edgesBySource.get(e.sourceId)!.push(edge);
		hasIncoming.add(e.targetId);
	}

	// Determine root: the node with no incoming edges
	let rootNodeId = raw.nodes[0]?.id ?? '';
	for (const n of raw.nodes) {
		if (!hasIncoming.has(n.id)) {
			rootNodeId = n.id;
			break;
		}
	}

	return { nodes, edges, edgesBySource, rootNodeId };
}

export function getCurrentNode(graph: DecisionGraph, path: TraversalPath): Node {
	if (path.length === 0) {
		return graph.nodes.get(graph.rootNodeId)!;
	}
	const lastEdgeId = path[path.length - 1];
	const lastEdge = graph.edges.get(lastEdgeId);
	if (!lastEdge) {
		return graph.nodes.get(graph.rootNodeId)!;
	}
	const targetNode = graph.nodes.get(lastEdge.targetId);
	return targetNode ?? graph.nodes.get(graph.rootNodeId)!;
}

export function getAnswersForNode(graph: DecisionGraph, nodeId: string): AnswerEdge[] {
	return graph.edgesBySource.get(nodeId) ?? [];
}

export interface QuestionRow {
	type: 'question';
	index: number;
	node: QuestionNode;
}

export interface AnswerRow {
	type: 'answer';
	index: number;
	edges: AnswerEdge[];
	selectedEdgeId?: string;
}

export interface ResultRow {
	type: 'result';
	index: number;
	node: ResultNode;
}

export type Row = QuestionRow | AnswerRow | ResultRow;

export function computeRows(graph: DecisionGraph, path: TraversalPath): Row[] {
	const rows: Row[] = [];
	let currentNodeId = graph.rootNodeId;

	let i = 0;
	while (true) {
		const node = graph.nodes.get(currentNodeId);
		if (!node) break;

		if (isResultNode(node)) {
			rows.push({ type: 'result', index: rows.length, node });
			break;
		}

		// Question row
		rows.push({ type: 'question', index: rows.length, node });

		// Answer row. A path entry only counts if it is an answer to this node.
		const edges = getAnswersForNode(graph, currentNodeId);
		const candidate = i < path.length ? path[i] : undefined;
		const edge = candidate !== undefined ? graph.edges.get(candidate) : undefined;
		const followed = edge && edge.sourceId === currentNodeId ? edge : undefined;
		rows.push({ type: 'answer', index: rows.length, edges, selectedEdgeId: followed?.id });

		// Follow the selected edge, or stop at an invalid or missing one
		if (!followed) break;
		currentNodeId = followed.targetId;
		i++;
	}

	return rows;
}

/**
 * Longest prefix of `path` that is a valid walk from the root: each entry is a
 * known edge leaving the node the previous one reached. Non-arrays and
 * non-string entries (e.g. from corrupt storage) end the prefix.
 */
export function sanitizePath(graph: DecisionGraph, path: unknown): TraversalPath {
	if (!Array.isArray(path)) return [];
	const valid: TraversalPath = [];
	let currentNodeId = graph.rootNodeId;
	for (const entry of path) {
		if (typeof entry !== 'string') break;
		const edge = graph.edges.get(entry);
		if (!edge || edge.sourceId !== currentNodeId || !graph.nodes.has(edge.targetId)) break;
		valid.push(entry);
		currentNodeId = edge.targetId;
	}
	return valid;
}

/** Encode a traversal path URL query parameter value */
export function encodePath(path: TraversalPath): string {
	return encodeURIComponent(path.join(','));
}

/** Decode a traversal path URL query parameter value */
export function decodePath(encoded: string): TraversalPath {
	try {
		return decodeURIComponent(encoded)
			.split(',')
			.filter((s) => s.length > 0);
	} catch {
		return [];
	}
}
