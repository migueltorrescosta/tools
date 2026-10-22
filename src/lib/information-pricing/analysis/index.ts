/**
 * Full analysis of a scenario set: loss summary, value of information,
 * optimal decision per quantile group, input densities, loss distributions
 * and the policy tree. Builds the loss matrix and the sorted inputs once.
 */

import type { Scenarios } from '../types';
import { lossDistributions, type LossDistribution } from './distributions';
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
	tree?: TreeOptions;
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
}

/** Run every analysis on the scenarios. */
export function analyse(s: Scenarios, options: AnalysisOptions): Analysis {
	const D = s.rewards.length;
	const loss = lossMatrix(s);
	const columns = s.inputs.map((input) => input.column);
	const sorted = columns.map(sortedCopy);
	const summary = lossSummary(s, options.unit, loss);
	const voi = valueOfInformation(
		columns,
		loss,
		D,
		summary.expectedLoss[summary.best],
		DEFAULT_BINS,
		sorted
	);
	const groups = columns.map((c, j) => optimalDecisionPerGroup(c, loss, D, 10, sorted[j]));
	const densities = columns.map((c, j) => inputDensity(c, sorted[j]));
	const distributions = lossDistributions(loss, D);
	let tree: Analysis['tree'];
	try {
		const t = buildPolicyTree(columns, loss, D, options.tree);
		tree = {
			tree: t,
			view: policyTreeView(t, {
				decisions: s.decisions,
				unit: options.unit
			})
		};
	} catch (err) {
		if (!(err instanceof PolicyTreeError)) throw err;
		tree = { error: err.message };
	}
	return { summary, valueOfInformation: voi, groups, densities, distributions, tree };
}
