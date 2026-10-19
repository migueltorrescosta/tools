/**
 * From a `Setup` to the problems the optimiser and the MZI baseline work on:
 * the register, the generator, the free controls and their bounds, and a
 * `hold` that turns a control vector into a `HoldMap` (port of the Python
 * `ancilla_setup`, `control_hamiltonian`, `ancilla_hold` and `mzi_hold`).
 */
import {
	AXES,
	controlCount,
	freeControls,
	type RegisterNoise,
	type Role,
	type Setup
} from './types';
import { type CMat, type CRect, axpy, identity, kron, matmul, zeros } from './linalg';
import { HoldMap } from './hold';
import { GradientHold } from './gradient';
import { qfiAndSld } from './qfi';
import {
	type NoiseStep,
	isPhaseCovariant,
	perQubitNoise,
	pseudomodeHamiltonian,
	registerNoiseStep
} from './noise';
import {
	type IsometryKind,
	type Register,
	collectiveSpin,
	inputIsometry,
	liftQubitOperator,
	makeRegister
} from './register';

/** Fock cutoff of Lorentzian damping pseudomodes: exact for one excitation per particle. */
const AD_MODE_LEVELS = 2;

/** exp(−i u · σ/2), the single-qubit factor of a collective rotation exp(−i u · J). */
export function su2(u: ArrayLike<number>): CMat {
	const theta = Math.hypot(u[0], u[1], u[2]);
	const c = Math.cos(theta / 2);
	const s = theta > 0 ? Math.sin(theta / 2) / theta : 0;
	const [nx, ny, nz] = [s * u[0], s * u[1], s * u[2]];
	const r = zeros(2);
	r.re.set([c, -ny, ny, c]);
	r.im.set([-nz, -nx, -nx, nz]);
	return r;
}

/** ⊗_k ops[k] over the qubits, in site order. */
export function kronAll(ops: readonly CMat[]): CMat {
	return ops.reduce((acc, op) => kron(acc, op), identity(1));
}

/** True when a register carries a Lorentzian bath. */
function hasBath(noise: RegisterNoise): boolean {
	return noise.lorentzian.kind !== 'none' && noise.lorentzian.gamma > 0;
}

/** Step boundary of a pulse at `time` in a hold of length t with M steps: round(time / t · M), clamped to [1, M − 1]. */
export function pulseBoundary(time: number, t: number, steps: number): number {
	return Math.min(steps - 1, Math.max(1, Math.round((time / t) * steps)));
}

export interface AncillaProblem {
	role: Role;
	setup: Setup;
	reg: Register;
	/** Allowed inputs (the setup's input space). */
	iso: CRect;
	generator: CMat;
	/** Length of the control vector, 15 + 6K. */
	nParams: number;
	/** Indices of the controls the optimiser moves; the others stay 0. */
	free: number[];
	/** |p_i| ≤ bound[i]; 0 for fixed entries. */
	bound: Float64Array;
	/** Strang steps M of the hold (1 when exact). */
	steps: number;
	/** Hold duration T = setup.ancillaHold. */
	t: number;
	/** Uncontrolled and phase covariant: one exact step. */
	exact: boolean;
	/** The hold for a control vector; `steps` defaults to M (ignored when exact). */
	hold(params: ArrayLike<number>, steps?: number): HoldMap;
	/**
	 * QFI of the M-step hold for input ρ0 (full space); with `grad`, also
	 * writes dQFI/dp_k at every free k (adjoint pass, see gradient.ts).
	 */
	objective(params: ArrayLike<number>, rho0: CMat, grad?: Float64Array): number;
}

function rhoPair(r: { rho: CMat; drho: CMat }): [CMat, CMat] {
	return [r.rho, r.drho];
}

/** Noise of every qubit of the register (S, then A). */
function qubitNoise(setup: Setup): RegisterNoise[] {
	return perQubitNoise(makeRegister(setup.nS, setup.nA), setup.noise);
}

/**
 * The ancilla scheme of a setup (role 'setup') or its companion (role
 * 'companion': every coupling entry off). Pseudomodes sit only on qubits
 * whose register has a Lorentzian bath, and only when the hold isn't exact.
 */
