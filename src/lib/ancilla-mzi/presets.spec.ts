import { describe, expect, it } from 'vitest';
import {
	DEFAULT_BUDGET,
	PRESETS,
	applyPreset,
	defaultSetup,
	detectPreset,
	evenPulses,
	isNoiseless,
	noiseless,
	sameNoise
} from './presets';

describe('defaults', () => {
	it('uses the budget from the spec', () => {
		expect(DEFAULT_BUDGET).toEqual({
			steps: 24,
			rounds: 2,
			maxIter: 40,
			seesawIter: 60,
			workers: 0,
			seed: 1
		});
	});

	it('starts as the active preset at (1, 1) with the same noise on both registers', () => {
		const s = defaultSetup();
		expect(detectPreset(s)).toBe('active');
		expect([s.nS, s.nA, s.mziParticles, s.ancillaHold]).toEqual([1, 1, 2, 1]);
		expect(s.controlBound).toBe(10);
		expect(s.pulseBound).toBeCloseTo(2 * Math.PI);
		expect(s.pulses.map((p) => p.time)).toEqual([1 / 3, 2 / 3]);
		expect(sameNoise(s.noise.system, s.noise.ancilla)).toBe(true);
	});
});

describe('presets', () => {
	const base = { ...defaultSetup(), nS: 2, nA: 1, mziParticles: 3 };

	it('every preset is detected after applying it', () => {
		for (const p of PRESETS) expect(detectPreset(applyPreset(base, p.id))).toBe(p.id);
	});

	it('keeps register sizes and noise, except that clean empties the ancilla noise', () => {
		const active = applyPreset(base, 'active');
		expect([active.nS, active.nA, active.mziParticles]).toEqual([2, 1, 3]);
		expect(sameNoise(active.noise.ancilla, base.noise.ancilla)).toBe(true);
		const clean = applyPreset(base, 'clean');
		expect(isNoiseless(clean.noise.ancilla)).toBe(true);
		expect(sameNoise(clean.noise.system, base.noise.system)).toBe(true);
	});

	it('sets the class controls', () => {
		const passiveEnt = applyPreset(base, 'passive-ent');
		expect(passiveEnt.ancillaWeight).toBe(0);
		expect(passiveEnt.coupling.some(Boolean)).toBe(false);
		expect(passiveEnt.pulses).toEqual([]);
		const passive = applyPreset(base, 'passive');
		expect(passive.ancillaWeight).toBe(0);
		expect(passive.coupling.every(Boolean)).toBe(true);
		expect(passive.pulses.map((p) => p.target)).toEqual(['A', 'A']);
		const local = applyPreset(base, 'local+S');
		expect(local.ancillaWeight).toBe(1);
		expect(local.coupling.some(Boolean)).toBe(false);
		expect(local.fieldA.every(Boolean) && local.fieldS.every(Boolean)).toBe(true);
		expect(local.pulses.map((p) => p.target)).toEqual(['both', 'both']);
	});

	it('spreads pulses over a longer hold', () => {
		expect(applyPreset({ ...base, ancillaHold: 3 }, 'active').pulses.map((p) => p.time)).toEqual([
			1, 2
		]);
	});

	it('reports a custom setup once a control is edited', () => {
		const s = applyPreset(base, 'active');
		s.coupling[4] = false;
		expect(detectPreset(s)).toBeNull();
		const t = applyPreset(base, 'active');
		t.pulses[0].time = 0.2;
		expect(detectPreset(t)).toBeNull();
		expect(detectPreset({ ...applyPreset(base, 'active'), ancillaWeight: 1.5 })).toBeNull();
	});

	it('tells clean from passive-ent by the ancilla noise', () => {
		const s = applyPreset(base, 'passive-ent');
		expect(detectPreset({ ...s, noise: { system: s.noise.system, ancilla: noiseless() } })).toBe(
			'clean'
		);
		// With no noise anywhere the two coincide; call it passive-ent
		expect(detectPreset({ ...s, noise: { system: noiseless(), ancilla: noiseless() } })).toBe(
			'passive-ent'
		);
	});
});

describe('noise helpers', () => {
	it('ignores nbar without damping and Lorentzian rates without a bath', () => {
		const a = noiseless();
		const b = noiseless();
		b.markov.nbar = 2;
		b.lorentzian.gamma = 5;
		expect(sameNoise(a, b)).toBe(true);
		b.markov.amplitudeDamping = 1;
		expect(sameNoise(a, b)).toBe(false);
	});

	it('places K pulses evenly', () => {
		expect(evenPulses(3, 1, 'S')).toEqual([
			{ time: 0.25, target: 'S' },
			{ time: 0.5, target: 'S' },
			{ time: 0.75, target: 'S' }
		]);
	});
});
