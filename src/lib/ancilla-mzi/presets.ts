/** Default setup and budget, and the seven class presets. No DOM imports. */
import type { Budget, MarkovNoise, Pulse, PulseTarget, RegisterNoise, Setup } from './types';

export const DEFAULT_CONTROL_BOUND = 10;
export const DEFAULT_PULSE_BOUND = 2 * Math.PI;
export const DEFAULT_PULSES = 2;

export const DEFAULT_BUDGET: Readonly<Budget> = {
	steps: 24,
	rounds: 2,
	maxIter: 40,
	seesawIter: 60,
	workers: 0,
	seed: 1
};

export function zeroMarkov(): MarkovNoise {
	return { dephasing: 0, amplitudeDamping: 0, nbar: 0, depolarizing: 0, transverse: 0 };
}

export function noiseless(): RegisterNoise {
	return { markov: zeroMarkov(), lorentzian: { kind: 'none', gamma: 1, lambda: 1 } };
}

export function cloneNoise(noise: RegisterNoise): RegisterNoise {
	return { markov: { ...noise.markov }, lorentzian: { ...noise.lorentzian } };
}

export function sameNoise(a: RegisterNoise, b: RegisterNoise): boolean {
	const m = a.markov;
	const n = b.markov;
	const la = a.lorentzian;
	const lb = b.lorentzian;
	return (
		m.dephasing === n.dephasing &&
		m.amplitudeDamping === n.amplitudeDamping &&
		// nbar only matters with damping
		(m.amplitudeDamping === 0 || m.nbar === n.nbar) &&
		m.depolarizing === n.depolarizing &&
		m.transverse === n.transverse &&
		la.kind === lb.kind &&
		(la.kind === 'none' || (la.gamma === lb.gamma && la.lambda === lb.lambda))
	);
}

/** True when the register carries no noise at all. */
export function isNoiseless(noise: RegisterNoise): boolean {
	return sameNoise(noise, noiseless());
}

/** K pulses at t_m = m T / (K + 1), T the ancilla hold. */
export function evenPulses(count: number, hold: number, target: PulseTarget = 'A'): Pulse[] {
	return Array.from({ length: count }, (_, i) => ({
		time: ((i + 1) * hold) / (count + 1),
		target
	}));
}

export type PresetId =
	'passive-ent' | 'clean' | 'passive' | 'active' | 'local' | 'active+S' | 'local+S';

export interface Preset {
	id: PresetId;
	label: string;
	/** One line for the preset picker. */
	description: string;
	ancillaWeight: 0 | 1;
	coupling: boolean;
	fields: boolean;
	/** Pulse target, or null for no pulses. */
	pulses: PulseTarget | null;
	cleanAncilla: boolean;
}

export const PRESETS: readonly Preset[] = [
	{
		id: 'passive-ent',
		label: 'Passive, entangled',
		description: 'Ancilla off the generator, no controls: only the input entangles S and A.',
		ancillaWeight: 0,
		coupling: false,
		fields: false,
		pulses: null,
		cleanAncilla: false
	},
	{
		id: 'clean',
		label: 'Clean ancilla',
		description: 'Like passive, entangled, but the ancilla is noiseless (breaks rule 4).',
		ancillaWeight: 0,
		coupling: false,
		fields: false,
		pulses: null,
		cleanAncilla: true
	},
	{
		id: 'passive',
		label: 'Passive, controlled',
		description: 'Ancilla off the generator, with coupling, fields and pulses on A.',
		ancillaWeight: 0,
		coupling: true,
		fields: true,
		pulses: 'A',
		cleanAncilla: false
	},
	{
		id: 'active',
		label: 'Active, controlled',
		description: 'Ancilla on the generator, with coupling, fields and pulses on A.',
		ancillaWeight: 1,
		coupling: true,
		fields: true,
		pulses: 'A',
		cleanAncilla: false
	},
	{
		id: 'local',
		label: 'Active, local',
		description: 'Ancilla on the generator, fields and pulses on A, coupling off.',
		ancillaWeight: 1,
		coupling: false,
		fields: true,
		pulses: 'A',
		cleanAncilla: false
	},
	{
		id: 'active+S',
		label: 'Active, pulses on both',
		description: 'Active, controlled, with pulses on S and A.',
		ancillaWeight: 1,
		coupling: true,
		fields: true,
		pulses: 'both',
		cleanAncilla: false
	},
	{
		id: 'local+S',
		label: 'Active, local, pulses on both',
		description: 'Active, local, with pulses on S and A.',
		ancillaWeight: 1,
		coupling: false,
		fields: true,
		pulses: 'both',
		cleanAncilla: false
	}
];

