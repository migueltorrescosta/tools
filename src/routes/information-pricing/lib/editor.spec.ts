import { describe, expect, it } from 'vitest';
import { compileModel } from '$lib/information-pricing/model';
import { presetModel } from '$lib/information-pricing/presets';
import {
	allFinite,
	describeLocation,
	errorAt,
	freeSymbol,
	rowIds,
	samplesProblem,
	seedProblem,
	treeOptions,
	treeErrors,
	treeValid,
	DEFAULT_TREE,
	type TreeSettings
} from './editor';

describe('editor helpers', () => {
	it('hands out unique row ids per row', () => {
		const model = presetModel('airline-share-buyback');
		const a = rowIds(model);
		const b = rowIds(model);
		expect(a.inputs).toHaveLength(7);
		expect(a.intermediates).toHaveLength(4);
		const all = [...Object.values(a).flat(), ...Object.values(b).flat()];
		expect(new Set(all).size).toBe(all.length);
	});

	it('picks the first free symbol', () => {
		const model = presetModel('blank');
		expect(freeSymbol(model, 'X')).toBe('X1');
		expect(freeSymbol(model, 'Y')).toBe('Y');
	});

	it('finds errors by field and names their place', () => {
		const model = presetModel('distribution-centre');
		model.inputs[1].params = [-1];
		model.decisions.reward = 'min(N, t*T)*P - t*Q';
		const result = compileModel(model);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		const reward = errorAt(result.errors, { kind: 'reward' });
		expect(reward?.message).toContain('Q');
		expect(reward?.start).toBe(18);
		expect(errorAt(result.errors, { kind: 'input', index: 0, field: 'symbol' })).toBeUndefined();
		expect(describeLocation(model, { kind: 'input', index: 1, field: 'params' })).toBe('Input P');
	});

	it('checks numbers, samples and seed', () => {
		const model = presetModel('blank');
		expect(allFinite(model)).toBe(true);
		model.inputs[0].params[1] = NaN;
		expect(allFinite(model)).toBe(false);
		expect(samplesProblem(100_000, 1_000_000)).toBeNull();
		expect(samplesProblem(0, 1_000_000)).not.toBeNull();
		expect(samplesProblem(1.5, 1_000_000)).not.toBeNull();
		expect(seedProblem(2026)).toBeNull();
		expect(seedProblem(0.5)).not.toBeNull();
	});

	it('turns the leaf percentage into a fraction', () => {
		expect(treeOptions({ maxDepth: 3, minLeafPercent: 1, minImpurityDecrease: 0.001 })).toEqual({
			maxDepth: 3,
			minSamplesLeaf: 0.01,
			minImpurityDecrease: 0.001
		});
	});
});

describe('errorAt / sameField', () => {
	function makeError(where: Parameters<typeof errorAt>[1], message: string) {
		return { where, message } as const;
	}

	// Kills a mutant that drops the kind check.
	it('model kind: matches same kind, rejects different kind', () => {
		const err = makeError({ kind: 'model' }, 'model error');
		expect(errorAt([err], { kind: 'model' })).toBe(err);
		expect(errorAt([err], { kind: 'reward' })).toBeUndefined();
		expect(errorAt([err], { kind: 'input', index: 0, field: 'symbol' })).toBeUndefined();
	});

	// Kills a mutant that drops the kind check.
	it('reward kind: matches same kind, rejects different kind', () => {
		const err = makeError({ kind: 'reward' }, 'reward error');
		expect(errorAt([err], { kind: 'reward' })).toBe(err);
		expect(errorAt([err], { kind: 'model' })).toBeUndefined();
	});

	// Kills a mutant that ignores index/field/param for input.
	it('input kind: matches equal index, field, param; rejects different index, field, param, or undefined vs 0', () => {
		const err = makeError({ kind: 'input', index: 1, field: 'params', param: 0 }, 'input error');
		expect(errorAt([err], { kind: 'input', index: 1, field: 'params', param: 0 })).toBe(err);
		expect(errorAt([err], { kind: 'input', index: 0, field: 'params', param: 0 })).toBeUndefined(); // different index
		expect(errorAt([err], { kind: 'input', index: 1, field: 'symbol', param: 0 })).toBeUndefined(); // different field
		expect(errorAt([err], { kind: 'input', index: 1, field: 'params', param: 1 })).toBeUndefined(); // different param
		expect(errorAt([err], { kind: 'input', index: 1, field: 'params' })).toBeUndefined(); // param undefined vs 0
		expect(
			errorAt([err], { kind: 'input', index: 1, field: 'params', param: undefined })
		).toBeUndefined(); // explicit undefined vs 0
	});

	// Kills a mutant that ignores index/field for intermediate.
	it('intermediate kind: matches equal index, field; rejects different index or field', () => {
		const err = makeError(
			{ kind: 'intermediate', index: 0, field: 'formula' },
			'intermediate error'
		);
		expect(errorAt([err], { kind: 'intermediate', index: 0, field: 'formula' })).toBe(err);
		expect(errorAt([err], { kind: 'intermediate', index: 1, field: 'formula' })).toBeUndefined(); // different index
		expect(errorAt([err], { kind: 'intermediate', index: 0, field: 'symbol' })).toBeUndefined(); // different field
	});

	// Kills a mutant that ignores index for decisions or treats undefined as 0.
	it('decisions kind: matches equal field, index; rejects different field, different index, or undefined vs 0', () => {
		const err = makeError({ kind: 'decisions', field: 'values', index: 1 }, 'decisions error');
		expect(errorAt([err], { kind: 'decisions', field: 'values', index: 1 })).toBe(err);
		expect(errorAt([err], { kind: 'decisions', field: 'values', index: 0 })).toBeUndefined(); // different index
		expect(errorAt([err], { kind: 'decisions', field: 'label', index: 1 })).toBeUndefined(); // different field
		expect(errorAt([err], { kind: 'decisions', field: 'values' })).toBeUndefined(); // index undefined vs 1
		expect(
			errorAt([err], { kind: 'decisions', field: 'values', index: undefined })
		).toBeUndefined(); // explicit undefined vs 1
	});
});

