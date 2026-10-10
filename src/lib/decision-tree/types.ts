export interface QuestionNode {
	id: string;
	type: 'question';
	prompt: string;
}

export interface ResultNode {
	id: string;
	type: 'result';
	result: string;
}

export type Node = QuestionNode | ResultNode;

export interface AnswerEdge {
	id: string;
	sourceId: string;
	targetId: string;
	label: string;
	explanation?: string;
}

export interface RawNode {
	id: string;
	type: 'question' | 'result';
	content: string;
}

export interface RawEdge {
	sourceId: string;
	targetId: string;
	label: string;
	explanation?: string | null;
}

export interface RawTree {
	nodes: RawNode[];
	edges: RawEdge[];
}

export interface DecisionGraph {
	nodes: Map<string, Node>;
	edges: Map<string, AnswerEdge>;
	edgesBySource: Map<string, AnswerEdge[]>;
	rootNodeId: string;
	/** Edges dropped because an earlier answer from the same node has the same label (id). */
	duplicateEdges: AnswerEdge[];
	/** Ids of nodes dropped because an earlier node has the same id. */
	duplicateNodeIds: string[];
}

export type TraversalPath = string[];
