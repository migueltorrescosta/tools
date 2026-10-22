/**
 * Shared types for the Information Pricing tool (a port of babslell's
 * `ExpectedOpportunityLoss`). No DOM or Svelte imports.
 */

/** Distribution families a random input can take. */
export type Family =
	| 'normal'
	| 'lognormal'
	| 'uniform'
	| 'exponential'
	| 'triangular'
	| 'binomial'
	| 'poisson'
	| 'beta';

/**
 * Raw parameters per family, in this order:
 * normal (μ, σ), lognormal (median, σ), uniform (low, high), exponential (mean),
 * triangular (low, mode, high), binomial (n, p), poisson (λ), beta (α, β).
 */
export interface RandomInput {
	symbol: string;
	/** Display name; may be empty. */
	name: string;
	family: Family;
	params: number[];
}

export interface Constant {
	symbol: string;
	value: number;
	/** Display name; may be empty. */
	name: string;
}

/** A named formula over inputs, constants, other intermediates and the decision symbol. */
export interface Intermediate {
	symbol: string;
	/** Display name; may be empty. */
	name: string;
	formula: string;
}

export interface Decisions {
	/** The decision symbol the reward and intermediates may use, e.g. `t`. */
	symbol: string;
	/** One decision per value. */
	values: number[];
	/** Label template, `{t}` replaced by the value, e.g. `{t} trucks`. */
	label: string;
	/** Reward formula; higher is better. */
	reward: string;
	/** Native monetary unit, e.g. `€` or `M€`; may be empty. */
	unit: string;
}

/** Everything the user edits; what the share link and autosave hold. */
export interface Model {
	inputs: RandomInput[];
	constants: Constant[];
	intermediates: Intermediate[];
	decisions: Decisions;
	seed: number;
	/** Scenarios drawn by Run (default 100,000, max 1,000,000). */
	samples: number;
}

export const DEFAULT_SAMPLES = 100_000;
export const MAX_SAMPLES = 1_000_000;

/**
 * Simulated scenarios in columns, the analysis input. Row i of every column is
 * one scenario. Opportunity losses are not stored: the loss of decision d on
 * row i is `optimal[i] - rewards[d][i]` (always ≥ 0).
 */
export interface Scenarios {
	n: number;
	/** Random inputs, in model order. */
	inputs: { symbol: string; column: Float64Array }[];
	/** Decision-independent intermediates, in evaluation order. */
	intermediates: { symbol: string; column: Float64Array }[];
	/** Decision labels, in model order (`label` with the value substituted). */
	decisions: string[];
	/** `rewards[d]` is decision d's reward column. */
	rewards: Float64Array[];
	/** Per-row maximum reward. */
	optimal: Float64Array;
}
