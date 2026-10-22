/**
 * Editor helpers for the Information Pricing page: stable row ids, fresh
 * symbols for new rows and lookups of model errors by field.
 */
import type { ErrorLocation, ModelError } from '$lib/information-pricing/model';
import type { TreeOptions } from '$lib/information-pricing/analysis';
import { DEFAULT_TREE_OPTIONS } from '$lib/information-pricing/analysis/tree';
import type { Model } from '$lib/information-pricing/types';

/** Row ids kept beside the model (never in it), so `{#each}` keys survive edits. */
export interface RowIds {
	inputs: number[];
	intermediates: number[];
	values: number[];
}

let nextId = 1;

/** `n` ids never handed out before. */
export function freshIds(n: number): number[] {
	return Array.from({ length: n }, () => nextId++);
}

/** Fresh ids for every row of `model`. */
export function rowIds(model: Model): RowIds {
	return {
		inputs: freshIds(model.inputs.length),
		intermediates: freshIds(model.intermediates.length),
		values: freshIds(model.decisions.values.length)
	};
}

/** Every declared symbol, in model order, the decision symbol last. */
export function declaredSymbols(model: Model): string[] {
	return [
		...model.inputs.map((i) => i.symbol),
		...model.intermediates.map((m) => m.symbol),
		model.decisions.symbol
	];
}

/** The first of `prefix`, `prefix1`, `prefix2`, … that `model` does not declare. */
export function freeSymbol(model: Model, prefix: string): string {
	const used = new Set(declaredSymbols(model));
	if (!used.has(prefix)) return prefix;
	for (let k = 1; ; k++) if (!used.has(`${prefix}${k}`)) return `${prefix}${k}`;
}

/** Whether two error locations name the same field (and parameter or value, when given). */
function sameField(a: ErrorLocation, b: ErrorLocation): boolean {
	if (a.kind !== b.kind) return false;
	switch (a.kind) {
		case 'model':
		case 'reward':
			return true;
		case 'input': {
			const o = b as typeof a;
			return a.index === o.index && a.field === o.field && (a.param ?? -1) === (o.param ?? -1);
		}
		case 'intermediate': {
			const o = b as typeof a;
			return a.index === o.index && a.field === o.field;
		}
		case 'decisions': {
			const o = b as typeof a;
			return a.field === o.field && (a.index ?? -1) === (o.index ?? -1);
		}
	}
}

/** The first error at `where`, if any. */
export function errorAt(
	errors: readonly ModelError[],
	where: ErrorLocation
): ModelError | undefined {
	return errors.find((e) => sameField(e.where, where));
}

/** Where an error sits, in words, for the summary next to Run. */
export function describeLocation(model: Model, where: ErrorLocation): string {
	const sym = (s: string | undefined, kind: string, index: number) =>
		s ? `${kind} ${s}` : `${kind} ${index + 1}`;
	switch (where.kind) {
		case 'model':
			return 'Model';
		case 'input':
			return sym(model.inputs[where.index]?.symbol, 'Input', where.index);
		case 'intermediate':
			return sym(model.intermediates[where.index]?.symbol, 'Intermediate', where.index);
		case 'reward':
			return 'Reward';
		case 'decisions':
			return 'Decisions';
	}
}

/** True when every number in the model is finite (it then round-trips through JSON). */
export function allFinite(model: Model): boolean {
	return (
		model.inputs.every((i) => i.params.every(Number.isFinite)) &&
		model.decisions.values.every(Number.isFinite) &&
		Number.isFinite(model.seed) &&
		Number.isFinite(model.samples)
	);
}

/** Why `samples` cannot be used, or null. */
export function samplesProblem(samples: number, max: number): string | null {
	if (!Number.isInteger(samples) || samples < 1 || samples > max)
		return `Use a whole number from 1 to ${max.toLocaleString('en')}.`;
	return null;
}

/** Why `seed` cannot be used, or null. */
export function seedProblem(seed: number): string | null {
	return Number.isSafeInteger(seed) ? null : 'Use a whole number.';
}

/** Policy-tree settings as the page edits them. */
export interface TreeSettings {
	maxDepth: number;
	/** Minimum leaf size, percent of all scenarios. */
	minLeafPercent: number;
	/** Minimum risk reduction per split, as a share of the root's loss. */
	minImpurityDecrease: number;
}

export const DEFAULT_TREE: TreeSettings = {
	maxDepth: DEFAULT_TREE_OPTIONS.maxDepth,
	minLeafPercent: DEFAULT_TREE_OPTIONS.minSamplesLeaf * 100,
	minImpurityDecrease: DEFAULT_TREE_OPTIONS.minImpurityDecrease
};

/** Why each tree setting cannot be used; undefined for a usable one. */
export function treeErrors(t: TreeSettings): Record<keyof TreeSettings, string | undefined> {
	return {
		maxDepth:
			Number.isInteger(t.maxDepth) && t.maxDepth >= 1 && t.maxDepth <= 6
				? undefined
				: 'Use a whole number from 1 to 6.',
		minLeafPercent:
			t.minLeafPercent > 0 && t.minLeafPercent < 50
				? undefined
				: 'Use more than 0 and less than 50.',
		minImpurityDecrease:
			t.minImpurityDecrease >= 0 && t.minImpurityDecrease < 1
				? undefined
				: 'Use 0 or more and less than 1.'
	};
}

/** Whether every tree setting is usable. */
export const treeValid = (t: TreeSettings) =>
	Object.values(treeErrors(t)).every((e) => e === undefined);

/** The analysis' tree options for the page's settings. */
export function treeOptions(t: TreeSettings): TreeOptions {
	return {
		maxDepth: t.maxDepth,
		minSamplesLeaf: t.minLeafPercent / 100,
		minImpurityDecrease: t.minImpurityDecrease
	};
}

/** Dataflow node ids for table rows, from the stable row ids. */
export const inputNode = (id: number) => `input-${id}`;
export const intermediateNode = (id: number) => `intermediate-${id}`;
