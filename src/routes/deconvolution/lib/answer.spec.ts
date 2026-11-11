import { describe, expect, it } from 'vitest';
import type { ParamEstimate } from '#lib/deconvolution/mle.js';
import { fitSentence, massMoments, methodList, partText } from './answer';

const est = (label: string, value: number, over: Partial<ParamEstimate> = {}): ParamEstimate => ({
	role: 'signal',
	component: null,
	key: label,
	label,
	value,
	lower: NaN,
	upper: NaN,
	fitted: true,
	...over
});

describe('fitSentence', () => {
	it('names the signal and the fitted noise with their estimates', () => {
		const s = fitSentence([{ name: 'Gamma', params: [est('k', 3.137), est('θ', 0.9712)] }], {
			name: 'Laplace',
			params: [est('b', 0.4213, { role: 'noise' })]
		});
		expect(s.x).toBe('Gamma (k ≈ 3.1, θ ≈ 0.97)');
		expect(s.noise).toEqual({ verb: 'like', text: 'Laplace (b ≈ 0.42)' });
	});

	it('says a noise held fixed is held, with =', () => {
		const s = fitSentence([{ name: 'Normal', params: [est('μ', 1)] }], {
			name: 'Normal',
			params: [est('σ', 0.5, { role: 'noise', fitted: false })]
		});
		expect(s.noise).toEqual({ verb: 'held at', text: 'Normal (σ = 0.5)' });
	});

	it('reads a mixture as its shares, without the weights as parameters', () => {
		const s = fitSentence(
			[
				{ name: 'Normal', weight: 0.3, params: [est('w', 0.3, { key: 'weight' }), est('μ', -2)] },
				{ name: 'Normal', weight: 0.7, params: [est('μ', 2)] }
			],
			null
		);
		expect(s.x).toBe('a mix of 30% Normal (μ ≈ -2) and 70% Normal (μ ≈ 2)');
		expect(s.noise).toBeNull();
	});
});

describe('helpers', () => {
	it('partText leaves out empty brackets', () => {
		expect(partText({ name: 'Cauchy', params: [] })).toBe('Cauchy');
	});

	it('massMoments gives the mean and spread of grid masses', () => {
		const m = massMoments(0, 1, [0.5, 0, 0.5]);
		expect(m.mean).toBeCloseTo(1);
		expect(m.sd).toBeCloseTo(1);
		expect(massMoments(0, 1, [0, 0]).mean).toBeNaN();
	});

	it('methodList joins names in plain English', () => {
		expect(methodList([])).toBe('none picked');
		expect(methodList(['A'])).toBe('A');
		expect(methodList(['A', 'B', 'C'])).toBe('A, B and C');
	});
});
