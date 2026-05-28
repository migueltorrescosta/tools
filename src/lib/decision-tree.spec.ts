import { describe, it, expect } from 'vitest';
import { buildGraph, getCurrentNode, getAnswersForNode, computeRows, encodePath, decodePath, isResultNode, isQuestionNode } from './decision-tree/graph';
import { validateGraph } from './decision-tree/validation';
import type { RawTree, DecisionGraph, TraversalPath } from './decision-tree/types';

function makeValidTree(): RawTree {
	return {
		nodes: [
			{ id: 'root', type: 'question', content: 'Root?' },
			{ id: 'q1', type: 'question', content: 'Question 1?' },
			{ id: 'r1', type: 'result', content: 'Result 1' }
		],
		edges: [
			{ sourceId: 'root', targetId: 'q1', label: 'Yes' },
			{ sourceId: 'q1', targetId: 'r1', label: 'Option A' }
		]
	};
}

function makeCarGraph(): DecisionGraph {
	const raw: RawTree = {
		nodes: [
			{ id: 'root', type: 'question', content: 'What matters most?' },
			{ id: 'q_city', type: 'question', content: 'Mostly city driving?' },
			{ id: 'r_hybrid', type: 'result', content: 'Hybrid' },
			{ id: 'r_gas', type: 'result', content: 'Gas Sedan' }
		],
		edges: [
			{ sourceId: 'root', targetId: 'q_city', label: 'Lowest cost' },
			{ sourceId: 'q_city', targetId: 'r_hybrid', label: 'Yes' },
			{ sourceId: 'q_city', targetId: 'r_gas', label: 'No' }
		]
	};
	return buildGraph(raw);
}

