/**
 * Hold-period channel of a register with a static control Hamiltonian,
 * instantaneous pulses and local noise, propagated by Strang splitting
 * (port of the Python HoldMap). The ω-derivative of the state is propagated
 * exactly alongside it, and the adjoint map gives the see-saw operator.
 *
 * Op sequence for M steps of dt = t / M: U(dt/2), then for each step a noise
 * step followed by U(dt) — or, at a pulse boundary, U(dt/2) P U(dt/2) — and
 * U(dt/2) after the last noise step.
 */
import {
	type CMat,
	hermitianPart,
	matmul,
	matmulAH,
	matmulAHHerm,
	matmulBH,
	matmulHerm,
	unitaryAndDerivative,
	zeros
} from './linalg';
import { type NoiseStep, applyNoise, applyNoiseAdjoint } from './noise';

export interface HoldOptions {
	/** Site dimensions, qubits first. */
	dims: readonly number[];
	/** Number of qubit sites, the subsystem kept by `forward`. */
	nQubits: number;
	/** dH/dω on the full space. */
	generator: CMat;
	/** Static ω-independent Hamiltonian on the full space (controls plus pseudomode coupling). */
	hCtrl: CMat;
	/** Noise of one step; callers build it for dt = t / steps (or the whole hold when steps = 1). */
	noise: NoiseStep;
	steps: number;
	/** Hold time (default 1). */
	t?: number;
	/** Unitary applied at step boundary k, 1 ≤ k ≤ steps − 1. */
	pulses?: ReadonlyMap<number, CMat>;
}

interface UnitaryOp {
	kind: 'u';
	a: CMat;
	/** dA/dω. */
	b: CMat;
}

interface PulseOp {
	kind: 'p';
	a: CMat;
}

type Op = UnitaryOp | PulseOp | { kind: 'n' };

export class HoldMap {
	readonly dims: readonly number[];
	readonly nQubits: number;
	readonly dim: number;
	readonly qubitDim: number;
	readonly steps: number;
	readonly t: number;
	private readonly noise: NoiseStep;
	private readonly ops: Op[];
	private readonly r: CMat;
	private readonly dr: CMat;
	private readonly t1: CMat;
	private readonly t2: CMat;
	private readonly t3: CMat;

	constructor(o: HoldOptions) {
		this.dims = o.dims;
		this.nQubits = o.nQubits;
		this.dim = o.dims.reduce((p, d) => p * d, 1);
		this.qubitDim = 2 ** o.nQubits;
		this.steps = o.steps;
		this.t = o.t ?? 1;
		this.noise = o.noise;
		if (o.noise.dim !== this.dim) throw new Error('noise step does not match the register');
		const pulses = o.pulses ?? new Map<number, CMat>();
		for (const k of pulses.keys()) {
			if (!Number.isInteger(k) || k < 1 || k >= o.steps)
				throw new Error(`pulse at invalid boundary ${k}`);
		}
		const dt = this.t / o.steps;
		const { v, dv } = unitaryAndDerivative(o.hCtrl, o.generator, dt / 2);
		const half: UnitaryOp = { kind: 'u', a: v, b: dv };
		const vf = matmul(v, v);
		const dvf = matmul(dv, v);
		const tmp = matmul(v, dv);
		for (let k = 0; k < dvf.re.length; k++) {
			dvf.re[k] += tmp.re[k];
			dvf.im[k] += tmp.im[k];
		}
		const full: UnitaryOp = { kind: 'u', a: vf, b: dvf };
		const noise = { kind: 'n' } as const;
		const ops: Op[] = [half];
		for (let step = 1; step <= o.steps; step++) {
			ops.push(noise);
			const p = pulses.get(step);
			if (step === o.steps) ops.push(half);
			else if (p) ops.push(half, { kind: 'p', a: p }, half);
			else ops.push(full);
		}
		this.ops = ops;
		this.r = zeros(this.dim);
		this.dr = zeros(this.dim);
		this.t1 = zeros(this.dim);
		this.t2 = zeros(this.dim);
		this.t3 = zeros(this.dim);
	}

