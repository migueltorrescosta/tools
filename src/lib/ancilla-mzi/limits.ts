/** Which setups the engine runs, and why it refuses the rest. No DOM imports. */
import { freeControls, type LorentzianKind, type RegisterNoise, type Setup } from './types';

const MAX_PARTICLES = 4;
export const MAX_PULSES = 4;
export const MIN_HOLD = 1;
export const MAX_HOLD = 4;
/** Cap on every rate (gamma, in units of 1/t) and on nbar. */
export const MAX_RATE = 10;
/** Cap on the Lorentzian bath width lambda, in units of 1/t. */
export const MAX_LAMBDA = 100;
export const MAX_WEIGHT = 4;
const MAX_CONTROL_BOUND = 100;
const MAX_PULSE_BOUND = 4 * Math.PI;
export const PM_LEVELS = [2, 3] as const;

export type Register = 'system' | 'ancilla';

interface SetupError {
	/** Dotted path of the offending field, e.g. 'nS', 'pulses.1.time', 'noise.ancilla.markov.dephasing'. */
	field: string;
	message: string;
}

const isInt = (v: number) => Number.isInteger(v);

/** The registers whose noise acts: the ancilla's only when there is an ancilla. */
function activeRegisters(setup: Setup): Register[] {
	return setup.nA > 0 ? ['system', 'ancilla'] : ['system'];
}

function lorentzianKinds(setup: Setup): Set<LorentzianKind> {
	const kinds = new Set<LorentzianKind>();
	for (const r of activeRegisters(setup)) {
		const kind = setup.noise[r].lorentzian.kind;
		if (kind !== 'none') kinds.add(kind);
	}
	return kinds;
}

/**
 * True when the Lorentzian bath needs explicit pseudomodes: always for
 * Lorentzian damping; for Lorentzian dephasing once controls or transverse
 * dephasing stop the dynamics commuting with s_z (otherwise e^{-Gamma(t)} is exact).
 */
export function needsPseudomodes(setup: Setup): boolean {
	const kinds = lorentzianKinds(setup);
	if (kinds.has('amplitudeDamping')) return true;
	if (!kinds.has('dephasing')) return false;
	const transverse = activeRegisters(setup).some((r) => setup.noise[r].markov.transverse > 0);
	return freeControls(setup).length > 0 || transverse;
}

function rateErrors(noise: RegisterNoise, register: Register): SetupError[] {
	const errors: SetupError[] = [];
	const rate = (field: string, value: number, label: string, max = MAX_RATE) => {
		if (!Number.isFinite(value) || value < 0 || value > max)
			errors.push({
				field: `noise.${register}.${field}`,
				message: `${label} must be between 0 and ${max}.`
			});
	};
	const m = noise.markov;
	rate('markov.dephasing', m.dephasing, 'Dephasing rate');
	rate('markov.amplitudeDamping', m.amplitudeDamping, 'Damping rate');
	rate('markov.nbar', m.nbar, 'Thermal occupation');
	rate('markov.depolarizing', m.depolarizing, 'Depolarizing rate');
	rate('markov.transverse', m.transverse, 'Transverse dephasing rate');
	const l = noise.lorentzian;
	if (l.kind !== 'none') {
		rate('lorentzian.gamma', l.gamma, 'Lorentzian γ');
		if (!Number.isFinite(l.lambda) || l.lambda <= 0 || l.lambda > MAX_LAMBDA)
			errors.push({
				field: `noise.${register}.lorentzian.lambda`,
				message: `Lorentzian λ must be above 0 and at most ${MAX_LAMBDA}.`
			});
	}
	return errors;
}

