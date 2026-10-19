/** Random matrices and a dense Liouvillian reference, for the specs of this folder only. */
import type { Prng } from '$lib/prng';
import {
	type CMat,
	type CVec,
	axpy,
	copy,
	expm,
	hermitianPart,
	matmulBH,
	normFrob,
	scale,
	sub,
	trace,
	zeros
} from './linalg';
import { lindbladGenerator } from './noise';

export function randomMat(n: number, prng: Prng): CMat {
	const a = zeros(n);
	for (let k = 0; k < n * n; k++) {
		a.re[k] = prng.normal();
		a.im[k] = prng.normal();
	}
	return a;
}

export function randomHermitian(n: number, prng: Prng): CMat {
	return hermitianPart(randomMat(n, prng));
}

export function randomDensity(n: number, prng: Prng): CMat {
	const a = randomMat(n, prng);
	const rho = matmulBH(a, a);
	return scale(rho, 1 / trace(rho).re);
}

/** exp(−i H) for a random Hermitian H of norm ~ s. */
export function randomUnitary(n: number, prng: Prng, s = 1): CMat {
	return expm(scale(randomHermitian(n, prng), 0, -s));
}

export function dist(a: CMat, b: CMat): number {
	return normFrob(sub(a, b));
}

/** Apply a row-major superoperator to ρ. */
function applySuperop(map: CMat, rho: CMat): CMat {
	const out = zeros(rho.n);
	const n2 = rho.re.length;
	for (let r = 0; r < n2; r++) {
		let sr = 0;
		let si = 0;
		for (let c = 0; c < n2; c++) {
			const ar = map.re[r * n2 + c];
			const ai = map.im[r * n2 + c];
			sr += ar * rho.re[c] - ai * rho.im[c];
			si += ar * rho.im[c] + ai * rho.re[c];
		}
		out.re[r] = sr;
		out.im[r] = si;
	}
	return out;
}

/**
 * Dense reference hold: the Liouvillian of h + ω g with jump operators `ops`,
 * exponentiated per segment between pulses at the given fractions of t,
 * with dρ/dω by a central finite difference.
 */
export function liouvillianReference(
	h: CMat,
	g: CMat,
	ops: CMat[],
	pulses: { at: number; u: CMat }[],
	rho0: CMat,
	t = 1
): { rho: CMat; drho: CMat } {
	const evolve = (w: number) => {
		const hw = copy(h);
		axpy(w, 0, g, hw);
		const l = lindbladGenerator(hw, ops, h.n);
		let rho = copy(rho0);
		let now = 0;
		for (const seg of [...pulses, { at: t, u: null }]) {
			rho = applySuperop(expm(scale(l, seg.at - now)), rho);
			if (seg.u) rho = matmulBH(matmulPlain(seg.u, rho), seg.u);
			now = seg.at;
		}
		return rho;
	};
	const step = 1e-5;
	return {
		rho: evolve(0),
		drho: scale(sub(evolve(step), evolve(-step)), 1 / (2 * step))
	};
}

function matmulPlain(a: CMat, b: CMat): CMat {
	const n = a.n;
	const out = zeros(n);
	for (let i = 0; i < n; i++)
		for (let k = 0; k < n; k++)
			for (let j = 0; j < n; j++) {
				out.re[i * n + j] += a.re[i * n + k] * b.re[k * n + j] - a.im[i * n + k] * b.im[k * n + j];
				out.im[i * n + j] += a.re[i * n + k] * b.im[k * n + j] + a.im[i * n + k] * b.re[k * n + j];
			}
	return out;
}

/** ψ as a CVec from real amplitudes. */
export function realState(amps: number[]): CVec {
	return { re: Float64Array.from(amps), im: new Float64Array(amps.length) };
}
