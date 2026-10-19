/**
 * Local noise: per-site superoperators applied to ρ by index arithmetic, never
 * as a full 4^N matrix. Superoperators use the row-major vec convention
 * vec(ρ)[i d + j] = ρ_ij, so ρ → K ρ K† is K ⊗ K*. Rates follow the
 * conventions in types.ts.
 */
import type { LorentzianNoise, MarkovNoise, RegisterNoise } from './types';
import {
	type CMat,
	add,
	adjoint,
	expm,
	identity,
	kron,
	matmul,
	matmulAH,
	scale,
	zeros
} from './linalg';
import {
	type Register,
	bosonLowering,
	embedSiteOperator,
	modeSite,
	sigmaMinus,
	spinHalf
} from './register';

function conj(a: CMat): CMat {
	return { n: a.n, re: Float64Array.from(a.re), im: a.im.map((x) => -x) };
}

/**
 * Lindblad generator −i(H ⊗ I − I ⊗ Hᵀ) + Σ C ⊗ C* − ½ C†C ⊗ I − ½ I ⊗ (C†C)ᵀ
 * of a d-level system in the row-major vec convention; `h` may be null.
 */
export function lindbladGenerator(
	h: CMat | null,
	ops: readonly CMat[],
	d = ops[0]?.n ?? h?.n ?? 0
): CMat {
	const id = identity(d);
	let out = zeros(d * d);
	if (h) {
		const comm = add(kron(h, id), scale(kron(id, conj(h)), -1));
		out = add(out, scale(comm, 0, -1));
	}
	for (const c of ops) {
		const cdc = matmulAH(c, c);
		out = add(out, kron(c, conj(c)));
		out = add(out, scale(add(kron(cdc, id), kron(id, conj(cdc))), -0.5));
	}
	return out;
}

/** Pauli matrices σ = 2 s. */
function pauli(axis: 'x' | 'y' | 'z'): CMat {
	return scale(spinHalf(axis), 2);
}

/** True when every rate of m is zero (nbar alone does nothing). */
function isMarkovZero(m: MarkovNoise): boolean {
	return (
		m.dephasing === 0 && m.amplitudeDamping === 0 && m.depolarizing === 0 && m.transverse === 0
	);
}

/** 4×4 Lindblad generator of the sum of every MarkovNoise term on one qubit. */
export function markovGenerator(m: MarkovNoise): CMat {
	const ops: CMat[] = [];
	if (m.dephasing > 0) ops.push(scale(pauli('z'), Math.sqrt(m.dephasing / 2)));
	if (m.amplitudeDamping > 0) {
		const lower = sigmaMinus();
		ops.push(scale(lower, Math.sqrt(m.amplitudeDamping * (m.nbar + 1))));
		if (m.nbar > 0) {
			const raise = zeros(2);
			raise.re[2] = 1;
			ops.push(scale(raise, Math.sqrt(m.amplitudeDamping * m.nbar)));
		}
	}
	if (m.depolarizing > 0) {
		for (const a of ['x', 'y', 'z'] as const)
			ops.push(scale(pauli(a), Math.sqrt(m.depolarizing / 4)));
	}
	if (m.transverse > 0) ops.push(scale(pauli('x'), Math.sqrt(m.transverse / 2)));
	return lindbladGenerator(null, ops, 2);
}

/** exp(generator dt). */
export function siteMap(generator: CMat, dt: number): CMat {
	return expm(scale(generator, dt));
}

/** Exact damping of a d-level mode, L = sqrt(2 λ) b, for time dt. */
export function modeLossMap(lambda: number, d: number, dt: number): CMat {
	const b = scale(bosonLowering(d), Math.sqrt(2 * lambda));
	return siteMap(lindbladGenerator(null, [b], d), dt);
}

/** Qubit dephasing map with coherence factor e^{−Γ}. */
export function closedFormDephasingMap(Gamma: number): CMat {
	const m = zeros(4);
	const c = Math.exp(-Gamma);
	m.re.set([1, 0, 0, 0, 0, c, 0, 0, 0, 0, c, 0, 0, 0, 0, 1]);
	return m;
}

/** Γ(t) = γ [t − (1 − e^{−λ t}) / λ] of the Lorentzian dephasing bath. */
export function lorentzianExponent(gamma: number, lambda: number, t: number): number {
	if (!(lambda > 0)) throw new Error('lambda must be positive');
	return gamma * (t + Math.expm1(-lambda * t) / lambda);
}

