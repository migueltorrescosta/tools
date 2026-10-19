/** Fair ratios, error estimate, readout ratios and bounds (port of the Python `fair_ratios`). */
import type { BestResult, Metrics, MziResult, Setup } from './types';

/** Minimum margin and number of δR in the significance criterion R ≥ 1 + max(0.01, 3 δR). */
const MIN_MARGIN = 0.01;
const SIGMA = 3;

/** The QFI a best result reports: the 2M re-evaluation once known. */
function bestQfi(b: BestResult): number {
	return b.qfiFine ?? b.qfi;
}

/** Relative gap of the two best seed optima; 0 with fewer than two. */
export function topTwoSpread(optima: readonly number[]): number {
	if (optima.length < 2) return 0;
	const s = [...optima].sort((a, b) => b - a);
	return (s[0] - s[1]) / Math.max(s[0], 1e-300);
}

/** Noiseless seminorm bound ((nS + |a| nA) T)². */
export function seminormBound(setup: Setup): number {
	return ((setup.nS + Math.abs(setup.ancillaWeight) * setup.nA) * setup.ancillaHold) ** 2;
}

/**
 * Parallel channel-extension bound for σ_z dephasing at rate γ on n particles,
 * max over t' ≤ 1 of n t'² η² / (1 − η²), η = e^{−γ t'}.
 */
export function dephasingExtensionBound(n: number, gamma: number): number {
	const f = (t: number) => {
		const eta2 = Math.exp(-2 * gamma * t);
		return (n * t * t * eta2) / -Math.expm1(-2 * gamma * t);
	};
	// f is unimodal in t: increasing up to its maximum near γt ≈ 0.8, then decreasing
	let a = 1e-9;
	let b = 1;
	if (f(1) >= f(1 - 1e-6)) return f(1);
	const r = (Math.sqrt(5) - 1) / 2;
	while (b - a > 1e-12) {
		const c = b - r * (b - a);
		const d = a + r * (b - a);
		if (f(c) > f(d)) b = d;
		else a = c;
	}
	return f((a + b) / 2);
}

/**
 * The common σ_z dephasing rate when every particle has only Markovian σ_z
 * dephasing, at one rate γ > 0; null otherwise.
 */
export function pureDephasingRate(setup: Setup): number | null {
	const regs = setup.nA > 0 ? [setup.noise.system, setup.noise.ancilla] : [setup.noise.system];
	const g = regs[0].markov.dephasing;
	if (!(g > 0)) return null;
	for (const r of regs) {
		const m = r.markov;
		const bath = r.lorentzian.kind !== 'none' && r.lorentzian.gamma > 0;
		if (m.dephasing !== g || m.amplitudeDamping || m.depolarizing || m.transverse || bath)
			return null;
	}
	return g;
}

interface MetricsInput {
	setup: Setup;
	mzi: MziResult;
	best: BestResult;
	/** Raw optimum of every finished setup seed. */
	optima: readonly number[];
	/** Best companion result (coupling off), null without one. */
	companion: BestResult | null;
}

export function computeMetrics({ setup, mzi, best, optima, companion }: MetricsInput): Metrics {
	const F = bestQfi(best);
	const trotter = best.qfiFine === null ? 0 : Math.abs(best.qfiFine - best.qfi) / best.qfi;
	const deltaR = trotter + topTwoSpread(optima);
	const R = F / mzi.qfiOpt;
	const s = mzi.standard;
	const gamma = pureDephasingRate(setup);
	return {
		R,
		Rfixed: F / mzi.qfiFixedWindow,
		Rstd: F / Math.max(s.product, s.noon, s.twinFock, s.oat),
		deltaR,
		significant: R >= 1 + Math.max(MIN_MARGIN, SIGMA * deltaR),
		Rint: companion ? F / bestQfi(companion) : null,
		readoutRatio: best.readouts ? best.readouts.best / mzi.readouts.best : null,
		attained: {
			ancilla: best.readouts ? best.readouts.best / F : null,
			mzi: mzi.readouts.best / mzi.qfiOpt
		},
		bounds: {
			seminorm: seminormBound(setup),
			channelExtension: gamma === null ? null : dephasingExtensionBound(setup.mziParticles, gamma)
		}
	};
}
