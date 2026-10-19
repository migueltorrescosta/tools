/**
 * QFI of a controlled hold and its exact gradient with respect to the
 * controls, by one forward and one adjoint pass (instead of one hold per
 * control for finite differences).
 *
 * The hold is the Strang sequence of `HoldMap`. Each half step is
 * (A, B) = (e^{−iτH}, ∂_ω e^{−iτ(H + ωG)}), from the eigen-decomposition
 * H = W Λ W† with Daleckii–Krein divided differences: Ã = f(Λ),
 * B̃ = f^[1] ∘ G̃, f(x) = e^{−iτx}. With the adjoint pair (X, Y) = (−L², 2L) of
 * the final SLD L, δF = ⟨X, δρ⟩ + ⟨Y, δ∂ρ⟩; a unitary step contributes
 * 2 Re Tr(δA M_A) + 2 Re Tr(δB M_B), M_A = ρA†X + ∂ρA†Y + ρB†Y,
 * M_B = ρA†Y (states before the step, adjoints after it). Summed over the
 * steps and taken to the eigenbasis, a control K enters through
 * δÃ = f^[1] ∘ K̃ and δB̃_ij = Σ_m f^[2](λ_i, λ_m, λ_j)(G̃_im K̃_mj + K̃_im G̃_mj),
 * so every static control's derivative is 2 Re Tr(K Z) for one matrix Z.
 * Pulse derivatives use central differences of the pulse unitary alone.
 */
import {
	type CMat,
	copy,
	eigh,
	hermitianPart,
	matmul,
	matmulAH,
	matmulAHHerm,
	matmulBH,
	matmulHerm,
	scale,
	zeros
} from './linalg';
import { type NoiseStep, applyNoise, applyNoiseAdjoint } from './noise';
import { qfiAndSld } from './qfi';

export interface GradientHoldOptions {
	dims: readonly number[];
	nQubits: number;
	generator: CMat;
	/** ω- and control-independent part of H (the pseudomode coupling). */
	hBase: CMat;
	/** Static control operators, H = hBase + Σ p_k ops[k]. */
	ops: readonly CMat[];
	noise: NoiseStep;
	steps: number;
	t: number;
}

/** Pulse unitaries at step boundaries, rebuilt from the control vector. */
export type PulseBuilder = (params: ArrayLike<number>) => Map<number, CMat>;

type Op = { kind: 'h' } | { kind: 'f' } | { kind: 'n' } | { kind: 'p'; boundary: number };

/** Below this spread τ |λ_x − λ_z| the second divided difference uses f''(mean) / 2. */
const TAYLOR = 1e-5;

function sinc(x: number): number {
	return Math.abs(x) < 1e-4 ? 1 - (x * x) / 6 : Math.sin(x) / x;
}

/** Holds the scratch buffers of one thread. */
export class GradientHold {
	private readonly dim: number;
	private readonly qubitDim: number;
	private readonly seq: Op[] = [];
	private readonly states: { r: CMat; dr: CMat }[] = [];
	private readonly tau: number;
	private readonly t: CMat[];

	constructor(private readonly o: GradientHoldOptions) {
		this.dim = o.dims.reduce((p, d) => p * d, 1);
		this.qubitDim = 2 ** o.nQubits;
		this.tau = o.t / o.steps / 2;
		this.t = Array.from({ length: 7 }, () => zeros(this.dim));
	}

	private sequence(pulses: ReadonlyMap<number, CMat>): Op[] {
		const seq: Op[] = [{ kind: 'h' }];
		for (let step = 1; step <= this.o.steps; step++) {
			seq.push({ kind: 'n' });
			if (step === this.o.steps) seq.push({ kind: 'h' });
			else if (pulses.has(step))
				seq.push({ kind: 'h' }, { kind: 'p', boundary: step }, { kind: 'h' });
			else seq.push({ kind: 'f' });
		}
		return seq;
	}

