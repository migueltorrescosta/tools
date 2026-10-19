import { describe, expect, it } from 'vitest';
import { applyPreset, defaultSetup, noiseless } from './presets';
import type { BestResult, MziResult, Setup } from './types';
import {
	computeMetrics,
	dephasingExtensionBound,
	pureDephasingRate,
	seminormBound,
	topTwoSpread
} from './metrics';

const mzi: MziResult = {
	particles: 2,
	qfiOpt: 1,
	qfiSym: 0.9,
	window: 0.8,
	bias: 0,
	qfiFixedWindow: 0.8,
	standard: { product: 0.5, noon: 0.4, twinFock: 0.3, oat: 0.6 },
	readouts: { epSystem: 0.5, epJoint: 0.5, parity: 0.4, best: 0.5 }
};

function best(qfi: number, qfiFine: number | null, ro: number | null = null): BestResult {
	return {
		role: 'setup',
		seed: 0,
		qfi,
		params: [],
		psiRe: [],
		psiIm: [],
		evaluations: 1,
		qfiFine,
		saturated: [],
		readouts: ro === null ? null : { epSystem: ro, epJoint: ro, parity: 0, best: ro }
	};
}

/** The active preset at (1, 1) under sigma_z dephasing at gamma t = 1 on every particle. */
const setup: Setup = (() => {
	const s = applyPreset(defaultSetup(), 'active');
	const noise = noiseless();
	noise.markov.dephasing = 1;
	return { ...s, noise: { system: noise, ancilla: structuredClone(noise) } };
})();

describe('computeMetrics', () => {
	it('computes the ratios, the error and the significance', () => {
		const m = computeMetrics({
			setup,
			mzi,
			best: best(1.2, 1.212, 0.6),
			optima: [1.2, 1.17, 1.0],
			companion: best(1.0, 1.01)
		});
		expect(m.R).toBeCloseTo(1.212, 12);
		expect(m.Rfixed).toBeCloseTo(1.212 / 0.8, 12);
		expect(m.Rstd).toBeCloseTo(1.212 / 0.6, 12);
		expect(m.deltaR).toBeCloseTo(0.01 + 0.025, 12);
		expect(m.significant).toBe(true); // R >= 1 + 3 (0.035)
		expect(m.Rint).toBeCloseTo(1.212 / 1.01, 12);
		expect(m.readoutRatio).toBeCloseTo(1.2, 12);
		expect(m.attained).toEqual({ ancilla: 0.6 / 1.212, mzi: 0.5 });
		expect(m.bounds.seminorm).toBe(4);
		expect(m.bounds.channelExtension).toBeCloseTo(dephasingExtensionBound(2, 1), 12);
	});

	it('passes with a small error, and leaves unknown parts null', () => {
		const m = computeMetrics({ setup, mzi, best: best(1.5, null), optima: [1.5], companion: null });
		expect(m.deltaR).toBe(0);
		expect(m.significant).toBe(true);
		expect(m.Rint).toBeNull();
		expect(m.readoutRatio).toBeNull();
		expect(m.attained.ancilla).toBeNull();
		const edge = computeMetrics({
			setup,
			mzi,
			best: best(1.0099, null),
			optima: [1],
			companion: null
		});
		expect(edge.significant).toBe(false);
	});
});

describe('bounds', () => {
	it('seminorm is ((nS + |a| nA) T)²', () => {
		expect(
			seminormBound({ ...setup, nS: 2, nA: 1, ancillaWeight: 2, ancillaHold: 1.5 })
		).toBeCloseTo(36, 12);
		expect(seminormBound({ ...setup, ancillaWeight: 0 })).toBe(1);
	});

	it('channel extension maximises n t² η² / (1 − η²) over t ≤ 1', () => {
		const brute = (n: number, g: number) => {
			let b = 0;
			for (let i = 1; i <= 100000; i++) {
				const t = i / 100000;
				const e2 = Math.exp(-2 * g * t);
				b = Math.max(b, (n * t * t * e2) / (1 - e2));
			}
			return b;
		};
		for (const [n, g] of [
			[2, 0.3],
			[3, 2],
			[4, 5]
		])
			expect(dephasingExtensionBound(n, g)).toBeCloseTo(brute(n, g), 8);
	});

	it('applies only to equal pure σz dephasing on every particle', () => {
		expect(pureDephasingRate(setup)).toBe(1);
		const s = structuredClone(setup);
		s.noise.ancilla.markov.dephasing = 2;
		expect(pureDephasingRate(s)).toBeNull();
		const c = { ...setup, noise: { system: setup.noise.system, ancilla: noiseless() } };
		expect(pureDephasingRate(c)).toBeNull();
		expect(pureDephasingRate({ ...c, nA: 0 })).toBe(1);
		const ad = structuredClone(setup);
		ad.noise.system.markov.amplitudeDamping = 0.1;
		expect(pureDephasingRate(ad)).toBeNull();
		const lor = structuredClone(setup);
		lor.noise.ancilla.lorentzian = { kind: 'dephasing', gamma: 1, lambda: 1 };
		expect(pureDephasingRate(lor)).toBeNull();
		expect(
			computeMetrics({ setup: ad, mzi, best: best(1, null), optima: [1], companion: null }).bounds
				.channelExtension
		).toBeNull();
	});

	it('spreads the two best seeds', () => {
		expect(topTwoSpread([])).toBe(0);
		expect(topTwoSpread([2])).toBe(0);
		expect(topTwoSpread([1, 2, 1.5])).toBeCloseTo(0.25, 12);
	});
});
