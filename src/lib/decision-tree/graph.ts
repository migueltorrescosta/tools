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
	const duplicateEdges: AnswerEdge[] = [];
	const duplicateNodeIds: string[] = [];

	// Build nodes. Keep the first of two nodes with the same id, like edges below
	for (const n of raw.nodes) {
		if (nodes.has(n.id)) {
			duplicateNodeIds.push(n.id);
			continue;
		}
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
		// An edge from a missing node gives no real incoming edge; validateGraph reports it
		if (nodes.has(e.sourceId)) hasIncoming.add(e.targetId);
		// The id is the path key and the UI's each-block key, so keep only the first
		if (edges.has(edgeId)) {
			duplicateEdges.push(edge);
			continue;
		}
		edges.set(edgeId, edge);
		if (!edgesBySource.has(e.sourceId)) {
			edgesBySource.set(e.sourceId, []);
		}
		edgesBySource.get(e.sourceId)!.push(edge);
	}

	// Determine root: the node with no incoming edges
	let rootNodeId = raw.nodes[0]?.id ?? '';
	for (const n of raw.nodes) {
		if (!hasIncoming.has(n.id)) {
			rootNodeId = n.id;
			break;
		}
	}

	return { nodes, edges, edgesBySource, rootNodeId, duplicateEdges, duplicateNodeIds };
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
	/** Position of this answer in the traversal path (0 for the root question). */
	depth: number;
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
		rows.push({
			type: 'answer',
			index: rows.length,
			depth: i,
			edges,
			selectedEdgeId: followed?.id
		});

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

/** Choose `edgeId` as the answer at `depth`, dropping every later answer. */
export function selectAnswer(path: TraversalPath, depth: number, edgeId: string): TraversalPath {
	return [...path.slice(0, depth), edgeId];
}

/**
 * The path to start from: the `?p=` value if it yields a valid non-empty
 * prefix, else the saved JSON from storage, else the root. Both are trimmed to
 * their longest valid prefix so stale or crafted paths never reach state.
 */
export function restorePath(
	graph: DecisionGraph,
	urlParam: string | null,
	saved: string | null
): TraversalPath {
	const urlPath = urlParam ? sanitizePath(graph, decodePath(graph, urlParam)) : [];
	if (urlPath.length > 0) return urlPath;
	if (!saved) return [];
	try {
		return sanitizePath(graph, JSON.parse(saved));
	} catch {
		return [];
	}
}

/** Shape of an index-encoded path: answer positions per step, e.g. "0.5.0". */
const INDEX_PATH = /^\d+(\.\d+)*$/;

/**
 * Encode a traversal path as the `?p=` value: the position of each chosen
 * answer among its question's answers, joined with '.'. The result needs no
 * escaping, so labels containing ',' or '%' cannot corrupt it. Encoding stops
 * at the first entry that is not an answer of the node the walk has reached.
 */
export function encodePath(graph: DecisionGraph, path: TraversalPath): string {
	const indices: number[] = [];
	let currentNodeId = graph.rootNodeId;
	for (const edgeId of path) {
		const index = getAnswersForNode(graph, currentNodeId).findIndex((e) => e.id === edgeId);
		if (index < 0) break;
		indices.push(index);
		currentNodeId = graph.edges.get(edgeId)!.targetId;
	}
	return indices.join('.');
}

/**
 * Decode a `?p=` value into edge ids. Index paths ("0.5.0") walk from the root
 * and stop at the first out-of-range index. Anything else is read as the legacy
 * format (URI-encoded edge ids joined with ',') so old shared links still open.
 */
export function decodePath(graph: DecisionGraph, encoded: string): TraversalPath {
	if (INDEX_PATH.test(encoded)) {
		const path: TraversalPath = [];
		let currentNodeId = graph.rootNodeId;
		for (const part of encoded.split('.')) {
			const edge = getAnswersForNode(graph, currentNodeId)[Number(part)];
			if (!edge) break;
			path.push(edge.id);
			currentNodeId = edge.targetId;
		}
		return path;
	}
	try {
		return decodeURIComponent(encoded)
			.split(',')
			.filter((s) => s.length > 0);
	} catch {
		return [];
	}
}
