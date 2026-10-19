/**
 * Qubit registers with optional pseudomodes, as in the Python engine.
 *
 * Sites: qubits first (S on 0..nS−1, then A), then one pseudomode per qubit
 * listed in `modeQubits`, in that order. Site 0 is the most significant
 * index in kron order. |0⟩ is index 0, s = σ/2 with σ_z = diag(1, −1), and
 * σ₋ = |0⟩⟨1|. Pseudomodes are truncated at `modeLevels` Fock states.
 */
import type { Axis } from './types';
import { type CMat, type CRect, kron, zeros } from './linalg';

export interface Register {
	nS: number;
	nA: number;
	nQubits: number;
	/** Fock cutoff d of every pseudomode (0 when there are none). */
	modeLevels: number;
	/** Qubit owning each pseudomode; mode k sits on site nQubits + k. */
	modeQubits: readonly number[];
	dims: readonly number[];
	/** Full Hilbert-space dimension. */
	dim: number;
	/** 2^nQubits. */
	qubitDim: number;
}

type SpinSet = 'S' | 'A' | 'T';
export type IsometryKind = 'sym' | 'full' | 'symT';

export function makeRegister(
	nS: number,
	nA: number,
	modeQubits: readonly number[] = [],
	modeLevels = 0
): Register {
	const nQubits = nS + nA;
	if (modeQubits.length > 0 && modeLevels < 2) throw new Error('pseudomodes need modeLevels >= 2');
	const dims = [...Array<number>(nQubits).fill(2), ...modeQubits.map(() => modeLevels)];
	return {
		nS,
		nA,
		nQubits,
		modeLevels: modeQubits.length ? modeLevels : 0,
		modeQubits: [...modeQubits],
		dims,
		dim: dims.reduce((p, d) => p * d, 1),
		qubitDim: 2 ** nQubits
	};
}

/** Site index of the pseudomode of a qubit, −1 when it has none. */
export function modeSite(reg: Register, qubit: number): number {
	const k = reg.modeQubits.indexOf(qubit);
	return k < 0 ? -1 : reg.nQubits + k;
}

/** Spin-1/2 operator s_axis = σ_axis / 2. */
export function spinHalf(axis: Axis): CMat {
	const s = zeros(2);
	if (axis === 'x') s.re.set([0, 0.5, 0.5, 0]);
	else if (axis === 'y') s.im.set([0, -0.5, 0.5, 0]);
	else s.re.set([0.5, 0, 0, -0.5]);
	return s;
}

/** σ₋ = |0⟩⟨1|. */
export function sigmaMinus(): CMat {
	const s = zeros(2);
	s.re[1] = 1;
	return s;
}

/** Truncated boson annihilation operator b on d levels. */
export function bosonLowering(d: number): CMat {
	const b = zeros(d);
	for (let n = 1; n < d; n++) b.re[(n - 1) * d + n] = Math.sqrt(n);
	return b;
}

/** op on one site, identity elsewhere. */
export function embedSiteOperator(op: CMat, site: number, dims: readonly number[]): CMat {
	const d = dims[site];
	let left = 1;
	for (let k = 0; k < site; k++) left *= dims[k];
	let right = 1;
	for (let k = site + 1; k < dims.length; k++) right *= dims[k];
	const n = left * d * right;
	const out = zeros(n);
	for (let l = 0; l < left; l++) {
		for (let a = 0; a < d; a++) {
			for (let b = 0; b < d; b++) {
				const xr = op.re[a * d + b];
				const xi = op.im[a * d + b];
				if (xr === 0 && xi === 0) continue;
				for (let r = 0; r < right; r++) {
					const idx = ((l * d + a) * right + r) * n + (l * d + b) * right + r;
					out.re[idx] = xr;
					out.im[idx] = xi;
				}
			}
		}
	}
	return out;
}

/** Qubit sites of S, A or the whole register T. */
function spinSites(reg: Register, which: SpinSet): number[] {
	const all = Array.from({ length: reg.nQubits }, (_, k) => k);
	if (which === 'S') return all.slice(0, reg.nS);
	if (which === 'A') return all.slice(reg.nS);
	return all;
}

/** J_axis = Σ_k s_axis^(k) over the sites of S, A or T, on the full space. */
export function collectiveSpin(reg: Register, axis: Axis, which: SpinSet): CMat {
	const out = zeros(reg.dim);
	const s = spinHalf(axis);
	for (const k of spinSites(reg, which)) {
		const e = embedSiteOperator(s, k, reg.dims);
		for (let i = 0; i < out.re.length; i++) {
			out.re[i] += e.re[i];
			out.im[i] += e.im[i];
		}
	}
	return out;
}