export function buildAncilla(setup: Setup, steps: number, role: Role = 'setup'): AncillaProblem {
	const s: Setup =
		role === 'companion' ? { ...setup, coupling: setup.coupling.map(() => false) } : setup;
	const perQubit = qubitNoise(s);
	const free = freeControls(s);
	const covariant = perQubit.every((n) => isPhaseCovariant(n.markov, n.lorentzian));
	const exact = free.length === 0 && covariant;
	const lorentzian = perQubit.map((n) => n.lorentzian);
	const modeQubits = exact ? [] : perQubit.flatMap((n, k) => (hasBath(n) ? [k] : []));
	const levels = lorentzian.some((l) => l.kind === 'amplitudeDamping')
		? AD_MODE_LEVELS
		: s.pmLevels;
	const reg = makeRegister(s.nS, s.nA, modeQubits, modeQubits.length ? levels : 0);
	const T = s.ancillaHold;
	const M = exact ? 1 : Math.max(2, Math.round(steps));
	const generator = collectiveSpin(reg, 'z', 'S');
	if (s.nA > 0) axpy(s.ancillaWeight, 0, collectiveSpin(reg, 'z', 'A'), generator);
	const js = AXES.map((a) => collectiveSpin(reg, a, 'S'));
	const ja = AXES.map((a) => (s.nA > 0 ? collectiveSpin(reg, a, 'A') : zeros(reg.dim)));
	const ops: CMat[] = [];
	for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ops.push(matmul(js[i], ja[j]));
	ops.push(...ja, ...js);
	const hBath = modeQubits.length ? pseudomodeHamiltonian(reg, lorentzian) : zeros(reg.dim);
	const K = s.pulses.length;
	const nParams = controlCount(K);
	const bound = new Float64Array(nParams);
	for (const k of free) bound[k] = k < 15 ? s.controlBound : s.pulseBound;
	const noises = new Map<number, NoiseStep>();
	const noiseFor = (m: number) => {
		let step = noises.get(m);
		if (!step) {
			step = registerNoiseStep(reg, perQubit, T / m, exact);
			noises.set(m, step);
		}
		return step;
	};
	const sitesS = Array.from({ length: s.nS }, (_, k) => k);
	/** Pulse unitaries per step boundary; with `identities`, zero pulses become identities instead of being skipped. */
	const pulsesFor = (params: ArrayLike<number>, nSteps: number, identities = false) => {
		const pulses = new Map<number, CMat>();
		s.pulses.forEach((p, q) => {
			const vA = [params[15 + 3 * q], params[16 + 3 * q], params[17 + 3 * q]];
			const o = 15 + 3 * K + 3 * q;
			const vS = [params[o], params[o + 1], params[o + 2]];
			const b = pulseBoundary(p.time, T, nSteps);
			if (vA.every((x) => x === 0) && vS.every((x) => x === 0)) {
				if (identities && !pulses.has(b)) pulses.set(b, identity(reg.dim));
				return;
			}
			const rS = su2(vS);
			const rA = su2(vA);
			const u = liftQubitOperator(
				kronAll(Array.from({ length: reg.nQubits }, (_, k) => (sitesS.includes(k) ? rS : rA))),
				reg
			);
			const prev = pulses.get(b);
			pulses.set(b, prev ? matmul(u, prev) : u);
		});
		return pulses;
	};
	const staticFree = free.filter((k) => k < 15);
	const pulseFree = free.filter((k) => k >= 15);
	const hold = (params: ArrayLike<number>, m = M): HoldMap => {
		const nSteps = exact ? 1 : m;
		const h = zeros(reg.dim);
		h.re.set(hBath.re);
		h.im.set(hBath.im);
		for (const k of staticFree) if (params[k] !== 0) axpy(params[k], 0, ops[k], h);
		return new HoldMap({
			dims: reg.dims,
			nQubits: reg.nQubits,
			generator,
			hCtrl: h,
			noise: noiseFor(nSteps),
			steps: nSteps,
			t: T,
			pulses: pulsesFor(params, nSteps)
		});
	};
	let evaluator: GradientHold | null = null;
	const staticOps = ops.map((op, k) => (staticFree.includes(k) ? op : zeros(1)));
	const objective = (params: ArrayLike<number>, rho0: CMat, grad?: Float64Array): number => {
		if (exact) return qfiAndSld(...rhoPair(hold(params).forward(rho0))).qfi;
		evaluator ??= new GradientHold({
			dims: reg.dims,
			nQubits: reg.nQubits,
			generator,
			hBase: hBath,
			ops: staticOps,
			noise: noiseFor(M),
			steps: M,
			t: T
		});
		const masked = Float64Array.from(params, (v, k) => (k < 15 && !staticFree.includes(k) ? 0 : v));
		return evaluator.evaluate(
			masked,
			rho0,
			(p) => pulsesFor(p, M, !!grad),
			grad ? { out: grad, staticFree, pulseFree } : undefined
		);
	};
	return {
		role,
		setup: s,
		reg,
		iso: inputIsometry(reg, s.input as IsometryKind),
		generator,
		nParams,
		free,
		bound,
		steps: M,
		t: T,
		exact,
		hold,
		objective
	};
}