	/**
	 * QFI of the hold for input ρ0 (full space) at control vector `params`;
	 * with `grad`, also writes dQFI/dp_k for every k in `staticFree` and
	 * `pulseFree` (others are left untouched).
	 */
	evaluate(
		params: ArrayLike<number>,
		rho0: CMat,
		pulsesOf: PulseBuilder,
		grad?: { out: Float64Array; staticFree: readonly number[]; pulseFree: readonly number[] }
	): number {
		const { o, dim: n, tau } = this;
		const h = copy(o.hBase);
		for (let k = 0; k < o.ops.length; k++) {
			const p = params[k];
			if (p === 0) continue;
			const op = o.ops[k];
			for (let i = 0; i < h.re.length; i++) {
				h.re[i] += p * op.re[i];
				h.im[i] += p * op.im[i];
			}
		}
		const { values: lam, vectors: w } = eigh(h);
		// f(λ) = e^{−iτλ}; f1 = first divided differences
		const fr = new Float64Array(n);
		const fi = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			fr[i] = Math.cos(tau * lam[i]);
			fi[i] = -Math.sin(tau * lam[i]);
		}
		const f1r = new Float64Array(n * n);
		const f1i = new Float64Array(n * n);
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				// f[x, y] = −iτ e^{−iτ m} sinc(τ (x − y) / 2), m = (x + y) / 2: exact and stable
				const m = 0.5 * (lam[i] + lam[j]);
				const s = sinc(0.5 * tau * (lam[i] - lam[j]));
				f1r[i * n + j] = -tau * s * Math.sin(tau * m);
				f1i[i * n + j] = -tau * s * Math.cos(tau * m);
			}
		}
		const gt = matmulAH(w, matmul(o.generator, w));
		// eigenbasis A, B
		const bt = zeros(n);
		for (let k = 0; k < n * n; k++) {
			bt.re[k] = f1r[k] * gt.re[k] - f1i[k] * gt.im[k];
			bt.im[k] = f1r[k] * gt.im[k] + f1i[k] * gt.re[k];
		}
		const at = zeros(n);
		for (let i = 0; i < n; i++) {
			at.re[i * n + i] = fr[i];
			at.im[i * n + i] = fi[i];
		}
		const ah = matmulBH(matmul(w, at), w);
		const bh = matmulBH(matmul(w, bt), w);
		const af = matmul(ah, ah);
		const bf = matmul(bh, ah);
		const tmp = matmul(ah, bh);
		for (let k = 0; k < n * n; k++) {
			bf.re[k] += tmp.re[k];
			bf.im[k] += tmp.im[k];
		}
		const pulses = pulsesOf(params);
		const seq = this.sequence(pulses);
		const store = !!grad;
		while (store && this.states.length < seq.length)
			this.states.push({ r: zeros(n), dr: zeros(n) });

		// forward
		const [t1, t2, t3] = this.t;
		const r = hermitianPart(rho0);
		const dr = zeros(n);
		seq.forEach((op, idx) => {
			if (store) {
				copy(r, this.states[idx].r);
				copy(dr, this.states[idx].dr);
			}
			if (op.kind === 'h' || op.kind === 'f') {
				const a = op.kind === 'h' ? ah : af;
				const b = op.kind === 'h' ? bh : bf;
				matmulBH(r, a, t1);
				matmul(b, t1, t2);
				matmulBH(dr, a, t3);
				matmulHerm(a, t3, dr);
				addZPlusZH(dr, t2, n);
				matmulHerm(a, t1, r);
			} else if (op.kind === 'n') {
				applyNoise(o.noise, r);
				applyNoise(o.noise, dr);
			} else {
				const p = pulses.get(op.boundary) as CMat;
				matmulBH(r, p, t1);
				matmulHerm(p, t1, r);
				matmulBH(dr, p, t1);
				matmulHerm(p, t1, dr);
			}
		});
		const { qfi, sld } = qfiAndSld(this.traceModes(r), this.traceModes(dr));
		if (!grad) return qfi;

		// backward
		const x = this.liftModes(scale(matmul(sld, sld), -1));
		const y = this.liftModes(scale(sld, 2));
		const sA = { h: zeros(n), f: zeros(n) };
		const sB = { h: zeros(n), f: zeros(n) };
		const mPulse = new Map<number, CMat>();
		const [u1, u2, u3, u4] = this.t.slice(3);
		for (let idx = seq.length - 1; idx >= 0; idx--) {
			const op = seq[idx];
			const { r: rb, dr: drb } = this.states[idx];
			if (op.kind === 'h' || op.kind === 'f') {
				const a = op.kind === 'h' ? ah : af;
				const b = op.kind === 'h' ? bh : bf;
				// M_A += ρ (A†X + B†Y) + ∂ρ A†Y; M_B += ρ A†Y
				matmulAH(a, y, u1); // A†Y
				matmulAH(a, x, u2); // A†X
				matmulAH(b, y, u3); // B†Y
				addInto(u2, u3);
				accumulate(sA[op.kind], matmul(rb, u2, u4));
				accumulate(sA[op.kind], matmul(drb, u1, u4));
				accumulate(sB[op.kind], matmul(rb, u1, u4));
				// X ← A†XA + B†YA + A†YB; Y ← A†YA
				matmul(y, a, t1);
				matmulAH(b, t1, t2);
				matmul(x, a, t3);
				matmulAHHerm(a, t3, x);
				addZPlusZH(x, t2, n);
				matmulAHHerm(a, t1, y);
			} else if (op.kind === 'n') {
				applyNoiseAdjoint(o.noise, x);
				applyNoiseAdjoint(o.noise, y);
			} else {
				const p = pulses.get(op.boundary) as CMat;
				// M_P = ρ P†X + ∂ρ P†Y
				const m = matmul(rb, matmulAH(p, x, u1));
				accumulate(m, matmul(drb, matmulAH(p, y, u1), u4));
				mPulse.set(op.boundary, m);
				matmul(x, p, t1);
				matmulAHHerm(p, t1, x);
				matmul(y, p, t1);
				matmulAHHerm(p, t1, y);
			}
		}
		// fold the full steps into the half step
		accumulate(sA.h, matmul(ah, sA.f, u1));
		accumulate(sA.h, matmul(sA.f, ah, u1));
		accumulate(sA.h, matmul(bh, sB.f, u1));
		accumulate(sA.h, matmul(sB.f, bh, u1));
		accumulate(sB.h, matmul(ah, sB.f, u1));
		accumulate(sB.h, matmul(sB.f, ah, u1));
		if (grad.staticFree.length) {
			const z = this.staticAdjoint(w, lam, f1r, f1i, gt, sA.h, sB.h);
			for (const k of grad.staticFree) {
				// 2 Re Tr(K Z)
				const op = o.ops[k];
				let s = 0;
				for (let i = 0; i < n; i++) {
					for (let j = 0; j < n; j++) {
						const kr = op.re[i * n + j];
						const ki = op.im[i * n + j];
						if (kr === 0 && ki === 0) continue;
						s += kr * z.re[j * n + i] - ki * z.im[j * n + i];
					}
				}
				grad.out[k] = 2 * s;
			}
		}
		if (grad.pulseFree.length) {
			const hStep = 1e-6;
			const p = Float64Array.from(params);
			for (const k of grad.pulseFree) {
				const v = p[k];
				p[k] = v + hStep;
				const plus = pulsesOf(p);
				p[k] = v - hStep;
				const minus = pulsesOf(p);
				p[k] = v;
				let s = 0;
				for (const [bnd, m] of mPulse) {
					const a = plus.get(bnd);
					const c = minus.get(bnd);
					if (!a || !c) continue;
					// Re Tr(δP M)
					for (let i = 0; i < n; i++) {
						for (let j = 0; j < n; j++) {
							const dpr = (a.re[i * n + j] - c.re[i * n + j]) / (2 * hStep);
							const dpi = (a.im[i * n + j] - c.im[i * n + j]) / (2 * hStep);
							s += dpr * m.re[j * n + i] - dpi * m.im[j * n + i];
						}
					}
				}
				grad.out[k] = 2 * s;
			}
		}
		return qfi;
	}

	/**
	 * Z with Tr(δA_h S_A) + Tr(δB_h S_B) = Tr(K Z) for a change δH = K of the
	 * static Hamiltonian (Daleckii–Krein, first and second order).
	 */
	private staticAdjoint(
		w: CMat,
		lam: Float64Array,
		f1r: Float64Array,
		f1i: Float64Array,
		gt: CMat,
		sA: CMat,
		sB: CMat
	): CMat {
		const n = this.dim;
		const tau = this.tau;
		const sa = matmulAH(w, matmul(sA, w));
		const sb = matmulAH(w, matmul(sB, w));
		// C_ba = f1_ab SA_ba + Σ_i f2(i,a,b) SB_bi G_ia + Σ_j f2(a,b,j) G_bj SB_ja
		const c = zeros(n);
		for (let a = 0; a < n; a++) {
			for (let b = 0; b < n; b++) {
				const ab = a * n + b;
				const ba = b * n + a;
				let re = f1r[ab] * sa.re[ba] - f1i[ab] * sa.im[ba];
				let im = f1r[ab] * sa.im[ba] + f1i[ab] * sa.re[ba];
				for (let i = 0; i < n; i++) {
					// SB_bi G_ia
					const xr = sb.re[b * n + i] * gt.re[i * n + a] - sb.im[b * n + i] * gt.im[i * n + a];
					const xi = sb.re[b * n + i] * gt.im[i * n + a] + sb.im[b * n + i] * gt.re[i * n + a];
					// G_bi SB_ia (the j-sum with j → i)
					const yr = gt.re[b * n + i] * sb.re[i * n + a] - gt.im[b * n + i] * sb.im[i * n + a];
					const yi = gt.re[b * n + i] * sb.im[i * n + a] + gt.im[b * n + i] * sb.re[i * n + a];
					const [p1r, p1i] = f2(lam, f1r, f1i, n, tau, i, a, b);
					const [p2r, p2i] = f2(lam, f1r, f1i, n, tau, a, b, i);
					re += p1r * xr - p1i * xi + p2r * yr - p2i * yi;
					im += p1r * xi + p1i * xr + p2r * yi + p2i * yr;
				}
				c.re[ba] = re;
				c.im[ba] = im;
			}
		}
		return matmulBH(matmul(w, c), w);
	}

	private traceModes(a: CMat): CMat {
		const keep = this.qubitDim;
		const rest = this.dim / keep;
		const out = zeros(keep);
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

	private liftModes(x: CMat): CMat {
		const keep = this.qubitDim;
		const rest = this.dim / keep;
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

/** Second divided difference f[λi, λm, λj] of f(x) = e^{−iτx}, from the first ones. */
function f2(
	lam: Float64Array,
	f1r: Float64Array,
	f1i: Float64Array,
	n: number,
	tau: number,
	i: number,
	m: number,
	j: number
): [number, number] {
	const dij = lam[i] - lam[j];
	const dim = lam[i] - lam[m];
	const dmj = lam[m] - lam[j];
	const aij = Math.abs(dij);
	const aim = Math.abs(dim);
	const amj = Math.abs(dmj);
	if (Math.max(aij, aim, amj) * tau < TAYLOR) {
		// f''(mean)/2 = −τ² e^{−iτ mean}/2
		const mean = (lam[i] + lam[m] + lam[j]) / 3;
		return [-0.5 * tau * tau * Math.cos(tau * mean), 0.5 * tau * tau * Math.sin(tau * mean)];
	}
	// f[x, y, z] = (f[x, y] − f[y, z]) / (x − z), with the widest pair as (x, z)
	if (aij >= aim && aij >= amj) {
		// x = i, y = m, z = j
		return [(f1r[i * n + m] - f1r[m * n + j]) / dij, (f1i[i * n + m] - f1i[m * n + j]) / dij];
	}
	if (aim >= amj) {
		// x = i, y = j, z = m
		return [(f1r[i * n + j] - f1r[j * n + m]) / dim, (f1i[i * n + j] - f1i[j * n + m]) / dim];
	}
	// x = m, y = i, z = j
	return [(f1r[m * n + i] - f1r[i * n + j]) / dmj, (f1i[m * n + i] - f1i[i * n + j]) / dmj];
}

/** a += z + z†. */
function addZPlusZH(a: CMat, z: CMat, n: number): void {
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

function addInto(a: CMat, b: CMat): void {
	for (let k = 0; k < a.re.length; k++) {
		a.re[k] += b.re[k];
		a.im[k] += b.im[k];
	}
}

const accumulate = addInto;
