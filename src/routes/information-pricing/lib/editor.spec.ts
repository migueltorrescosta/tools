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
	treeOptions
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