export function getPreset(id: PresetId): Preset {
	const preset = PRESETS.find((p) => p.id === id);
	if (!preset) throw new Error(`unknown preset ${id}`);
	return preset;
}

/**
 * Apply a preset's controls to `setup`. Register sizes, input space, bounds,
 * accounting overrides and noise stay, except that 'clean' makes the ancilla noiseless.
 */
export function applyPreset(setup: Setup, id: PresetId): Setup {
	const p = getPreset(id);
	return {
		...setup,
		ancillaWeight: p.ancillaWeight,
		coupling: Array.from({ length: 9 }, () => p.coupling),
		fieldA: [p.fields, p.fields, p.fields],
		fieldS: [p.fields, p.fields, p.fields],
		pulses: p.pulses ? evenPulses(DEFAULT_PULSES, setup.ancillaHold, p.pulses) : [],
		noise: {
			system: cloneNoise(setup.noise.system),
			ancilla: p.cleanAncilla ? noiseless() : cloneNoise(setup.noise.ancilla)
		}
	};
}

const TIME_TOLERANCE = 1e-9;

/** The preset whose controls the setup has, or null for a custom setup. */
export function detectPreset(setup: Setup): PresetId | null {
	const allSame = (xs: readonly boolean[], v: boolean) => xs.every((x) => x === v);
	const matches = PRESETS.filter((p) => {
		if (setup.ancillaWeight !== p.ancillaWeight) return false;
		if (!allSame(setup.coupling, p.coupling)) return false;
		if (!allSame(setup.fieldA, p.fields) || !allSame(setup.fieldS, p.fields)) return false;
		if (p.pulses === null) return setup.pulses.length === 0;
		const even = evenPulses(DEFAULT_PULSES, setup.ancillaHold, p.pulses);
		return (
			setup.pulses.length === even.length &&
			setup.pulses.every(
				(q, i) => q.target === even[i].target && Math.abs(q.time - even[i].time) < TIME_TOLERANCE
			)
		);
	});
	// passive-ent and clean share their controls: a noiseless ancilla next to a noisy system is 'clean'
	const cleanAncilla =
		isNoiseless(setup.noise.ancilla) && !isNoiseless(setup.noise.system) && setup.nA > 0;
	return (matches.find((p) => p.cleanAncilla === cleanAncilla) ?? matches[0])?.id ?? null;
}

/** A (1, 1) active, controlled setup under sigma_z dephasing at gamma t = 1 on every particle. */
export function defaultSetup(): Setup {
	const noise: RegisterNoise = noiseless();
	noise.markov.dephasing = 1;
	const base: Setup = {
		nS: 1,
		nA: 1,
		input: 'sym',
		ancillaWeight: 1,
		coupling: Array.from({ length: 9 }, () => false),
		fieldA: [false, false, false],
		fieldS: [false, false, false],
		controlBound: DEFAULT_CONTROL_BOUND,
		pulseBound: DEFAULT_PULSE_BOUND,
		pulses: [],
		noise: { system: noise, ancilla: cloneNoise(noise) },
		mziParticles: 2,
		ancillaHold: 1,
		pmLevels: 3
	};
	return applyPreset(base, 'active');
}
