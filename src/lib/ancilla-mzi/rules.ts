/** The four fair-accounting rules, checked live against a setup. No DOM imports. */
import { isNoiseless, sameNoise } from './presets';
import type { Setup } from './types';

export type RuleId = 1 | 2 | 3 | 4;

export interface RuleCheck {
	id: RuleId;
	title: string;
	kept: boolean;
	/** One line saying why the rule is kept or broken. */
	reason: string;
}

/** Holds for every setup: the engine has no way to measure or feed back mid-hold. */
export const NO_FEEDBACK = 'No measurement or feedback during the hold.';

const fmt = (v: number) => String(Number(v.toPrecision(4)));

export function checkRules(setup: Setup): RuleCheck[] {
	const { nS, nA, ancillaWeight: a, mziParticles: mp, ancillaHold: hold } = setup;
	const N = nS + nA;

	const seminorm = nS + (nA > 0 ? a * nA : 0);
	const rule2Kept = nA === 0 || a <= 1;

	let rule4: Pick<RuleCheck, 'kept' | 'reason'>;
	if (nA === 0)
		rule4 = { kept: true, reason: 'No ancilla: every particle carries the system noise.' };
	else if (sameNoise(setup.noise.system, setup.noise.ancilla))
		rule4 = { kept: true, reason: 'Every particle, ancilla included, carries the same noise.' };
	else if (isNoiseless(setup.noise.ancilla))
		rule4 = { kept: false, reason: 'The ancilla is noiseless while the system is not.' };
	else rule4 = { kept: false, reason: 'The ancilla carries different noise from the system.' };

	return [
		{
			id: 1,
			title: 'Equal particles',
			kept: mp >= N,
			reason:
				mp >= N
					? `The MZI gets all N = ${N} particles.`
					: `The MZI gets only ${mp} of N = ${N} particles.`
		},
		{
			id: 2,
			title: 'Bounded generator',
			kept: rule2Kept,
			reason: rule2Kept
				? `‖∂H/∂ω‖ₛ = ${fmt(seminorm)} ≤ N = ${N}.`
				: `a = ${fmt(a)} > 1, so ‖∂H/∂ω‖ₛ = ${fmt(seminorm)} > N = ${N}.`
		},
		{
			id: 3,
			title: 'Equal time',
			kept: hold <= 1,
			reason:
				hold <= 1
					? 'Both schemes hold for t.'
					: `The ancilla scheme holds for ${fmt(hold)} t, the MZI for t.`
		},
		{ id: 4, title: 'Equal noise on every particle', ...rule4 }
	];
}
