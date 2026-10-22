/**
 * Full analysis of a scenario set: loss summary, value of information,
 * optimal decision per quantile group, input densities, loss distributions
 * and the policy tree. Builds the loss matrix and the sorted inputs once.
 */

import type { Scenarios } from '../types';
import {
	lossDistributions,
	type DistributionOptions,
	type LossDistribution
} from './distributions';
import {
	inputDensity,
	optimalDecisionPerGroup,
	type GroupTable,
	type InputDensity
} from './groups';
import { lossSummary, type LossSummary } from './losses';
import { lossMatrix, sortedCopy } from './numeric';
import { buildPolicyTree, PolicyTreeError, type PolicyTree, type TreeOptions } from './tree';
import { policyTreeView, type PolicyTreeView } from './tree-view';
import { DEFAULT_BINS, valueOfInformation, type ValueOfInformation } from './voi';

export * from './distributions';
export * from './format';
export * from './groups';
export * from './losses';
export * from './numeric';
export * from './tree';
export * from './tree-view';
export * from './voi';

export interface AnalysisOptions {
	/** Native monetary unit, e.g. `€`. */
	unit: string;
	/** Bin counts for the value of information. Default 2–10. */
	bins?: number[];
	/** Quantile groups per input for the optimal-decision plot. Default 10. */
	groupBins?: number;
	tree?: TreeOptions;
	distributions?: DistributionOptions;
}

export interface Analysis {
	summary: LossSummary;
	valueOfInformation: ValueOfInformation;
	/** Per input, model order. */
	groups: GroupTable[];
	/** Per input, model order. */
	densities: InputDensity[];
	/** Per decision, model order. */
	distributions: LossDistribution[];
	/** Null with the reason when no tree can be grown (e.g. zero held-out risk). */
	tree: { tree: PolicyTree; view: PolicyTreeView } | { error: string };
	/** Milliseconds per stage. */
	timings: Record<string, number>;
}

/** Run every analysis on the scenarios. */
export function analyse(s: Scenarios, options: AnalysisOptions): Analysis {
	const timings: Record<string, number> = {};
	let mark = performance.now();
	const lap = (name: string) => {
		const now = performance.now();
		timings[name] = now - mark;
		mark = now;
	};
	const D = s.rewards.length;
	const loss = lossMatrix(s);
	const columns = s.inputs.map((input) => input.column);
	const sorted = columns.map(sortedCopy);
	lap('prepare');
	const summary = lossSummary(s, options.unit, loss);
	lap('summary');
	const voi = valueOfInformation(
		columns,
		loss,
		D,
		summary.expectedLoss[summary.best],
		options.bins ?? DEFAULT_BINS,
		sorted
	);
	lap('valueOfInformation');
	const groupBins = options.groupBins ?? 10;
	const groups = columns.map((c, j) => optimalDecisionPerGroup(c, loss, D, groupBins, sorted[j]));
	lap('groups');
	const densities = columns.map((c, j) => inputDensity(c, sorted[j]));
	lap('densities');
	const distributions = lossDistributions(loss, D, options.distributions);
	lap('distributions');
	let tree: Analysis['tree'];
	try {
		const t = buildPolicyTree(columns, loss, D, options.tree);
		tree = {
			tree: t,
			view: policyTreeView(t, {
				decisions: s.decisions,
				inputs: s.inputs.map((i) => i.symbol),
				unit: options.unit
			})
		};
	} catch (err) {
		if (!(err instanceof PolicyTreeError)) throw err;
		tree = { error: err.message };
	}
	lap('tree');
	return { summary, valueOfInformation: voi, groups, densities, distributions, tree, timings };
}
