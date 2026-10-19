/**
 * A deterministic stand-in for the real engine: synthetic but plausible
 * snapshots on a timer, for UI work and specs. It computes no physics.
 */
import { validateSetup } from './limits';
import {
	controlCount,
	type AncillaEngine,
	type BestResult,
	type Budget,
	type Metrics,
	type MziResult,
	type Readouts,
	type Role,
	type RunEvent,
	type RunSnapshot,
	type SeedTrace,
	type Setup
} from './types';

/** mulberry32: small, fast and seeded. */
function prng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface FakeEngineOptions {
	/** Interval between progress events. */
	tickMs?: number;
	/** Ticks one seed takes to finish. */
	ticksPerSeed?: number;
}

/** Total single-particle decay rate of a register, in units of 1/t. */
function decayRate(setup: Setup, register: 'system' | 'ancilla'): number {
	const n = setup.noise[register];
	const m = n.markov;
	return (
		m.dephasing +
		m.amplitudeDamping * (1 + 2 * m.nbar) * 0.5 +
		m.depolarizing +
		m.transverse * 0.5 +
		(n.lorentzian.kind === 'none' ? 0 : n.lorentzian.gamma * 0.6)
	);
}

function seminormBound(setup: Setup): number {
	const norm = setup.nS + (setup.nA > 0 ? setup.ancillaWeight * setup.nA : 0);
	return (setup.ancillaHold * norm) ** 2;
}

/** max over t' <= 1 of N t'^2 eta^2 / (1 - eta^2), eta = e^{-gamma t'}. */
export function channelExtensionBound(N: number, gamma: number): number {
	if (gamma <= 0) return N * N;
	let best = 0;
	for (let i = 1; i <= 400; i++) {
		const t = i / 400;
		const eta2 = Math.exp(-2 * gamma * t);
		best = Math.max(best, (N * t * t * eta2) / (1 - eta2));
	}
	return best;
}

function fakeMzi(setup: Setup): MziResult {
	const N = setup.mziParticles;
	const g = Math.max(decayRate(setup, 'system'), 1e-6);
	// A plausible window: shorter as the noise grows
	const window = Math.min(1, 1 / (N * g));
	const at = (t: number, gain: number) => gain * t * t * Math.exp(-g * t * (1 + (gain - 1) / N));
	const qfiOpt = at(window, Math.min(N * N, N * (1 + 1 / g)));
	const qfiFixed = Math.min(qfiOpt, at(1, Math.min(N * N, N * (1 + 1 / g))));
	const covariant =
		setup.noise.system.markov.transverse === 0 &&
		setup.noise.ancilla.markov.transverse === 0 &&
		setup.noise.system.lorentzian.kind !== 'amplitudeDamping' &&
		setup.noise.ancilla.lorentzian.kind !== 'amplitudeDamping';
	const ep = qfiOpt * 0.9;
	return {
		particles: N,
		qfiOpt,
		qfiSym: qfiOpt * 0.97,
		window,
		bias: covariant ? 0 : 0.3,
		qfiFixedWindow: qfiFixed,
		standard: {
			product: at(window, N),
			noon: at(window, N * N) * Math.exp(-g * (N - 1) * window),
			twinFock: at(window, (N * (N + 2)) / 2) * 0.8,
			oat: qfiOpt * 0.93
		},
		readouts: { epSystem: ep, epJoint: ep, parity: qfiOpt * 0.85, best: ep }
	};
}

interface SeedState {
	role: Role;
	seed: number;
	target: number;
	params: number[];
	ticks: number;
}

export class FakeAncillaEngine implements AncillaEngine {
	private readonly tickMs: number;
	private readonly ticksPerSeed: number;
	private listeners = new Set<(event: RunEvent) => void>();
	private timer: ReturnType<typeof setInterval> | null = null;
	private setup: Setup | null = null;
	private budget: Budget | null = null;
	private rand: () => number = Math.random;
	private snapshot: RunSnapshot | null = null;
	private current: SeedState[] = [];
	private nextSeed = { setup: 0, companion: 0 };
	private ceiling = { setup: 1, companion: 1 };
	private finished: { setup: number[]; companion: number[] } = { setup: [], companion: [] };