describe('treeErrors and treeValid', () => {
	// Kills a mutant that changes the boundary conditions.
	it('maxDepth: exact boundaries and message', () => {
		expect(treeErrors({ ...DEFAULT_TREE, maxDepth: 0 }).maxDepth).toBe(
			'Use a whole number from 1 to 6.'
		);
		expect(treeErrors({ ...DEFAULT_TREE, maxDepth: 1 }).maxDepth).toBeUndefined();
		expect(treeErrors({ ...DEFAULT_TREE, maxDepth: 6 }).maxDepth).toBeUndefined();
		expect(treeErrors({ ...DEFAULT_TREE, maxDepth: 7 }).maxDepth).toBe(
			'Use a whole number from 1 to 6.'
		);
		expect(treeErrors({ ...DEFAULT_TREE, maxDepth: 2.5 }).maxDepth).toBe(
			'Use a whole number from 1 to 6.'
		);
	});

	// Kills a mutant that changes the boundary conditions.
	it('minLeafPercent: exact boundaries and message', () => {
		expect(treeErrors({ ...DEFAULT_TREE, minLeafPercent: 0 }).minLeafPercent).toBe(
			'Use more than 0 and less than 50.'
		);
		expect(treeErrors({ ...DEFAULT_TREE, minLeafPercent: 0.0001 }).minLeafPercent).toBeUndefined();
		expect(treeErrors({ ...DEFAULT_TREE, minLeafPercent: 49.999 }).minLeafPercent).toBeUndefined();
		expect(treeErrors({ ...DEFAULT_TREE, minLeafPercent: 50 }).minLeafPercent).toBe(
			'Use more than 0 and less than 50.'
		);
	});

	// Kills a mutant that changes the boundary conditions.
	it('minImpurityDecrease: exact boundaries and message', () => {
		expect(treeErrors({ ...DEFAULT_TREE, minImpurityDecrease: -0.0001 }).minImpurityDecrease).toBe(
			'Use 0 or more and less than 1.'
		);
		expect(
			treeErrors({ ...DEFAULT_TREE, minImpurityDecrease: 0 }).minImpurityDecrease
		).toBeUndefined();
		expect(
			treeErrors({ ...DEFAULT_TREE, minImpurityDecrease: 0.999 }).minImpurityDecrease
		).toBeUndefined();
		expect(treeErrors({ ...DEFAULT_TREE, minImpurityDecrease: 1 }).minImpurityDecrease).toBe(
			'Use 0 or more and less than 1.'
		);
	});

	// Kills a mutant that couples the fields.
	it('each field is reported independently', () => {
		const base: TreeSettings = { ...DEFAULT_TREE };
		expect(treeErrors({ ...base, maxDepth: 0 }).maxDepth).toBeDefined();
		expect(treeErrors({ ...base, maxDepth: 0 }).minLeafPercent).toBeUndefined();
		expect(treeErrors({ ...base, maxDepth: 0 }).minImpurityDecrease).toBeUndefined();

		expect(treeErrors({ ...base, minLeafPercent: 0 }).minLeafPercent).toBeDefined();
		expect(treeErrors({ ...base, minLeafPercent: 0 }).maxDepth).toBeUndefined();
		expect(treeErrors({ ...base, minLeafPercent: 0 }).minImpurityDecrease).toBeUndefined();

		expect(treeErrors({ ...base, minImpurityDecrease: -1 }).minImpurityDecrease).toBeDefined();
		expect(treeErrors({ ...base, minImpurityDecrease: -1 }).maxDepth).toBeUndefined();
		expect(treeErrors({ ...base, minImpurityDecrease: -1 }).minLeafPercent).toBeUndefined();
	});

	// Kills a mutant that inverts the logic.
	it('treeValid: true for DEFAULT_TREE, false when any field is bad', () => {
		expect(treeValid(DEFAULT_TREE)).toBe(true);
		expect(treeValid({ ...DEFAULT_TREE, maxDepth: 0 })).toBe(false);
		expect(treeValid({ ...DEFAULT_TREE, minLeafPercent: 0 })).toBe(false);
		expect(treeValid({ ...DEFAULT_TREE, minImpurityDecrease: -1 })).toBe(false);
	});
});