	/**
	 * Propagate (ρ, dρ/dω) from ρ0 on the full space (its Hermitian part);
	 * returns fresh qubit marginals.
	 */
	forward(rho0: CMat): { rho: CMat; drho: CMat } {
		const { r, dr, t1, t2, t3 } = this;
		const n = this.dim;
		hermitianPart(rho0, r);
		dr.re.fill(0);
		dr.im.fill(0);
		for (const op of this.ops) {
			if (op.kind === 'u') {
				// rv = r a†; x = b rv; dr = a (dr a†) + x + x†; r = a rv
				matmulBH(r, op.a, t1);
				matmul(op.b, t1, t2);
				matmulBH(dr, op.a, t3);
				matmulHerm(op.a, t3, dr);
				addHermitianPart2(dr, t2, n);
				matmulHerm(op.a, t1, r);
			} else if (op.kind === 'n') {
				applyNoise(this.noise, r);
				applyNoise(this.noise, dr);
			} else {
				matmulBH(r, op.a, t1);
				matmulHerm(op.a, t1, r);
				matmulBH(dr, op.a, t1);
				matmulHerm(op.a, t1, dr);
			}
		}
		return { rho: this.traceModes(r), drho: this.traceModes(dr) };
	}

	/**
	 * Hermitian X0 with ⟨X0, ρ0⟩ = ⟨x, ρ⟩ + ⟨y, dρ⟩ for Hermitian ρ0, from qubit
	 * operators x, y (only their Hermitian parts matter, and only those are used).
	 */
	adjoint(xq: CMat, yq: CMat): CMat {
		const { t1, t2, t3 } = this;
		const n = this.dim;
		const x = this.liftModes(hermitianPart(xq));
		const y = this.liftModes(hermitianPart(yq));
		for (let i = this.ops.length - 1; i >= 0; i--) {
			const op = this.ops[i];
			if (op.kind === 'u') {
				// ya = y a; z = b† ya; x = a† x a + z + z†; y = a† ya
				matmul(y, op.a, t1);
				matmulAH(op.b, t1, t2);
				matmul(x, op.a, t3);
				matmulAHHerm(op.a, t3, x);
				addHermitianPart2(x, t2, n);
				matmulAHHerm(op.a, t1, y);
			} else if (op.kind === 'n') {
				applyNoiseAdjoint(this.noise, x);
				applyNoiseAdjoint(this.noise, y);
			} else {
				matmul(x, op.a, t1);
				matmulAHHerm(op.a, t1, x);
				matmul(y, op.a, t1);
				matmulAHHerm(op.a, t1, y);
			}
		}
		return x;
	}

	/** Trace out every site beyond the qubits into a fresh matrix. */
	private traceModes(a: CMat): CMat {
		const keep = this.qubitDim;
		const rest = this.dim / keep;
		const out = zeros(keep);
		if (rest === 1) {
			out.re.set(a.re);
			out.im.set(a.im);
			return out;
		}
		const n = this.dim;
		for (let i = 0; i < keep; i++) {
			for (let j = 0; j < keep; j++) {
				let sr = 0;
				let si = 0;
				for (let m = 0; m < rest; m++) {
					const idx = (i * rest + m) * n + j * rest + m;
					sr += a.re[idx];
					si += a.im[idx];
				}
				out.re[i * keep + j] = sr;
				out.im[i * keep + j] = si;
			}
		}
		return out;
	}

	/** x ⊗ I_modes. */
	private liftModes(x: CMat): CMat {
		const keep = this.qubitDim;
		const rest = this.dim / keep;
		if (x.n !== keep) throw new Error(`adjoint expects ${keep}×${keep} qubit operators`);
		if (rest === 1) return { n: keep, re: Float64Array.from(x.re), im: Float64Array.from(x.im) };
		const n = this.dim;
		const out = zeros(n);
		for (let i = 0; i < keep; i++) {
			for (let j = 0; j < keep; j++) {
				for (let m = 0; m < rest; m++) {
					const idx = (i * rest + m) * n + j * rest + m;
					out.re[idx] = x.re[i * keep + j];
					out.im[idx] = x.im[i * keep + j];
				}
			}
		}
		return out;
	}
}

/** a += z + z†. */
function addHermitianPart2(a: CMat, z: CMat, n: number): void {
	for (let i = 0; i < n; i++) {
		a.re[i * n + i] += 2 * z.re[i * n + i];
		for (let j = i + 1; j < n; j++) {
			const re = z.re[i * n + j] + z.re[j * n + i];
			const im = z.im[i * n + j] - z.im[j * n + i];
			a.re[i * n + j] += re;
			a.im[i * n + j] += im;
			a.re[j * n + i] += re;
			a.im[j * n + i] -= im;
		}
	}
}

/** A hold with no controls or pulses (the MZI). */
export function freeHold(
	dims: readonly number[],
	nQubits: number,
	generator: CMat,
	noise: NoiseStep,
	steps = 1,
	t = 1
): HoldMap {
	const dim = dims.reduce((p, d) => p * d, 1);
	return new HoldMap({ dims, nQubits, generator, hCtrl: zeros(dim), noise, steps, t });
}