	constructor(options: FakeEngineOptions = {}) {
		this.tickMs = options.tickMs ?? 250;
		this.ticksPerSeed = options.ticksPerSeed ?? 8;
	}

	start(setup: Setup, budget: Budget): void {
		this.halt();
		const errors = validateSetup(setup);
		if (errors.length > 0) {
			this.emit({ type: 'error', message: errors[0].message });
			return;
		}
		this.setup = structuredClone(setup);
		this.budget = { ...budget };
		this.rand = prng(budget.seed);
		const mzi = fakeMzi(setup);
		const hasCoupling = setup.coupling.some(Boolean);
		// The ancilla's best: above the MZI when the ancilla is controlled and on the generator
		const gain =
			0.9 +
			0.25 * Math.min(setup.ancillaWeight, 2) +
			(hasCoupling ? 0.08 : 0) +
			0.05 * setup.pulses.length;
		this.ceiling = {
			setup: mzi.qfiOpt * gain * setup.ancillaHold ** 2,
			companion: mzi.qfiOpt * (gain - 0.08) * setup.ancillaHold ** 2
		};
		this.nextSeed = { setup: 0, companion: 0 };
		this.finished = { setup: [], companion: [] };
		this.current = [];
		this.snapshot = {
			elapsedMs: 0,
			seedsDone: { setup: 0, companion: 0 },
			mzi,
			best: { setup: null, companion: null },
			traces: [],
			metrics: null
		};
		this.launch('setup');
		if (hasCoupling) this.launch('companion');
		this.resume();
	}

	stop(): void {
		if (!this.timer || !this.snapshot) return;
		this.halt();
		this.emit({ type: 'stopped', reason: 'user', snapshot: this.copy() });
	}

	continue(): void {
		if (this.timer || !this.snapshot) return;
		this.resume();
	}

