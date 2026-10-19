// Shared contract of the Ancilla vs MZI tool: setup, noise, budget, results
// and the engine interface the page talks to. Units: the hold is t = 1, so
// every rate is in units of 1/t and every QFI is in units of t^2.

export type Axis = 'x' | 'y' | 'z';
export const AXES: readonly Axis[] = ['x', 'y', 'z'];

/** Markovian single-particle noise, all rates in units of 1/t. */
export interface MarkovNoise {
	/** sigma_z dephasing, L = sqrt(rate/2) sigma_z: coherence decays as e^{-rate t}. */
	dephasing: number;
	/** Energy relaxation, L = sqrt(rate (nbar + 1)) sigma_-, with sigma_- = |0><1|. */
	amplitudeDamping: number;
	/** Thermal occupation of the damping bath; adds L = sqrt(rate nbar) sigma_+. 0 is plain amplitude damping. */
	nbar: number;
	/** Depolarizing, L_a = sqrt(rate/4) sigma_a for a = x, y, z: the Bloch vector shrinks as e^{-rate t}. */
	depolarizing: number;
	/** Transverse dephasing, L = sqrt(rate/2) sigma_x. Not phase covariant. */
	transverse: number;
}

export type LorentzianKind = 'none' | 'dephasing' | 'amplitudeDamping';

/**
 * Lorentzian (non-Markovian) bath, one private damped pseudomode per particle.
 * dephasing: H = g s_z (b + b^dag), g = sqrt(gamma lambda), mode damping 2 lambda;
 *   coherence decays as e^{-Gamma(t)}, Gamma = gamma [t - (1 - e^{-lambda t})/lambda].
 * amplitudeDamping: H = sqrt(gamma lambda / 2)(sigma_+ b + sigma_- b^dag), mode damping 2 lambda.
 */
export interface LorentzianNoise {
	kind: LorentzianKind;
	gamma: number;
	lambda: number;
}

/** Noise acting on every particle of one register. */
export interface RegisterNoise {
	markov: MarkovNoise;
	lorentzian: LorentzianNoise;
}

export type PulseTarget = 'A' | 'S' | 'both';

export interface Pulse {
	/** Time in (0, t); snapped to the nearest Strang step boundary. */
	time: number;
	target: PulseTarget;
}

type InputSpace = 'sym' | 'full';

export interface Setup {
	nS: number;
	nA: number;
	/** 'sym': Sym(S) (x) Sym(A); 'full': all 2^N qubit states. */
	input: InputSpace;
	/** dH/domega = J_z^S + ancillaWeight J_z^A (0 passive, 1 active, > 1 breaks rule 2). */
	ancillaWeight: number;
	/** alpha_ij on/off, row-major: index 3 i + j, i over S axes, j over A axes. */
	coupling: boolean[];
	/** Static field b . J^A, per axis. */
	fieldA: [boolean, boolean, boolean];
	/** Static field c . J^S, per axis. */
	fieldS: [boolean, boolean, boolean];
	/** Bound on |alpha_ij|, |b_i|, |c_i| in units of 1/t. */
	controlBound: number;
	/** Bound on each pulse rotation component (default 2 pi). */
	pulseBound: number;
	pulses: Pulse[];
	noise: { system: RegisterNoise; ancilla: RegisterNoise };
	/** Accounting override: particles given to the MZI (default nS + nA; fewer breaks rule 1). */
	mziParticles: number;
	/** Accounting override: hold of the ancilla scheme in units of t (default 1; longer breaks rule 3). */
	ancillaHold: number;
	/** Pseudomode Fock cutoff for controlled Lorentzian dephasing (2 or 3). */
	pmLevels: number;
}

export interface Budget {
	/** Strang steps per hold, M. */
	steps: number;
	/** Rounds of (controls, then see-saw) per seed. */
	rounds: number;
	/** Optimiser iterations per round. */
	maxIter: number;
	/** See-saw iterations per call. */
	seesawIter: number;
	/** Web Workers; 0 means the default min(hardwareConcurrency - 1, 4), at least 1. */
	workers: number;
	/** PRNG seed of the run. */
	seed: number;
}

/**
 * Control vector layout (as in the Python engine): [0, 9) alpha_ij, [9, 12) b,
 * [12, 15) c, then 3 entries per pulse on A, then 3 entries per pulse on S.
 * Masked-off entries stay 0.
 */
