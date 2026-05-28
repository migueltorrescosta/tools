import type { DecisionGraph, Node, AnswerEdge, RawTree, TraversalPath, QuestionNode, ResultNode } from './types';

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

		// Answer row
		const edges = getAnswersForNode(graph, currentNodeId);
		const selectedEdgeId = i < path.length ? path[i] : undefined;
		rows.push({ type: 'answer', index: rows.length, edges, selectedEdgeId });

		// Follow the selected edge
		if (selectedEdgeId) {
			const edge = graph.edges.get(selectedEdgeId);
			if (edge) {
				currentNodeId = edge.targetId;
				i++;
			} else {
				break;
			}
		} else {
			break;
		}
	}

	return rows;
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
