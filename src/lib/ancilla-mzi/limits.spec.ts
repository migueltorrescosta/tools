import { describe, expect, it } from 'vitest';
import { lorentzianErrors, needsPseudomodes, validateBudget, validateSetup } from './limits';
import { DEFAULT_BUDGET } from './presets';
import { applyPreset, defaultSetup, noiseless } from './presets';
import type { Budget, Setup } from './types';

const fields = (s: Setup) => validateSetup(s).map((e) => e.field);

function withLorentzian(
	s: Setup,
	system: 'none' | 'dephasing' | 'amplitudeDamping',
	ancilla = system
): Setup {
	const out = structuredClone(s);
	out.noise.system.lorentzian = { kind: system, gamma: 1, lambda: 1 };
	out.noise.ancilla.lorentzian = { kind: ancilla, gamma: 1, lambda: 1 };
	return out;
}

describe('validateSetup', () => {
	it('accepts the default setup and every preset', () => {
		expect(validateSetup(defaultSetup())).toEqual([]);
		for (const id of ['passive-ent', 'clean', 'passive', 'local+S'] as const)
			expect(validateSetup(applyPreset(defaultSetup(), id))).toEqual([]);
	});

	it('limits the registers to N <= 4 with nS >= 1', () => {
		expect(fields({ ...defaultSetup(), nS: 0 })).toContain('nS');
		expect(fields({ ...defaultSetup(), nS: 3, nA: 2, mziParticles: 5 })).toContain('nA');
		expect(fields({ ...defaultSetup(), nS: 1.5 })).toContain('nS');
		expect(fields({ ...defaultSetup(), nA: -1 })).toContain('nA');
	});

	it('ignores the ancilla controls when there is no ancilla', () => {
		// The default 'active' preset keeps its coupling, field b and pulses on A
		expect(validateSetup({ ...defaultSetup(), nA: 0, mziParticles: 1 })).toEqual([]);
		expect(
			validateSetup(applyPreset({ ...defaultSetup(), nA: 0, mziParticles: 1 }, 'active+S'))
		).toEqual([]);
	});

	it('checks pulses: at most 4, inside the hold, increasing', () => {
		const s = defaultSetup();
		const five = Array.from({ length: 5 }, (_, i) => ({ time: (i + 1) / 6, target: 'A' as const }));
		expect(fields({ ...s, pulses: five })).toContain('pulses');
		expect(fields({ ...s, pulses: [{ time: 0, target: 'A' }] })).toContain('pulses.0.time');
		expect(fields({ ...s, pulses: [{ time: 1, target: 'A' }] })).toContain('pulses.0.time');
		expect(
			fields({
				...s,
				pulses: [
					{ time: 0.6, target: 'A' },
					{ time: 0.4, target: 'A' }
				]
			})
		).toContain('pulses.1.time');
		// A longer hold widens the window
		expect(fields({ ...s, ancillaHold: 2, pulses: [{ time: 1.5, target: 'A' }] })).toEqual([]);
	});

	it('bounds the accounting overrides', () => {
		expect(fields({ ...defaultSetup(), mziParticles: 0 })).toContain('mziParticles');
		expect(fields({ ...defaultSetup(), mziParticles: 3 })).toContain('mziParticles');
		expect(fields({ ...defaultSetup(), mziParticles: 1 })).toEqual([]);
		expect(fields({ ...defaultSetup(), ancillaHold: 0.5 })).toContain('ancillaHold');
		expect(fields({ ...defaultSetup(), ancillaHold: 5 })).toContain('ancillaHold');
	});

	it('bounds the rates, and ignores the ancilla noise without an ancilla', () => {
		const s = structuredClone(defaultSetup());
		s.noise.ancilla.markov.dephasing = -1;
		s.noise.system.markov.transverse = 11;
		expect(fields(s)).toEqual(
			expect.arrayContaining(['noise.ancilla.markov.dephasing', 'noise.system.markov.transverse'])
		);
		const bare = applyPreset({ ...s, nA: 0, mziParticles: 1 }, 'passive-ent');
		bare.noise.system.markov.transverse = 1;
		expect(validateSetup(bare)).toEqual([]);
	});
});