/**
 * Whether the hold channel commutes with rotations about z, so a static bias
 * along the generator cannot help. Transverse dephasing breaks it. Lorentzian
 * amplitude damping conserves excitations, but its bath is resonant with the
 * qubit, so a detuning changes the decay: it counts as non-covariant here.
 */
export function isPhaseCovariant(m: MarkovNoise, l: LorentzianNoise): boolean {
	return m.transverse === 0 && !(l.kind === 'amplitudeDamping' && l.gamma > 0);
}

/** One RegisterNoise per qubit: S qubits get `system`, A qubits `ancilla`. */
export function perQubitNoise(
	reg: Register,
	noise: { system: RegisterNoise; ancilla: RegisterNoise }
): RegisterNoise[] {
	return Array.from({ length: reg.nQubits }, (_, k) => (k < reg.nS ? noise.system : noise.ancilla));
}

/**
 * Qubit–pseudomode coupling on the full space, for every qubit that owns a
 * mode and has a Lorentzian bath. dephasing: g s_z (b + b†), g = sqrt(γ λ);
 * amplitudeDamping: sqrt(γ λ / 2)(σ₊ b + σ₋ b†).
 */
export function pseudomodeHamiltonian(reg: Register, lorentzian: readonly LorentzianNoise[]): CMat {
	let h = zeros(reg.dim);
	const b = bosonLowering(reg.modeLevels);
	for (let k = 0; k < reg.nQubits; k++) {
		const l = lorentzian[k];
		const site = modeSite(reg, k);
		if (site < 0 || l.kind === 'none' || l.gamma === 0) continue;
		const mb = embedSiteOperator(b, site, reg.dims);
		let term: CMat;
		if (l.kind === 'dephasing') {
			const sz = embedSiteOperator(spinHalf('z'), k, reg.dims);
			const x = zeros(reg.dim);
			// b + b†
			for (let i = 0; i < reg.dim; i++) {
				for (let j = 0; j < reg.dim; j++) {
					x.re[i * reg.dim + j] = mb.re[i * reg.dim + j] + mb.re[j * reg.dim + i];
				}
			}
			term = scale(matmul(sz, x), Math.sqrt(l.gamma * l.lambda));
		} else {
			const sm = embedSiteOperator(sigmaMinus(), k, reg.dims);
			// σ₋ b† + h.c.
			const t = matmul(sm, adjoint(mb));
			term = scale(add(t, adjoint(t)), Math.sqrt((l.gamma * l.lambda) / 2));
		}
		h = add(h, term);
	}
	return h;
}

/** A single-site superoperator ((d² × d²), row-major vec) on one site. */
interface SiteMap {
	site: number;
	map: CMat;
}

/** Sparse rows of a d² × d² map (CSR). */
interface Csr {
	ptr: Int32Array;
	col: Int32Array;
	re: Float64Array;
	im: Float64Array;
}

function toCsr(m: CMat, adjointMap: boolean): Csr {
	const n = m.n;
	const ptr = new Int32Array(n + 1);
	const col: number[] = [];
	const re: number[] = [];
	const im: number[] = [];
	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			// (M†)_{rc} = conj(M_{cr})
			const k = adjointMap ? c * n + r : r * n + c;
			const xr = m.re[k];
			const xi = adjointMap ? -m.im[k] : m.im[k];
			if (xr === 0 && xi === 0) continue;
			col.push(c);
			re.push(xr);
			im.push(xi);
		}
		ptr[r + 1] = col.length;
	}
	return { ptr, col: Int32Array.from(col), re: Float64Array.from(re), im: Float64Array.from(im) };
}

interface CompiledSite {
	d2: number;
	forward: Csr;
	adjoint: Csr;
	/** Row indices of ρ whose digit on the site is 0. */
	bases: Int32Array;
	/** Flat offset of local entry (a, b), index a d + b, from a block's base. */
	offsets: Int32Array;
}

/** One noise step: commuting site maps on a register with site dimensions `dims`. */
export interface NoiseStep {
	dims: readonly number[];
	dim: number;
	sites: CompiledSite[];
	bufRe: Float64Array;
	bufIm: Float64Array;
}

