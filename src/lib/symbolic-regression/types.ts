/** Shared types for the symbolic regression tool. No DOM or Svelte imports. */

export type BinaryOp = 'add' | 'sub' | 'mul' | 'div' | 'pow';
export type UnaryOp = 'square' | 'cube' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'abs';
export type OperatorName = BinaryOp | UnaryOp;

export const BINARY_OPS: readonly BinaryOp[] = ['add', 'sub', 'mul', 'div', 'pow'];
export const UNARY_OPS: readonly UnaryOp[] = [
	'square',
	'cube',
	'sqrt',
	'exp',
	'log',
	'sin',
	'cos',
	'abs'
];
export const ALL_OPERATORS: readonly OperatorName[] = [...BINARY_OPS, ...UNARY_OPS];
export const DEFAULT_OPERATORS: readonly OperatorName[] = ['add', 'sub', 'mul', 'div'];

/** An expression tree. `var` indexes into the input columns. Complexity is the node count. */
export type Expr =
	| { kind: 'const'; value: number }
	| { kind: 'var'; index: number }
	| { kind: 'unary'; op: UnaryOp; child: Expr }
	| { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr };

/** Columnar numeric data: `x[j][i]` is input j on row i, `y[i]` the target. */
export interface Dataset {
	x: Float64Array[];
	y: Float64Array;
}

/** Data handed to an engine: the split is already made (see `splitDataset`). */
export interface PreparedData {
	/** Input column names, in the order `var` indices refer to. */
	inputNames: string[];
	targetName: string;
	train: Dataset;
	validation: Dataset;
}

export interface SearchSettings {
	operators: OperatorName[];
	seed: number;
	/** Number of island workers (the single-thread runner ignores it). */
	workers: number;
	/** Wall-clock budget for one start or continue, in seconds. */
	timeBudgetSec: number;
	/** Fraction of rows held out for validation, in (0, 1). */
	validationFraction: number;
	/** Rows per mini-batch; the full train set is used when it is smaller. */
	batchSize: number;
	populationSize: number;
	maxComplexity: number;
}

export const DEFAULT_SETTINGS: SearchSettings = {
	operators: [...DEFAULT_OPERATORS],
	seed: 1,
	workers: 1,
	timeBudgetSec: 60,
	validationFraction: 0.2,
	batchSize: 2000,
	populationSize: 200,
	maxComplexity: 25
};

/** One row of the Pareto front: the best expression found at this complexity. */
export interface FrontEntry {
	complexity: number;
	expr: Expr;
	/** MSE on the full train set, after constant refitting. */
	trainMse: number;
	valMse: number;
	valR2: number;
	valRmse: number;
	/** −Δlog(valMse)/Δcomplexity against the previous front entry; 0 for the first. */
	score: number;
}

export type SearchEvent =
	| {
			type: 'progress';
			/** Sorted by complexity, ascending. */
			front: FrontEntry[];
			iterations: number;
			elapsedMs: number;
	  }
	| { type: 'stopped'; reason: 'budget' | 'user'; front: FrontEntry[] }
	| { type: 'error'; message: string };

/**
 * A search back end. The UI only talks to this interface, so a WASM engine can
 * replace the TypeScript one without UI changes.
 */
export interface SearchEngine {
	/** Start a fresh search; discards any previous populations. */
	start(data: PreparedData, settings: SearchSettings): void;
	/** Stop the running search; populations are kept for `continue`. */
	stop(): void;
	/** Resume from the current populations for another time budget. */
	continue(): void;
	/** Subscribe to events; returns an unsubscribe function. */
	subscribe(listener: (event: SearchEvent) => void): () => void;
	/** Terminate workers and drop all state. */
	dispose(): void;
	readonly running: boolean;
}