function binomial(n: number, k: number): number {
	let c = 1;
	for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
	return c;
}

function popcount(x: number): number {
	let c = 0;
	for (; x; x &= x - 1) c++;
	return c;
}

/**
 * Isometry (2^n × (n+1)) onto the symmetric subspace: column m is the
 * normalised Dicke state with m qubits in |1⟩ (J_z eigenvalue n/2 − m).
 */
export function symmetricBasis(n: number): CRect {
	const rows = 2 ** n;
	const cols = n + 1;
	const iso: CRect = {
		rows,
		cols,
		re: new Float64Array(rows * cols),
		im: new Float64Array(rows * cols)
	};
	for (let idx = 0; idx < rows; idx++) {
		const m = popcount(idx);
		iso.re[idx * cols + m] = 1 / Math.sqrt(binomial(n, m));
	}
	return iso;
}

/** a ⊗ b of rectangular matrices. */
function rectKron(a: CRect, b: CRect): CRect {
	const rows = a.rows * b.rows;
	const cols = a.cols * b.cols;
	const out: CRect = {
		rows,
		cols,
		re: new Float64Array(rows * cols),
		im: new Float64Array(rows * cols)
	};
	for (let i = 0; i < a.rows; i++) {
		for (let j = 0; j < a.cols; j++) {
			const xr = a.re[i * a.cols + j];
			const xi = a.im[i * a.cols + j];
			if (xr === 0 && xi === 0) continue;
			for (let k = 0; k < b.rows; k++) {
				for (let l = 0; l < b.cols; l++) {
					const yr = b.re[k * b.cols + l];
					const yi = b.im[k * b.cols + l];
					const idx = (i * b.rows + k) * cols + j * b.cols + l;
					out.re[idx] = xr * yr - xi * yi;
					out.im[idx] = xr * yi + xi * yr;
				}
			}
		}
	}
	return out;
}

/**
 * Isometry of the allowed inputs into the full space, pseudomodes in vacuum.
 * 'sym': Sym(S) ⊗ Sym(A), column mS (nA + 1) + mA; 'full': every qubit state;
 * 'symT': Sym of the whole register (the MZI).
 */
export function inputIsometry(reg: Register, kind: IsometryKind): CRect {
	let q: CRect;
	if (kind === 'full') {
		const n = reg.qubitDim;
		q = { rows: n, cols: n, re: new Float64Array(n * n), im: new Float64Array(n * n) };
		for (let i = 0; i < n; i++) q.re[i * n + i] = 1;
	} else if (kind === 'symT') {
		q = symmetricBasis(reg.nQubits);
	} else {
		q = symmetricBasis(reg.nS);
		if (reg.nA > 0) q = rectKron(q, symmetricBasis(reg.nA));
	}
	const rest = reg.dim / reg.qubitDim;
	if (rest === 1) return q;
	const out: CRect = {
		rows: reg.dim,
		cols: q.cols,
		re: new Float64Array(reg.dim * q.cols),
		im: new Float64Array(reg.dim * q.cols)
	};
	for (let i = 0; i < q.rows; i++) {
		for (let j = 0; j < q.cols; j++) {
			out.re[i * rest * q.cols + j] = q.re[i * q.cols + j];
			out.im[i * rest * q.cols + j] = q.im[i * q.cols + j];
		}
	}
	return out;
}

/** Trace out the pseudomodes, keeping the qubits. */
export function partialTraceQubits(rho: CMat, reg: Register): CMat {
	const keep = reg.qubitDim;
	const rest = reg.dim / keep;
	if (rest === 1) return { n: keep, re: Float64Array.from(rho.re), im: Float64Array.from(rho.im) };
	const out = zeros(keep);
	const n = reg.dim;
	for (let i = 0; i < keep; i++) {
		for (let j = 0; j < keep; j++) {
			let sr = 0;
			let si = 0;
			for (let a = 0; a < rest; a++) {
				const idx = (i * rest + a) * n + j * rest + a;
				sr += rho.re[idx];
				si += rho.im[idx];
			}
			out.re[i * keep + j] = sr;
			out.im[i * keep + j] = si;
		}
	}
	return out;
}

/** x ⊗ I_modes: a qubit operator on the full space. */
export function liftQubitOperator(x: CMat, reg: Register): CMat {
	const rest = reg.dim / reg.qubitDim;
	if (rest === 1) return { n: x.n, re: Float64Array.from(x.re), im: Float64Array.from(x.im) };
	const id = zeros(rest);
	for (let i = 0; i < rest; i++) id.re[i * rest + i] = 1;
	return kron(x, id);
}