	subscribe(listener: (event: RunEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispose(): void {
		this.halt();
		this.listeners.clear();
	}

	private halt() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	private resume() {
		this.timer = setInterval(() => this.tick(), this.tickMs);
	}

	private emit(event: RunEvent) {
		for (const listener of this.listeners) listener(event);
	}

	private copy(): RunSnapshot {
		return structuredClone(this.snapshot as RunSnapshot);
	}

	private launch(role: Role) {
		const setup = this.setup as Setup;
		const seed = this.nextSeed[role]++;
		// Seed 0 starts with every control off and ends lower; later seeds scatter
		const quality = seed === 0 ? 0.92 : 0.85 + 0.15 * this.rand();
		const params = Array.from({ length: controlCount(setup.pulses.length) }, () => 0);
		this.current.push({ role, seed, target: this.ceiling[role] * quality, params, ticks: 0 });
		this.snapshot?.traces.push({ role, seed, points: [], done: false });
	}

	private tick() {
		const snap = this.snapshot as RunSnapshot;
		const setup = this.setup as Setup;
		const budget = this.budget as Budget;
		snap.elapsedMs += this.tickMs;
		const perTick = budget.maxIter * 3;
		for (const s of [...this.current]) {
			s.ticks++;
			const trace = snap.traces.find((t) => t.role === s.role && t.seed === s.seed) as SeedTrace;
			const progress = 1 - Math.exp((-4 * s.ticks) / this.ticksPerSeed);
			trace.points.push({ evaluations: s.ticks * perTick, qfi: s.target * (0.3 + 0.7 * progress) });
			if (s.ticks < this.ticksPerSeed) continue;
			trace.done = true;
			s.params = this.fakeControls(setup);
			this.current = this.current.filter((c) => c !== s);
			this.finish(s, trace.points[trace.points.length - 1].qfi);
			this.launch(s.role);
		}
		snap.metrics = this.metrics();
		this.emit({ type: 'progress', snapshot: this.copy() });
	}

	private fakeControls(setup: Setup): number[] {
		const params = Array.from({ length: controlCount(setup.pulses.length) }, () => 0);
		const set = (i: number, bound: number) => {
			// About one in five pinned at the bound
			const r = this.rand();
			params[i] = r < 0.2 ? bound : (2 * this.rand() - 1) * bound * 0.9;
		};
		setup.coupling.forEach((on, i) => on && set(i, setup.controlBound));
		setup.fieldA.forEach((on, i) => on && set(9 + i, setup.controlBound));
		setup.fieldS.forEach((on, i) => on && set(12 + i, setup.controlBound));
		const K = setup.pulses.length;
		setup.pulses.forEach((p, m) => {
			for (let k = 0; k < 3; k++) {
				if (p.target !== 'S' && setup.nA > 0) set(15 + 3 * m + k, setup.pulseBound);
				if (p.target !== 'A') set(15 + 3 * K + 3 * m + k, setup.pulseBound);
			}
		});
		return params;
	}

	private finish(s: SeedState, qfi: number) {
		const snap = this.snapshot as RunSnapshot;
		const setup = this.setup as Setup;
		snap.seedsDone[s.role]++;
		this.finished[s.role].push(qfi);
		const best = snap.best[s.role];
		if (best && best.qfi >= qfi) return;
		const bounds = [
			...Array.from({ length: 15 }, () => setup.controlBound),
			...Array.from({ length: 6 * setup.pulses.length }, () => setup.pulseBound)
		];
		const dim = 2 ** (setup.nS + setup.nA);
		const readouts: Readouts = {
			epSystem: qfi * 0.7,
			epJoint: qfi * 0.86,
			parity: qfi * 0.8,
			best: qfi * 0.86
		};
		const result: BestResult = {
			role: s.role,
			seed: s.seed,
			qfi,
			params: s.params,
			psiRe: Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0)),
			psiIm: Array.from({ length: dim }, () => 0),
			evaluations: s.ticks * (this.budget as Budget).maxIter * 3,
			qfiFine: qfi * (1 - 0.002 * this.rand()),
			saturated: s.params.map((v, i) => Math.abs(Math.abs(v) - bounds[i]) < 1e-3),
			readouts
		};
		snap.best[s.role] = result;
	}

	private metrics(): Metrics | null {
		const snap = this.snapshot as RunSnapshot;
		const setup = this.setup as Setup;
		const best = snap.best.setup;
		const mzi = snap.mzi;
		if (!best || !mzi) return null;
		const sorted = [...this.finished.setup].sort((a, b) => b - a);
		const spread = sorted.length > 1 ? (sorted[0] - sorted[1]) / sorted[0] : 0;
		const trotter = best.qfiFine === null ? 0 : Math.abs(best.qfiFine - best.qfi) / best.qfi;
		const deltaR = trotter + spread;
		const R = best.qfi / mzi.qfiOpt;
		const companion = snap.best.companion;
		const dephasingOnly =
			setup.noise.system.markov.dephasing > 0 &&
			setup.noise.system.markov.amplitudeDamping === 0 &&
			setup.noise.system.markov.depolarizing === 0 &&
			setup.noise.system.markov.transverse === 0 &&
			setup.noise.system.lorentzian.kind === 'none';
		return {
			R,
			Rfixed: best.qfi / mzi.qfiFixedWindow,
			Rstd: best.qfi / Math.max(...Object.values(mzi.standard)),
			deltaR,
			significant: R >= 1 + Math.max(0.01, 3 * deltaR),
			Rint: setup.coupling.some(Boolean) && companion ? best.qfi / companion.qfi : null,
			readoutRatio: best.readouts ? best.readouts.best / mzi.readouts.best : null,
			attained: {
				ancilla: best.readouts ? best.readouts.best / best.qfi : null,
				mzi: mzi.readouts.best / mzi.qfiOpt
			},
			bounds: {
				seminorm: seminormBound(setup),
				channelExtension: dephasingOnly
					? channelExtensionBound(setup.nS + setup.nA, setup.noise.system.markov.dephasing)
					: null
			}
		};
	}
}
