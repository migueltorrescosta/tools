/**
 * Full analysis of a scenario set: loss summary, value of information,
 * optimal decision per quantile group, densities and profit share of the
 * inputs and of the decision-independent intermediates, loss distributions
 * and the policy tree. It comes in three parts, so workers can deliver them
 * as they complete: `analyseMain` (summary, groups, densities, profit share,
 * loss distributions), `analyseVoi` (value of information) and `analyseTree`
 * (the policy tree, which needs only the inputs and the loss matrix).
 */

import type { Scenarios } from '../types';
import { lossDistributions, type LossDistribution } from './distributions';
import {
	inputDensity,
	optimalDecisionPerGroup,
	qcut,
	type GroupTable,
	type InputDensity
} from './groups';
import { lossSummary, type LossSummary } from './losses';
import { lossMatrix, sortedCopy } from './numeric';
import { profitShare } from './share';
import { buildPolicyTree, PolicyTreeError, type PolicyTree, type TreeOptions } from './tree';
import { policyTreeView, type PolicyTreeView } from './tree-view';
import { DEFAULT_BINS, valueOfInformation, type ValueOfInformation } from './voi';

export * from './distributions';
export * from './format';
export * from './groups';
export * from './losses';
export * from './numeric';
export * from './share';
export * from './tree';
export * from './tree-view';
export * from './voi';

export interface AnalysisOptions {
	/** Native monetary unit, e.g. `€`. */
	unit: string;
	tree?: TreeOptions;
}

/** Quantile groups (10) of a column set. */
const GROUP_BINS = 10;

/** Per-column results of a set of columns (the inputs, or the intermediates), column order. */
export interface ColumnAnalysis {
	/** Optimal decision per decile group. */
	groups: GroupTable[];
	densities: InputDensity[];
	/** Share of the recommended decision's (`summary.best`) reward variance each column explains. */
	profitShare: number[];
}

/** The policy tree, or the reason none can be grown (e.g. zero held-out risk). */
export type TreeResult = { tree: PolicyTree; view: PolicyTreeView } | { error: string };

export interface Analysis extends ColumnAnalysis {
	summary: LossSummary;
	/** Of the inputs (model order); `order` ranks them. */
	valueOfInformation: ValueOfInformation;
	/** Per decision, model order. */
	distributions: LossDistribution[];
	/** The decision-independent intermediates (`Scenarios.intermediates` order), analysed as the inputs are. */
	intermediates: ColumnAnalysis & { valueOfInformation: ValueOfInformation };
	tree: TreeResult;
}

/** Part 1: everything but the value of information and the tree. */
export type MainPart = Omit<Analysis, 'valueOfInformation' | 'tree' | 'intermediates'> & {
	intermediates: ColumnAnalysis;
};

/** Part 2: the value of information of the inputs and the intermediates. */
export interface VoiPart {
	valueOfInformation: ValueOfInformation;
	intermediates: { valueOfInformation: ValueOfInformation };
}

/** An analysis while a run is in flight: the main part, the rest as it arrives. */
export type PartialAnalysis = Omit<Analysis, 'valueOfInformation' | 'tree' | 'intermediates'> & {
	valueOfInformation?: ValueOfInformation;
	intermediates: ColumnAnalysis & { valueOfInformation?: ValueOfInformation };
	tree?: TreeResult;
};

/** Merge the parts received so far; null until the main part is in. */
export function mergeParts(
	main: MainPart | null,
	voi: VoiPart | null,
	tree: TreeResult | null
): PartialAnalysis | null {
	if (!main) return null;
	return {
		...main,
		...(voi ? { valueOfInformation: voi.valueOfInformation } : {}),
		intermediates: {
			...main.intermediates,
			...(voi ? { valueOfInformation: voi.intermediates.valueOfInformation } : {})
		},
		...(tree ? { tree } : {})
	};
}

