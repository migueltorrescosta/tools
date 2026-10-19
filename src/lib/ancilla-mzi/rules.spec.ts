import { describe, expect, it } from 'vitest';
import { applyPreset, defaultSetup, noiseless } from './presets';
import { NO_FEEDBACK, checkRules } from './rules';
import type { Setup } from './types';

const kept = (s: Setup) => checkRules(s).map((r) => r.kept);

describe('checkRules', () => {
	it('keeps all four rules for the default setup', () => {
		const rules = checkRules(defaultSetup());
		expect(rules.map((r) => r.id)).toEqual([1, 2, 3, 4]);
		expect(rules.every((r) => r.kept && r.reason.length > 0)).toBe(true);
		expect(NO_FEEDBACK).toMatch(/feedback/);
	});

	it('breaks rule 1 when the MZI gets fewer particles', () => {
		expect(kept({ ...defaultSetup(), mziParticles: 1 })).toEqual([false, true, true, true]);
		expect(checkRules({ ...defaultSetup(), mziParticles: 1 })[0].reason).toContain('1 of N = 2');
	});

	it('breaks rule 2 when a > 1', () => {
		const rules = checkRules({ ...defaultSetup(), ancillaWeight: 2 });
		expect(rules[1].kept).toBe(false);
		expect(rules[1].reason).toContain('= 3 > N = 2');
		// Without an ancilla, a doesn't matter
		expect(checkRules({ ...defaultSetup(), nA: 0, ancillaWeight: 2 })[1].kept).toBe(true);
	});

	it('breaks rule 3 when the ancilla holds longer', () => {
		expect(kept({ ...defaultSetup(), ancillaHold: 1.5 })).toEqual([true, true, false, true]);
	});

	it('breaks rule 4 when the noise differs, with a clean ancilla named', () => {
		const clean = checkRules(applyPreset(defaultSetup(), 'clean'))[3];
		expect(clean.kept).toBe(false);
		expect(clean.reason).toContain('noiseless');
		const other = structuredClone(defaultSetup());
		other.noise.ancilla.markov.dephasing = 0.5;
		expect(checkRules(other)[3]).toMatchObject({
			kept: false,
			reason: expect.stringContaining('different')
		});
		// A noiseless run keeps it
		const quiet = { ...defaultSetup(), noise: { system: noiseless(), ancilla: noiseless() } };
		expect(checkRules(quiet)[3].kept).toBe(true);
	});
});
