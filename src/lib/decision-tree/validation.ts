import type { DecisionGraph } from './types';
import { isResultNode, getAnswersForNode } from './graph';

export function validateGraph(graph: DecisionGraph): string[] {
	const errors: string[] = [];

	if (graph.nodes.size === 0) {
		errors.push('Graph has no nodes');
		return errors;
	}

	// 0. Answer labels are unique per question (the label is part of the edge id)
	for (const edge of graph.duplicateEdges) {
		errors.push(
			`Node "${edge.sourceId}" has a duplicate answer "${edge.label}"; answer labels must be unique per question`
		);
	}

	// Duplicates still count as written for the structural checks below, so they
	// do not also surface as a spurious extra root or unreachable node
	const allEdges = [...graph.edges.values(), ...graph.duplicateEdges];

	// 1. All edge targets exist
	for (const edge of allEdges) {
		if (!graph.nodes.has(edge.targetId)) {
			errors.push(`Edge "${edge.id}" references non-existent target node "${edge.targetId}"`);
		}
	}

	// 2. Exactly one root node (one node with no incoming edges)
	const hasIncoming = new Set<string>();
	for (const edge of allEdges) {
		hasIncoming.add(edge.targetId);
	}
	const roots: string[] = [];
	for (const [nodeId] of graph.nodes) {
		if (!hasIncoming.has(nodeId)) {
			roots.push(nodeId);
		}
	}
	if (roots.length === 0) {
		errors.push('No root node found (every node has an incoming edge)');
	} else if (roots.length > 1) {
		errors.push(`Multiple root nodes found: ${roots.join(', ')}`);
	}

	// 3. All nodes are reachable from root (if a single root exists)
	if (roots.length === 1) {
		const rootId = roots[0];
		const reachable = new Set<string>([rootId]);
		const queue = [rootId];
		while (queue.length > 0) {
			const current = queue.shift()!;
			const edges = allEdges.filter((e) => e.sourceId === current);
			for (const edge of edges) {
				if (!reachable.has(edge.targetId)) {
					reachable.add(edge.targetId);
					queue.push(edge.targetId);
				}
			}
		}
		for (const nodeId of graph.nodes.keys()) {
			if (!reachable.has(nodeId)) {
				errors.push(`Node "${nodeId}" is not reachable from the root`);
			}
		}
	}

	// 4. All question nodes have at least one answer
	for (const [nodeId, node] of graph.nodes) {
		if (!isResultNode(node)) {
			const edges = getAnswersForNode(graph, nodeId);
			if (edges.length === 0) {
				errors.push(`Question node "${nodeId}" has no answer options`);
			}
		}
	}

	// 5. All result nodes have no outgoing edges (are terminal)
	for (const [nodeId, node] of graph.nodes) {
		if (isResultNode(node)) {
			const edges = getAnswersForNode(graph, nodeId);
			if (edges.length > 0) {
				errors.push(
					`Result node "${nodeId}" has ${edges.length} outgoing edge(s); result nodes must be terminal`
				);
			}
		}
	}

	// 6. No cycles (DFS)
	const visited = new Set<string>();
	const inStack = new Set<string>();

	function detectCycle(nodeId: string): string | null {
		if (inStack.has(nodeId)) {
			return nodeId;
		}
		if (visited.has(nodeId)) {
			return null;
		}
		visited.add(nodeId);
		inStack.add(nodeId);

		const node = graph.nodes.get(nodeId);
		if (node && !isResultNode(node)) {
			const edges = getAnswersForNode(graph, nodeId);
			for (const edge of edges) {
				const cycle = detectCycle(edge.targetId);
				if (cycle) return cycle;
			}
		}

		inStack.delete(nodeId);
		return null;
	}

	for (const nodeId of graph.nodes.keys()) {
		if (!visited.has(nodeId)) {
			const cycle = detectCycle(nodeId);
			if (cycle) {
				errors.push(`Graph contains a cycle detected at node "${cycle}"`);
				break;
			}
		}
	}

	// Every path ends in a result follows from the checks above: on an acyclic
	// graph where each question has an answer and every edge target exists, a
	// walk from the root can only stop at a result node. A separate path walk
	// would recurse forever on cycles that miss the root and is exponential on
	// converging answers.

	return errors;
}

export function validate(raw: { nodes: unknown[]; edges: unknown[] }): string[] {
	// Basic structural validation before graph building
	const errors: string[] = [];

	if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
		errors.push('Tree must contain at least one node');
	}

	if (!Array.isArray(raw.edges)) {
		errors.push('Edges must be an array');
	}

	return errors;
}