/** What the parts share: the loss matrix and sorted copies of every column. */
export interface AnalysisContext {
	D: number;
	loss: Float64Array;
	inputs: Float64Array[];
	sortedInputs: Float64Array[];
	intermediates: Float64Array[];
	sortedIntermediates: Float64Array[];
}

export function analysisContext(s: Scenarios): AnalysisContext {
	const inputs = s.inputs.map((x) => x.column);
	const intermediates = s.intermediates.map((x) => x.column);
	return {
		D: s.rewards.length,
		loss: lossMatrix(s),
		inputs,
		sortedInputs: inputs.map(sortedCopy),
		intermediates,
		sortedIntermediates: intermediates.map(sortedCopy)
	};
}

function columnAnalysis(
	columns: Float64Array[],
	sorted: Float64Array[],
	ctx: AnalysisContext,
	reward: Float64Array
): ColumnAnalysis {
	const out: ColumnAnalysis = { groups: [], densities: [], profitShare: [] };
	columns.forEach((c, j) => {
		const g = qcut(c, GROUP_BINS, sorted[j]);
		out.groups.push(optimalDecisionPerGroup(c, ctx.loss, ctx.D, GROUP_BINS, sorted[j], g));
		out.densities.push(inputDensity(c, sorted[j]));
		out.profitShare.push(profitShare(g.codes, g.count, reward));
	});
	return out;
}

/** Part 1: summary, loss distributions, and groups, densities and profit share per column. */
export function analyseMain(s: Scenarios, unit: string, ctx: AnalysisContext): MainPart {
	const summary = lossSummary(s, unit, ctx.loss);
	const reward = s.rewards[summary.best];
	return {
		summary,
		...columnAnalysis(ctx.inputs, ctx.sortedInputs, ctx, reward),
		distributions: lossDistributions(ctx.loss, ctx.D),
		intermediates: columnAnalysis(ctx.intermediates, ctx.sortedIntermediates, ctx, reward)
	};
}

/**
 * Part 2: value of information (bins 2–10, cross-validated) of the inputs and
 * the intermediates. `progress` hears the columns done of all of them.
 */
export function analyseVoi(
	ctx: AnalysisContext,
	summary: LossSummary,
	progress?: (done: number, total: number) => void
): VoiPart {
	const baseline = summary.expectedLoss[summary.best];
	const total = ctx.inputs.length + ctx.intermediates.length;
	const at = (offset: number) => progress && ((done: number) => progress(offset + done, total));
	return {
		valueOfInformation: valueOfInformation(
			ctx.inputs,
			ctx.loss,
			ctx.D,
			baseline,
			DEFAULT_BINS,
			ctx.sortedInputs,
			at(0)
		),
		intermediates: {
			valueOfInformation: valueOfInformation(
				ctx.intermediates,
				ctx.loss,
				ctx.D,
				baseline,
				DEFAULT_BINS,
				ctx.sortedIntermediates,
				at(ctx.inputs.length)
			)
		}
	};
}

/** Part 3: the policy tree over the inputs, with its view. */
export function analyseTree(
	inputs: Float64Array[],
	loss: Float64Array,
	decisions: string[],
	options: AnalysisOptions,
	progress?: (fraction: number) => void
): TreeResult {
	try {
		const tree = buildPolicyTree(inputs, loss, decisions.length, options.tree, progress);
		return { tree, view: policyTreeView(tree, { decisions, unit: options.unit }) };
	} catch (err) {
		if (!(err instanceof PolicyTreeError)) throw err;
		return { error: err.message };
	}
}

/** Run every analysis on the scenarios, in one thread. */
export function analyse(s: Scenarios, options: AnalysisOptions): Analysis {
	const ctx = analysisContext(s);
	const main = analyseMain(s, options.unit, ctx);
	const voi = analyseVoi(ctx, main.summary);
	const tree = analyseTree(ctx.inputs, ctx.loss, s.decisions, options);
	return mergeParts(main, voi, tree) as Analysis;
}