/** Every reason the setup can't run; empty when it can. */
export function validateSetup(setup: Setup): SetupError[] {
	const errors: SetupError[] = [];
	const { nS, nA } = setup;
	const N = nS + nA;
	if (!isInt(nS) || nS < 1)
		errors.push({ field: 'nS', message: 'Use at least 1 system particle.' });
	if (!isInt(nA) || nA < 0)
		errors.push({ field: 'nA', message: 'Ancilla particles must be a whole number, 0 or more.' });
	if (N > MAX_PARTICLES)
		errors.push({
			field: 'nA',
			message: `Use at most ${MAX_PARTICLES} particles in all (N = ${N}).`
		});

	if (!Number.isFinite(setup.ancillaWeight) || setup.ancillaWeight < 0)
		errors.push({ field: 'ancillaWeight', message: 'The ancilla weight a must be 0 or more.' });
	else if (setup.ancillaWeight > MAX_WEIGHT)
		errors.push({ field: 'ancillaWeight', message: `Keep a at most ${MAX_WEIGHT}.` });

	if (
		!Number.isFinite(setup.controlBound) ||
		setup.controlBound <= 0 ||
		setup.controlBound > MAX_CONTROL_BOUND
	)
		errors.push({
			field: 'controlBound',
			message: `The control bound must be above 0 and at most ${MAX_CONTROL_BOUND}.`
		});
	if (
		!Number.isFinite(setup.pulseBound) ||
		setup.pulseBound <= 0 ||
		setup.pulseBound > MAX_PULSE_BOUND + 1e-9
	)
		errors.push({
			field: 'pulseBound',
			message: 'The pulse bound must be above 0 and at most 4π.'
		});

	// Pulses
	const hold = setup.ancillaHold;
	if (setup.pulses.length > MAX_PULSES)
		errors.push({ field: 'pulses', message: `Use at most ${MAX_PULSES} pulses.` });
	setup.pulses.forEach((p, i) => {
		const prev = i > 0 ? setup.pulses[i - 1].time : 0;
		if (!Number.isFinite(p.time) || p.time <= 0 || p.time >= hold)
			errors.push({
				field: `pulses.${i}.time`,
				message: `Pulse ${i + 1} must fall inside the hold, between 0 and ${hold}.`
			});
		else if (i > 0 && p.time <= prev)
			errors.push({
				field: `pulses.${i}.time`,
				message: `Pulse ${i + 1} must come after pulse ${i}.`
			});
	});

	// Accounting overrides
	const mp = setup.mziParticles;
	if (!isInt(mp) || mp < 1 || mp > Math.max(N, 1))
		errors.push({
			field: 'mziParticles',
			message: `Give the MZI a whole number of particles from 1 to N = ${N}.`
		});
	if (!Number.isFinite(hold) || hold < MIN_HOLD || hold > MAX_HOLD)
		errors.push({
			field: 'ancillaHold',
			message: `Keep the ancilla hold between ${MIN_HOLD} and ${MAX_HOLD} (in units of t).`
		});

	// Noise
	for (const r of activeRegisters(setup)) errors.push(...rateErrors(setup.noise[r], r));
	errors.push(...lorentzianErrors(setup));
	return errors;
}

/** The limits on Lorentzian baths alone, so the UI can grey out kinds that would break them. */
export function lorentzianErrors(setup: Setup): SetupError[] {
	const errors: SetupError[] = [];
	const kinds = lorentzianKinds(setup);
	const field =
		(setup.noise.system.lorentzian.kind !== 'none' ? 'noise.system' : 'noise.ancilla') +
		'.lorentzian.kind';
	if (kinds.size > 1) {
		errors.push({
			field: 'noise.ancilla.lorentzian.kind',
			message: 'Use one Lorentzian bath per run: the same kind on both registers, or none.'
		});
		return errors;
	}
	const single = setup.nS === 1 && setup.nA === 1;
	if (kinds.has('amplitudeDamping') && !single)
		errors.push({
			field,
			message: 'Lorentzian damping needs pseudomodes, which run only at N_S = N_A = 1.'
		});
	if (kinds.has('dephasing') && needsPseudomodes(setup)) {
		if (!single)
			errors.push({
				field,
				message:
					'With controls or transverse dephasing, Lorentzian dephasing needs pseudomodes, which run only at N_S = N_A = 1.'
			});
		if (!(PM_LEVELS as readonly number[]).includes(setup.pmLevels))
			errors.push({ field: 'pmLevels', message: 'The Fock cutoff must be 2 or 3.' });
	}
	return errors;
}
