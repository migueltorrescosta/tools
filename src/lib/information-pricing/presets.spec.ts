import { describe, expect, it } from 'vitest';
import { validateParams } from './distributions';
import { PRESETS, matchPreset, presetModel } from './presets';

describe('presets', () => {
	it('lists the three presets by display name', () => {
		expect(PRESETS.map((p) => [p.id, p.name])).toEqual([
			['distribution-centre', 'Distribution centre'],
			['airline-share-buyback', 'Airline share buyback'],
			['blank', 'Blank']
		]);
	});

	it('has valid parameters, unique symbols and n = 100,000', () => {
		for (const { model } of PRESETS) {
			for (const input of model.inputs) {
				expect(validateParams(input.family, input.params)).toEqual([]);
			}
			const symbols = [
				...model.inputs.map((x) => x.symbol),
				...model.intermediates.map((x) => x.symbol),
				model.decisions.symbol
			];
			expect(new Set(symbols).size).toBe(symbols.length);
			expect(model.samples).toBe(100_000);
			expect(model.decisions.values.length).toBeGreaterThan(0);
			expect(model.decisions.label).toContain(`{${model.decisions.symbol}}`);
		}
	});

	it('lists the fixed inputs after the random ones', () => {
		const fixed = (id: 'distribution-centre' | 'airline-share-buyback') =>
			presetModel(id).inputs.map((x) => (x.family === 'fixed' ? x.symbol : '-'));
		expect(fixed('distribution-centre')).toEqual(['-', '-', '-', 'T']);
		expect(fixed('airline-share-buyback')).toEqual(['-', '-', '-', '-', '-', '-', 'C0']);
		expect(presetModel('distribution-centre').inputs[3]).toEqual({
			symbol: 'T',
			name: 'Packages per Truck per Year',
			family: 'fixed',
			params: [100_000]
		});
	});

	it('matches each preset and reports edits as custom', () => {
		for (const { id } of PRESETS) {
			const model = presetModel(id);
			expect(matchPreset(model)).toBe(id);
			model.inputs[0].params[0] += 1;
			expect(matchPreset(model)).toBeNull();
		}
		const reordered = presetModel('blank');
		reordered.decisions = { ...reordered.decisions, values: [1, 0] };
		expect(matchPreset(reordered)).toBeNull();
		const seed = presetModel('airline-share-buyback');
		seed.seed = 1;
		expect(matchPreset(seed)).toBeNull();
	});

	it('hands out independent copies', () => {
		const a = presetModel('distribution-centre');
		a.decisions.values.push(13);
		expect(presetModel('distribution-centre').decisions.values).toEqual([30, 40, 50, 60, 70]);
	});
});
