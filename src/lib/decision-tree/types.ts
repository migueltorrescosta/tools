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
}

export type TraversalPath = string[];