describe('Lorentzian limits', () => {
	const uncontrolled = applyPreset(defaultSetup(), 'passive-ent');

	it('allows one kind only', () => {
		const mixed = withLorentzian(uncontrolled, 'dephasing', 'amplitudeDamping');
		expect(lorentzianErrors(mixed)).toHaveLength(1);
		expect(lorentzianErrors(withLorentzian(uncontrolled, 'dephasing', 'none'))).toEqual([]);
	});

	it('runs uncontrolled Lorentzian dephasing in closed form at any size', () => {
		const big = withLorentzian({ ...uncontrolled, nS: 2, nA: 2, mziParticles: 4 }, 'dephasing');
		expect(needsPseudomodes(big)).toBe(false);
		expect(validateSetup(big)).toEqual([]);
	});

	it('needs pseudomodes, so N_S = N_A = 1, for controlled dephasing', () => {
		const s = withLorentzian(defaultSetup(), 'dephasing');
		expect(needsPseudomodes(s)).toBe(true);
		expect(validateSetup(s)).toEqual([]);
		expect(fields({ ...s, nS: 2, mziParticles: 3 })).toContain('noise.system.lorentzian.kind');
		expect(fields({ ...s, pmLevels: 4 })).toContain('pmLevels');
	});

	it('treats transverse dephasing like a control', () => {
		const s = withLorentzian(uncontrolled, 'dephasing');
		s.noise.system.markov.transverse = 0.5;
		expect(needsPseudomodes(s)).toBe(true);
	});

	it('needs N_S = N_A = 1 for Lorentzian damping, controlled or not', () => {
		const s = withLorentzian(uncontrolled, 'amplitudeDamping');
		expect(needsPseudomodes(s)).toBe(true);
		expect(validateSetup(s)).toEqual([]);
		expect(fields({ ...s, nA: 2, mziParticles: 3 })).toContain('noise.system.lorentzian.kind');
	});

	it('checks gamma and lambda only when a bath is on', () => {
		const s = structuredClone(uncontrolled);
		s.noise.system = noiseless();
		s.noise.system.lorentzian.lambda = 0;
		s.noise.ancilla = structuredClone(s.noise.system);
		expect(validateSetup(s)).toEqual([]);
		s.noise.system.lorentzian.kind = 'dephasing';
		expect(fields(s)).toContain('noise.system.lorentzian.lambda');
	});
});

describe('validateBudget', () => {
	const fieldsOf = (b: Partial<Budget>) =>
		validateBudget({ ...DEFAULT_BUDGET, ...b }).map((e) => e.field);

	it('accepts the default budget', () => {
		expect(validateBudget(DEFAULT_BUDGET)).toEqual([]);
	});

	it('flags each field out of range, fractional or cleared', () => {
		expect(fieldsOf({ steps: 1 })).toEqual(['budget.steps']);
		expect(fieldsOf({ steps: 401 })).toEqual(['budget.steps']);
		expect(fieldsOf({ rounds: 0 })).toEqual(['budget.rounds']);
		expect(fieldsOf({ maxIter: 2.5 })).toEqual(['budget.maxIter']);
		expect(fieldsOf({ seesawIter: NaN })).toEqual(['budget.seesawIter']);
		expect(fieldsOf({ workers: 17 })).toEqual(['budget.workers']);
		expect(fieldsOf({ workers: -1 })).toEqual(['budget.workers']);
		expect(fieldsOf({ seed: -1 })).toEqual(['budget.seed']);
		// A cleared number input binds null.
		expect(fieldsOf({ steps: null as unknown as number })).toEqual(['budget.steps']);
		expect(validateBudget({ ...DEFAULT_BUDGET, steps: 1 })[0].message).toBe(
			'Strang steps M must be a whole number from 2 to 400.'
		);
	});
});