export function controlCount(nPulses: number): number {
	return 15 + 6 * nPulses;
}

/**
 * Free control entries: coupling mask, field axes and pulse targets. Without
 * an ancilla the A-only entries (coupling, b, pulses on A) stay fixed at 0,
 * so the setup runs as an MZI with local fields.
 */
export function freeControls(setup: Setup): number[] {
	const K = setup.pulses.length;
	const free: number[] = [];
	setup.coupling.forEach((on, k) => on && setup.nA > 0 && free.push(k));
	setup.fieldA.forEach((on, k) => on && setup.nA > 0 && free.push(9 + k));
	setup.fieldS.forEach((on, k) => on && free.push(12 + k));
	setup.pulses.forEach((p, q) => {
		if (p.target !== 'S' && setup.nA > 0) free.push(15 + 3 * q, 16 + 3 * q, 17 + 3 * q);
	});
	setup.pulses.forEach((p, q) => {
		if (p.target !== 'A') {
			const o = 15 + 3 * K + 3 * q;
			free.push(o, o + 1, o + 2);
		}
	});
	return free.sort((a, b) => a - b);
}

export interface Readouts {
	/** J_z error propagation on S (on the whole register for the MZI), after an optimised rotation. */
	epSystem: number;
	/** Weighted joint J_z error propagation (ancilla side only; equals epSystem for the MZI). */
	epJoint: number;
	/** Parity readout. */
	parity: number;
	best: number;
}

export interface MziResult {
	particles: number;
	/** Window- and input-optimised QFI over the full space, F_MZI^opt. */
	qfiOpt: number;
	/** Same, optimised over Sym only. */
	qfiSym: number;
	/** Optimal window t' <= t. */
	window: number;
	/** Optimised static bias along the generator (0 when the noise is phase covariant). */
	bias: number;
	/** Input-optimised QFI at the full window t' = t. */
	qfiFixedWindow: number;
	/** Standard inputs, each at its own best window. */
	standard: { product: number; noon: number; twinFock: number; oat: number };
	readouts: Readouts;
}

export type Role = 'setup' | 'companion';

export interface SeedResult {
	role: Role;
	seed: number;
	qfi: number;
	params: number[];
	psiRe: number[];
	psiIm: number[];
	evaluations: number;
}

export interface BestResult extends SeedResult {
	/** QFI re-evaluated with 2M Strang steps (null until computed). */
	qfiFine: number | null;
	/** Per control entry: |value| within 1e-3 of its bound. */
	saturated: boolean[];
	readouts: Readouts | null;
}

export interface Metrics {
	R: number;
	Rfixed: number;
	Rstd: number;
	/** Trotter change plus the relative spread of the two best seeds. */
	deltaR: number;
	/** R >= 1 + max(0.01, 3 deltaR). */
	significant: boolean;
	/** Setup over companion (coupling off); null when the setup has no coupling. */
	Rint: number | null;
	/** Best ancilla readout over best MZI readout. */
	readoutRatio: number | null;
	attained: { ancilla: number | null; mzi: number };
	bounds: {
		/** Noiseless seminorm bound (integral of ||dH/domega||_s)^2. */
		seminorm: number;
		/** Parallel channel-extension bound for sigma_z dephasing, null otherwise. */
		channelExtension: number | null;
	};
}

export interface TracePoint {
	evaluations: number;
	qfi: number;
}

export interface SeedTrace {
	role: Role;
	seed: number;
	points: TracePoint[];
	done: boolean;
}

export interface RunSnapshot {
	elapsedMs: number;
	seedsDone: { setup: number; companion: number };
	mzi: MziResult | null;
	best: { setup: BestResult | null; companion: BestResult | null };
	traces: SeedTrace[];
	metrics: Metrics | null;
}

export type RunEvent =
	| { type: 'progress'; snapshot: RunSnapshot }
	| { type: 'stopped'; reason: 'user'; snapshot: RunSnapshot }
	| { type: 'error'; message: string };

/** What the page drives. A run is one setup that keeps adding seeds until stopped. */
export interface AncillaEngine {
	start(setup: Setup, budget: Budget): void;
	stop(): void;
	/** Resume after stop, keeping the best results and the seed counter. */
	continue(): void;
	subscribe(listener: (event: RunEvent) => void): () => void;
	dispose(): void;
}
