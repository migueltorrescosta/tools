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
		// Kills the suffix template and the counter of the loop.
		model.inputs.push({ ...model.inputs[0], symbol: 'X1' });
		expect(freeSymbol(model, 'X')).toBe('X2');
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
	type Where = Parameters<typeof errorAt>[1];
	// Each location, and others that must not match it, in both directions: a different kind,
	// index, field or part, and a missing part (the default of a missing part is not part 0 or 1).
	const cases: [string, Where, Where[]][] = [
		[
			'model',
			{ kind: 'model' },
			[{ kind: 'reward' }, { kind: 'input', index: 0, field: 'symbol' }]
		],
		['reward', { kind: 'reward' }, [{ kind: 'model' }]],
		[
			'input',
			{ kind: 'input', index: 1, field: 'params', param: 0 },
			[
				{ kind: 'input', index: 0, field: 'params', param: 0 },
				{ kind: 'input', index: 1, field: 'symbol', param: 0 },
				{ kind: 'input', index: 1, field: 'params', param: 1 },
				{ kind: 'input', index: 1, field: 'params' },
				{ kind: 'input', index: 1, field: 'params', param: undefined }
			]
		],
		[
			'input with param 1',
			{ kind: 'input', index: 0, field: 'params', param: 1 },
			[{ kind: 'input', index: 0, field: 'params' }]
		],
		[
			'intermediate',
			{ kind: 'intermediate', index: 0, field: 'formula' },
			[
				{ kind: 'intermediate', index: 1, field: 'formula' },
				{ kind: 'intermediate', index: 0, field: 'symbol' }
			]
		],
		[
			'decisions',
			{ kind: 'decisions', field: 'values', index: 1 },
			[
				{ kind: 'decisions', field: 'values', index: 0 },
				{ kind: 'decisions', field: 'label', index: 1 },
				{ kind: 'decisions', field: 'values' },
				{ kind: 'decisions', field: 'values', index: undefined }
			]
		],
		['decisions without index', { kind: 'decisions', field: 'values' }, []]
	];

	// Kills the kind, index, field and part checks, and the defaults of a missing part.
	it.each(cases)('%s: finds its own error and no other', (_, where, others) => {
		const own = { where, message: 'own' };
		expect(errorAt([own], where)).toBe(own);
		for (const other of others) {
			expect(errorAt([own], other)).toBeUndefined();
			expect(errorAt([{ where: other, message: 'other' }], where)).toBeUndefined();
		}
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