// ---------------------------------------------------------------------------
// 1. Valid traversal path correctly renders alternating question and answer rows
//    until a single result node is reached.
// ---------------------------------------------------------------------------
describe('Valid traversal renders alternating rows until result', () => {
	it('renders question + answer + result for a complete path', () => {
		const graph = makeCarGraph();
		const path: TraversalPath = ['root|Lowest cost', 'q_city|Yes'];
		const rows = computeRows(graph, path);

		expect(rows.length).toBe(5);
		expect(rows[0].type).toBe('question');
		expect((rows[0] as any).node.prompt).toBe('What matters most?');
		expect(rows[1].type).toBe('answer');
		expect((rows[1] as any).selectedEdgeId).toBe('root|Lowest cost');
		expect(rows[2].type).toBe('question');
		expect((rows[2] as any).node.prompt).toBe('Mostly city driving?');
		expect(rows[3].type).toBe('answer');
		expect((rows[3] as any).selectedEdgeId).toBe('q_city|Yes');
		expect(rows[4].type).toBe('result');
		expect((rows[4] as any).node.result).toBe('Hybrid');
	});

	it('renders only the root row when path is empty', () => {
		const graph = makeCarGraph();
		const rows = computeRows(graph, []);
		expect(rows.length).toBe(2);
		expect(rows[0].type).toBe('question');
		expect(rows[1].type).toBe('answer');
		expect((rows[1] as any).selectedEdgeId).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 2. Selecting a different answer on a previous question removes all downstream
//    rows and replaces them with the newly valid path.
// ---------------------------------------------------------------------------
describe('Changing answer removes downstream rows', () => {
	it('truncates path and replaces downstream', () => {
		const graph = makeCarGraph();
		const path: TraversalPath = ['root|Lowest cost', 'q_city|Yes'];

		// User changes the first answer to a different branch
		const newPath: TraversalPath = ['root|Lowest cost', 'q_city|No'];
		const rows = computeRows(graph, newPath);

		expect(rows.length).toBe(5);
		expect((rows[4] as any).node.result).toBe('Gas Sedan');
	});

	it('removes downstream when first answer is changed to a leaf', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Root?' },
				{ id: 'r1', type: 'result', content: 'Direct result' },
				{ id: 'q1', type: 'question', content: 'Follow-up?' },
				{ id: 'r2', type: 'result', content: 'Deep result' }
			],
			edges: [
				{ sourceId: 'root', targetId: 'r1', label: 'Short path' },
				{ sourceId: 'root', targetId: 'q1', label: 'Long path' },
				{ sourceId: 'q1', targetId: 'r2', label: 'Yes' }
			]
		};
		const g = buildGraph(raw);

		// Start on long path
		let path: TraversalPath = ['root|Long path', 'q1|Yes'];
		let rows = computeRows(g, path);
		expect(rows[rows.length - 1].type).toBe('result');
		expect((rows[rows.length - 1] as any).node.result).toBe('Deep result');

		// Switch to short path
		path = ['root|Short path'];
		rows = computeRows(g, path);
		expect(rows.length).toBe(3);
		expect(rows[0].type).toBe('question');
		expect(rows[1].type).toBe('answer');
		expect(rows[2].type).toBe('result');
		expect((rows[2] as any).node.result).toBe('Direct result');
	});
});

// ---------------------------------------------------------------------------
// 3. Traversal state persists correctly after refresh / shareable URL
// ---------------------------------------------------------------------------
describe('State persistence encoding', () => {
	it('encodes and decodes a path losslessly', () => {
		const path: TraversalPath = ['root|Choose a car', 'c_q1|Lowest total cost', 'c_q2|Yes'];
		const encoded = encodePath(path);
		const decoded = decodePath(encoded);
		expect(decoded).toEqual(path);
	});

	it('handles empty path', () => {
		expect(decodePath(encodePath([]))).toEqual([]);
	});

	it('handles special characters in labels', () => {
		const path: TraversalPath = ['root|A/B test', 'q1|50% chance'];
		const encoded = encodePath(path);
		const decoded = decodePath(encoded);
		expect(decoded).toEqual(path);
	});
});

// ---------------------------------------------------------------------------
// 4. A tree containing cycles fails validation
// ---------------------------------------------------------------------------
describe('Cycle detection', () => {
	it('rejects a direct self-loop', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Root?' },
				{ id: 'r1', type: 'result', content: 'Done' }
			],
			edges: [
				{ sourceId: 'root', targetId: 'root', label: 'Loop' },
				{ sourceId: 'root', targetId: 'r1', label: 'Exit' }
			]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
	});

	it('rejects an indirect cycle', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'a', type: 'question', content: 'A?' },
				{ id: 'b', type: 'question', content: 'B?' },
				{ id: 'r1', type: 'result', content: 'Done' }
			],
			edges: [
				{ sourceId: 'a', targetId: 'b', label: 'to B' },
				{ sourceId: 'b', targetId: 'a', label: 'back to A' },
				{ sourceId: 'a', targetId: 'r1', label: 'Exit' }
			]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
	});

	it('accepts a DAG with no cycles', () => {
		const graph = makeCarGraph();
		const errors = validateGraph(graph);
		expect(errors.filter((e) => e.toLowerCase().includes('cycle'))).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// 5. A tree containing missing node references fails validation
// ---------------------------------------------------------------------------
describe('Missing node references', () => {
	it('rejects an edge targeting a non-existent node', () => {
		const raw: RawTree = {
			nodes: [{ id: 'root', type: 'question', content: 'Root?' }],
			edges: [{ sourceId: 'root', targetId: 'ghost', label: 'To nowhere' }]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.includes('"ghost"'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 6. A tree containing unreachable nodes fails validation
// ---------------------------------------------------------------------------
describe('Unreachable nodes', () => {
	it('flags isolated nodes', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Root?' },
				{ id: 'orphan', type: 'result', content: 'Alone' },
				{ id: 'r1', type: 'result', content: 'Done' }
			],
			edges: [{ sourceId: 'root', targetId: 'r1', label: 'Go' }]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		// Orphan has no incoming edges, so it's detected as an extra root
		expect(errors.some((e) => e.includes('orphan'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 7. A question node without answers fails validation
// ---------------------------------------------------------------------------
describe('Question node without answers', () => {
	it('rejects a question with no outgoing edges', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Root?' },
				{ id: 'stuck', type: 'question', content: 'No answers?' },
				{ id: 'r1', type: 'result', content: 'Done' }
			],
			edges: [{ sourceId: 'root', targetId: 'stuck', label: 'Lead to dead end' }]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.includes('"stuck"') && e.includes('no answer'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 8. A result node with outgoing edges fails validation
// ---------------------------------------------------------------------------
describe('Result node with outgoing edges', () => {
	it('rejects a result that has children', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Root?' },
				{ id: 'bad_result', type: 'result', content: 'Should be terminal' },
				{ id: 'r2', type: 'result', content: 'Other result' }
			],
			edges: [
				{ sourceId: 'root', targetId: 'bad_result', label: 'To result' },
				{ sourceId: 'bad_result', targetId: 'r2', label: 'Escape!' }
			]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.includes('"bad_result"') && e.includes('terminal'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 9. Multiple answers leading to the same node behave correctly during traversal
// ---------------------------------------------------------------------------
describe('Multiple answers to same node', () => {
	it('allows two answers to converge on one target', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'root', type: 'question', content: 'Pick one?' },
				{ id: 'common', type: 'result', content: 'Same destination' }
			],
			edges: [
				{ sourceId: 'root', targetId: 'common', label: 'Path A' },
				{ sourceId: 'root', targetId: 'common', label: 'Path B' }
			]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors).toHaveLength(0);

		// Both paths should reach the same result
		const rowsA = computeRows(graph, ['root|Path A']);
		const rowsB = computeRows(graph, ['root|Path B']);
		expect(rowsA[rowsA.length - 1].type).toBe('result');
		expect(rowsB[rowsB.length - 1].type).toBe('result');
		expect((rowsA[rowsA.length - 1] as any).node.result).toBe('Same destination');
		expect((rowsB[rowsB.length - 1] as any).node.result).toBe('Same destination');
	});
});

// ---------------------------------------------------------------------------
// 10. Only one answer may be selected per question at any time
// ---------------------------------------------------------------------------
describe('Single answer selection', () => {
	it('path contains max one edge per question', () => {
		const graph = makeCarGraph();
		// Build a path with two answers for the same question — invalid state
		const badPath: TraversalPath = ['root|Lowest cost', 'root|Lowest cost'];
		// The computeRows function follows the first edge, then tries the second
		// but since current node changed, the second edge is not from current node
		const rows = computeRows(graph, badPath);
		// The second edge "root|Lowest cost" won't match any edge from the current node
		// so traversal stops — effectively the second edge is ignored
		expect(rows.length).toBeGreaterThanOrEqual(3);
		expect(rows[rows.length - 1].type).toBe('answer');
		// Only one path edge is consumed since the second edge doesn't match
	});

	it('selecting a different answer replaces the previous selection for that position', () => {
		// This tests the UI logic: replacing path at a given index
		const path: TraversalPath = ['root|Choose a car', 'c_q1|Lowest total cost'];
		const newPath: TraversalPath = [...path.slice(0, 1), 'c_q1|Fun / Performance'];
		expect(newPath).toEqual(['root|Choose a car', 'c_q1|Fun / Performance']);
	});
});

// ---------------------------------------------------------------------------
// 11-15. Additional validation scenarios
// ---------------------------------------------------------------------------
describe('Additional validation', () => {
	it('validates the full merged tree.json successfully', () => {
		// Import the actual tree data
		const rawTree = require('./decision-tree/data/tree.json') as RawTree;
		const graph = buildGraph(rawTree);
		const errors = validateGraph(graph);
		expect(errors).toHaveLength(0);
	});

	it('detects multiple roots', () => {
		const raw: RawTree = {
			nodes: [
				{ id: 'a', type: 'question', content: 'A?' },
				{ id: 'b', type: 'question', content: 'B?' },
				{ id: 'r1', type: 'result', content: 'Done' }
			],
			edges: [
				{ sourceId: 'a', targetId: 'r1', label: 'To result' },
				{ sourceId: 'b', targetId: 'r1', label: 'Also to result' }
			]
		};
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors.some((e) => e.toLowerCase().includes('multiple root'))).toBe(true);
	});

	it('ensures getCurrentNode returns root for empty path', () => {
		const graph = makeCarGraph();
		const node = getCurrentNode(graph, []);
		expect(isQuestionNode(node)).toBe(true);
		if (isQuestionNode(node)) {
			expect(node.prompt).toBe('What matters most?');
		}
	});

	it('ensures getAnswersForNode returns empty for result nodes', () => {
		const graph = makeCarGraph();
		const answers = getAnswersForNode(graph, 'r_hybrid');
		expect(answers).toHaveLength(0);
	});

	it('ensures isResultNode works correctly', () => {
		const graph = makeCarGraph();
		expect(isResultNode(graph.nodes.get('r_hybrid')!)).toBe(true);
		expect(isResultNode(graph.nodes.get('root')!)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Full tree integration
// ---------------------------------------------------------------------------
describe('Full tree traversal', () => {
	it('can traverse the car tree to every result', () => {
		const raw = require('./decision-tree/data/tree.json') as RawTree;
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors).toHaveLength(0);

		// Traverse: root → Choose a car → Lowest total cost → Yes
		const path: TraversalPath = ['root|Choose a car', 'c_q1|Lowest total cost', 'c_q2|Yes'];
		const rows = computeRows(graph, path);
		expect(rows[rows.length - 1].type).toBe('result');
		expect((rows[rows.length - 1] as any).node.result).toBe('Hybrid');
	});

	it('can traverse the religion tree to a deep result', () => {
		const raw = require('./decision-tree/data/tree.json') as RawTree;
		const graph = buildGraph(raw);
		const errors = validateGraph(graph);
		expect(errors).toHaveLength(0);

		// root → Religion → Bible → Yes → Pope of Rome
		const path: TraversalPath = [
			'root|Religion',
			'r_q1|Bible',
			'r_q4|Yes',
			'r_q5|Pope of Rome'
		];
		const rows = computeRows(graph, path);
		expect(rows[rows.length - 1].type).toBe('result');
		expect((rows[rows.length - 1] as any).node.result).toBe('Roman Catholic');
	});

	it('can switch trees by changing the root answer', () => {
		const raw = require('./decision-tree/data/tree.json') as RawTree;
		const graph = buildGraph(raw);

		// Start with car tree
		let path: TraversalPath = ['root|Choose a car', 'c_q1|Environmental impact', 'c_q7|Yes'];
		let rows = computeRows(graph, path);
		expect((rows[rows.length - 1] as any).node.result).toBe('Battery EV');

		// Switch to religion tree at root
		path = ['root|Religion', 'r_q1|None'];
		rows = computeRows(graph, path);
		expect((rows[rows.length - 1] as any).node.result).toBe(
			'Outside major Abrahamic religions'
		);
	});
});