/** The companion (coupling off) exists only when the setup has a coupling entry on. */
export function hasCompanion(setup: Setup): boolean {
	return setup.nA > 0 && setup.coupling.some(Boolean);
}

export interface MziProblem {
	/** Particles n = setup.mziParticles. */
	n: number;
	reg: Register;
	isoFull: CRect;
	isoSym: CRect;
	/** Some channel in use isn't phase covariant, so a static bias δ J_z^T may help. */
	biasAllowed: boolean;
	/** |δ| ≤ setup.controlBound. */
	biasBound: number;
	/** Covariant: one exact step at any window, and no bias. */
	exact: boolean;
	/** Strang steps when not exact. */
	steps: number;
	/** Hold of the window t' ≤ 1 (noise for t' only) with bias δ. */
	hold(window: number, bias?: number, steps?: number): HoldMap;
}

/**
 * The fair MZI: particles taken in order from [S..., A...] with their
 * register's noise (the mirrored split), generator J_z^T.
 */
export function buildMzi(setup: Setup, steps: number): MziProblem {
	const all = qubitNoise(setup);
	const n = Math.max(1, Math.min(setup.mziParticles, all.length));
	const perQubit = all.slice(0, n);
	const covariant = perQubit.every((q) => isPhaseCovariant(q.markov, q.lorentzian));
	const exact = covariant;
	const modeQubits = exact ? [] : perQubit.flatMap((q, k) => (hasBath(q) ? [k] : []));
	const ad = perQubit.some((q) => hasBath(q) && q.lorentzian.kind === 'amplitudeDamping');
	const reg = makeRegister(
		n,
		0,
		modeQubits,
		modeQubits.length ? (ad ? AD_MODE_LEVELS : setup.pmLevels) : 0
	);
	const generator = collectiveSpin(reg, 'z', 'T');
	const hBath = modeQubits.length
		? pseudomodeHamiltonian(
				reg,
				perQubit.map((q) => q.lorentzian)
			)
		: zeros(reg.dim);
	const M = exact ? 1 : Math.max(1, Math.round(steps));
	const hold = (window: number, bias = 0, m = M): HoldMap => {
		const nSteps = exact ? 1 : m;
		const h = zeros(reg.dim);
		h.re.set(hBath.re);
		h.im.set(hBath.im);
		if (bias !== 0) axpy(bias, 0, generator, h);
		return new HoldMap({
			dims: reg.dims,
			nQubits: reg.nQubits,
			generator,
			hCtrl: h,
			noise: registerNoiseStep(reg, perQubit, window / nSteps, exact),
			steps: nSteps,
			t: window
		});
	};
	return {
		n,
		reg,
		isoFull: inputIsometry(reg, 'full'),
		isoSym: inputIsometry(reg, 'symT'),
		biasAllowed: !covariant,
		biasBound: setup.controlBound,
		exact,
		steps: M,
		hold
	};
}