/** Compile site maps for repeated application; maps on distinct sites commute. */
export function buildNoiseStep(dims: readonly number[], maps: readonly SiteMap[]): NoiseStep {
	const dim = dims.reduce((p, d) => p * d, 1);
	let maxD2 = 1;
	const sites = maps.map(({ site, map }) => {
		const d = dims[site];
		const d2 = d * d;
		if (map.n !== d2) throw new Error(`site ${site}: map must be ${d2}×${d2}`);
		maxD2 = Math.max(maxD2, d2);
		let stride = 1;
		for (let k = site + 1; k < dims.length; k++) stride *= dims[k];
		const bases: number[] = [];
		for (let i = 0; i < dim; i++) if (Math.floor(i / stride) % d === 0) bases.push(i);
		const offsets = new Int32Array(d2);
		for (let a = 0; a < d; a++) {
			for (let b = 0; b < d; b++) offsets[a * d + b] = a * stride * dim + b * stride;
		}
		return {
			d2,
			forward: toCsr(map, false),
			adjoint: toCsr(map, true),
			bases: Int32Array.from(bases),
			offsets
		};
	});
	return { dims, dim, sites, bufRe: new Float64Array(maxD2), bufIm: new Float64Array(maxD2) };
}

function applySites(step: NoiseStep, rho: CMat, adjointMap: boolean): void {
	const { dim, bufRe: vr, bufIm: vi } = step;
	const { re, im } = rho;
	for (const s of step.sites) {
		const { d2, bases, offsets } = s;
		const { ptr, col, re: mr, im: mi } = adjointMap ? s.adjoint : s.forward;
		for (let bi = 0; bi < bases.length; bi++) {
			const rowBase = bases[bi] * dim;
			for (let bj = 0; bj < bases.length; bj++) {
				const base = rowBase + bases[bj];
				for (let r = 0; r < d2; r++) {
					const idx = base + offsets[r];
					vr[r] = re[idx];
					vi[r] = im[idx];
				}
				for (let r = 0; r < d2; r++) {
					let sr = 0;
					let si = 0;
					for (let k = ptr[r]; k < ptr[r + 1]; k++) {
						const c = col[k];
						sr += mr[k] * vr[c] - mi[k] * vi[c];
						si += mr[k] * vi[c] + mi[k] * vr[c];
					}
					const idx = base + offsets[r];
					re[idx] = sr;
					im[idx] = si;
				}
			}
		}
	}
}

/** ρ → Φ(ρ), in place. */
export function applyNoise(step: NoiseStep, rho: CMat): void {
	applySites(step, rho, false);
}

/** X → Φ*(X), the Hilbert–Schmidt adjoint (conjugate-transposed superoperators), in place. */
export function applyNoiseAdjoint(step: NoiseStep, x: CMat): void {
	applySites(step, x, true);
}

/**
 * Noise step of duration dt on a register: each qubit gets the Markov map of
 * its own register, each pseudomode the loss map of its qubit's Lorentzian
 * bath. A Lorentzian bath on a qubit without a mode is allowed only for
 * dephasing with `closedFormLorentzian`, and only for a step that is the whole
 * hold starting at 0 (Γ(dt) is not a semigroup): it is the uncontrolled
 * covariant case with steps = 1.
 */
export function registerNoiseStep(
	reg: Register,
	perQubit: readonly RegisterNoise[],
	dt: number,
	closedFormLorentzian = false
): NoiseStep {
	const maps: SiteMap[] = [];
	for (let k = 0; k < reg.nQubits; k++) {
		const { markov, lorentzian: l } = perQubit[k];
		let map: CMat | null = isMarkovZero(markov) ? null : siteMap(markovGenerator(markov), dt);
		const site = modeSite(reg, k);
		if (l.kind !== 'none' && l.gamma > 0) {
			if (site >= 0) {
				maps.push({ site, map: modeLossMap(l.lambda, reg.modeLevels, dt) });
			} else if (l.kind === 'dephasing' && closedFormLorentzian) {
				const cf = closedFormDephasingMap(lorentzianExponent(l.gamma, l.lambda, dt));
				map = map ? matmul(cf, map) : cf;
			} else {
				throw new Error(`qubit ${k}: Lorentzian ${l.kind} needs a pseudomode`);
			}
		}
		if (map) maps.push({ site: k, map });
	}
	return buildNoiseStep(reg.dims, maps);
}
