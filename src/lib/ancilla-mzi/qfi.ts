/** SLD quantum Fisher information and the see-saw optimal-input search (Macieszczak 2014). */
import type { Prng } from '$lib/prng';
import {
	type CMat,
	type CRect,
	type CVec,
	column,
	compress,
	eigh,
	hermitianPart,
	matmul,
	matmulAH,
	matmulBH,
	outer,
	rectApply,
	scale,
	vnorm,
	vzeros,
	zeros
} from './linalg';
import type { HoldMap } from './hold';

/** Eigenvalue-sum threshold below which a pair (i, j) is dropped from the QFI. */
const EIG_TOL = 1e-10;

/**
 * SLD QFI F = 2 Σ |⟨i|dρ|j⟩|² / (λ_i + λ_j) over pairs with λ_i + λ_j > eps,
 * and the SLD L = V [2 dρ_ij / (λ_i + λ_j)] V†.
 */
export function qfiAndSld(rho: CMat, drho: CMat, eps = EIG_TOL): { qfi: number; sld: CMat } {
	const n = rho.n;
	const { values, vectors: v } = eigh(rho);
	const d = matmulAH(v, matmul(hermitianPart(drho), v));
	const l = zeros(n);
	let qfi = 0;
	for (let i = 0; i < n; i++) {
		const li = Math.max(values[i], 0);
		for (let j = 0; j < n; j++) {
			const den = li + Math.max(values[j], 0);
			if (!(den > eps)) continue;
			const k = i * n + j;
			const f = 2 / den;
			l.re[k] = f * d.re[k];
			l.im[k] = f * d.im[k];
			qfi += f * (d.re[k] * d.re[k] + d.im[k] * d.im[k]);
		}
	}
	return { qfi, sld: matmulBH(matmul(v, l), v) };
}

/** iso ψ (ψ normalised by the caller). */
function embed(iso: CRect, psi: CVec): CMat {
	return outer(rectApply(iso, psi));
}

/** QFI of the hold for the input iso ψ. */
export function qfiOfState(hold: HoldMap, iso: CRect, psi: CVec): number {
	const { rho, drho } = hold.forward(embed(iso, psi));
	return qfiAndSld(rho, drho).qfi;
}

export interface SeesawResult {
	qfi: number;
	psi: CVec;
	iterations: number;
	history: number[];
}

function normalised(psi: CVec): CVec {
	const s = 1 / vnorm(psi);
	return { re: psi.re.map((x) => x * s), im: psi.im.map((x) => x * s) };
}

/**
 * Iterative optimal input in the span of iso: ψ ← top eigenvector of
 * iso† Φ*(2L, −L²) iso. Stops when the QFI changes by at most rtol relative,
 * or keeps the previous state when numerical noise makes it drop; monotone.
 */
export function seesaw(
	hold: HoldMap,
	iso: CRect,
	psi0: CVec,
	maxIter = 300,
	rtol = 1e-8
): SeesawResult {
	let psi = normalised(psi0);
	let best = psi;
	const history: number[] = [];
	for (let it = 1; it <= maxIter; it++) {
		const { rho, drho } = hold.forward(embed(iso, psi));
		const { qfi, sld } = qfiAndSld(rho, drho);
		const last = history[history.length - 1];
		if (history.length && qfi < last) return { qfi: last, psi: best, iterations: it, history };
		history.push(qfi);
		best = psi;
		if (history.length > 1 && Math.abs(qfi - last) <= rtol * Math.max(Math.abs(qfi), 1e-300)) {
			return { qfi, psi, iterations: it, history };
		}
		const m = compress(iso, hold.adjoint(scale(matmul(sld, sld), -1), scale(sld, 2)));
		const { vectors } = eigh(m);
		psi = column(vectors, m.n - 1);
	}
	return { qfi: history[history.length - 1], psi: best, iterations: maxIter, history };
}

/** Random unit vector: independent standard normal real and imaginary parts, normalised. */
export function randomState(dim: number, prng: Prng): CVec {
	const v = vzeros(dim);
	for (let i = 0; i < dim; i++) {
		v.re[i] = prng.normal();
		v.im[i] = prng.normal();
	}
	return normalised(v);
}
