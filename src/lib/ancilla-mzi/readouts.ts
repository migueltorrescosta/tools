/**
 * Attainable readouts (port of the Python `readout_fishers`): J_z error
 * propagation on S after a collective rotation of S, the weighted joint J_z
 * readout with a rotation per register, and parity on S and on S + A, each
 * maximised over its rotations by Nelder–Mead from a few seeded starts. With
 * nA = 0 (the MZI) S is the whole register.
 */
import type { Prng } from '$lib/symbolic-regression/prng';
import type { Readouts } from './types';
import { type CMat, adjoint, add, matmul, scale, zeros } from './linalg';
import { kronAll, su2 } from './build';
import { embedSiteOperator, spinHalf } from './register';
import { nelderMead } from './minimise';

/** Error-propagation Fisher information slope² / var of an observable; 0 on a dark fringe (var ≤ 1e-9). */
export function errorPropagation(rho: CMat, drho: CMat, obs: CMat, parity = false): number {
	const n = rho.n;
	let mean = 0;
	let slope = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			const k = i * n + j;
			const l = j * n + i;
			mean += rho.re[k] * obs.re[l] - rho.im[k] * obs.im[l];
			slope += drho.re[k] * obs.re[l] - drho.im[k] * obs.im[l];
		}
	}
	let second = 1;
	if (!parity) {
		const o2 = matmul(obs, obs);
		second = 0;
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				second += rho.re[i * n + j] * o2.re[j * n + i] - rho.im[i * n + j] * o2.im[j * n + i];
			}
		}
	}
	const v = second - mean * mean;
	return v <= 1e-9 ? 0 : (slope * slope) / v;
}

/** R† x R for a 2 × 2 x and R = exp(−i u · σ/2). */
function rotated(x: CMat, u: ArrayLike<number>): CMat {
	const r = su2(u);
	return matmul(adjoint(r), matmul(x, r));
}

export interface ReadoutObjectives {
	/** J_z^S after R_S(u). */
	epS(u: ArrayLike<number>): number;
	/** Parity of S after R_S(u). */
	parityS(u: ArrayLike<number>): number;
	/** cos(x6) J_z^S after R_S(x0:3) plus sin(x6) J_z^A after R_A(x3:6). */
	epJoint(x: ArrayLike<number>): number;
	/** Parity of S + A after R_S(x0:3) R_A(x3:6). */
	parityJoint(x: ArrayLike<number>): number;
}

/** The readout Fisher informations of the qubit state (ρ, dρ/dω) at given rotations. */
export function readoutObjectives(
	rho: CMat,
	drho: CMat,
	nS: number,
	nA: number
): ReadoutObjectives {
	const N = nS + nA;
	if (rho.n !== 2 ** N) throw new Error('readouts expect the qubit marginal');
	const dims = Array<number>(N).fill(2);
	const sz = spinHalf('z');
	const pz = scale(sz, 2);
	const id2 = zeros(2);
	id2.re[0] = id2.re[3] = 1;
	const spinSum = (m: CMat, from: number, to: number, w: number, out: CMat) => {
		for (let k = from; k < to; k++) add(out, scale(embedSiteOperator(m, k, dims), w), out);
		return out;
	};
	return {
		epS: (u) => errorPropagation(rho, drho, spinSum(rotated(sz, u), 0, nS, 1, zeros(rho.n))),
		parityS: (u) => {
			const m = rotated(pz, u);
			const obs = kronAll(Array.from({ length: N }, (_, k) => (k < nS ? m : id2)));
			return errorPropagation(rho, drho, obs, true);
		},
		epJoint: (x) => {
			const obs = spinSum(rotated(sz, [x[0], x[1], x[2]]), 0, nS, Math.cos(x[6]), zeros(rho.n));
			spinSum(rotated(sz, [x[3], x[4], x[5]]), nS, N, Math.sin(x[6]), obs);
			return errorPropagation(rho, drho, obs);
		},
		parityJoint: (x) => {
			const mS = rotated(pz, [x[0], x[1], x[2]]);
			const mA = rotated(pz, [x[3], x[4], x[5]]);
			const obs = kronAll(Array.from({ length: N }, (_, k) => (k < nS ? mS : mA)));
			return errorPropagation(rho, drho, obs, true);
		}
	};
}

/** max f over x ∈ R^dim by Nelder–Mead from `starts` uniform points in [−π, π]^dim. */
export function maximise(
	f: (x: number[]) => number,
	dim: number,
	prng: Prng,
	starts: number
): number {
	let best = 0;
	for (let s = 0; s < starts; s++) {
		const x0 = Array.from({ length: dim }, () => (2 * prng.next() - 1) * Math.PI);
		const res = nelderMead((x) => -f(x), x0, { maxIter: 600, xatol: 1e-7, fatol: 1e-12 });
		best = Math.max(best, -res.f);
	}
	return best;
}

/** Best readouts of a qubit state over the final rotations. */
export function readouts(
	rho: CMat,
	drho: CMat,
	nS: number,
	nA: number,
	prng: Prng,
	starts = 4
): Readouts {
	const f = readoutObjectives(rho, drho, nS, nA);
	const epSystem = maximise(f.epS, 3, prng, starts);
	const parityS = maximise(f.parityS, 3, prng, starts);
	if (nA === 0) {
		return { epSystem, epJoint: epSystem, parity: parityS, best: Math.max(epSystem, parityS) };
	}
	const epJoint = Math.max(maximise(f.epJoint, 7, prng, starts), epSystem);
	const parity = Math.max(maximise(f.parityJoint, 6, prng, starts), parityS);
	return { epSystem, epJoint, parity, best: Math.max(epSystem, epJoint, parity) };
}

/** Readouts that keep the best of each entry. */
export function maxReadouts(a: Readouts, b: Readouts): Readouts {
	return {
		epSystem: Math.max(a.epSystem, b.epSystem),
		epJoint: Math.max(a.epJoint, b.epJoint),
		parity: Math.max(a.parity, b.parity),
		best: Math.max(a.best, b.best)
	};
}
