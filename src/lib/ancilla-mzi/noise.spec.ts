import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/symbolic-regression/prng';
import type { LorentzianNoise, MarkovNoise } from './types';
import {
	type CMat,
	add,
	copy,
	eigh,
	frobInner,
	hermitianPart,
	kron,
	matmul,
	matmulAH,
	matmulBH,
	normFrob,
	scale,
	sub,
	trace,
	zeros
} from './linalg';
import {
	applyNoise,
	applyNoiseAdjoint,
	buildNoiseStep,
	closedFormDephasingMap,
	isPhaseCovariant,
	lorentzianExponent,
	markovGenerator,
	modeLossMap,
	pseudomodeHamiltonian,
	registerNoiseStep,
	siteMap
} from './noise';
import { bosonLowering, embedSiteOperator, makeRegister, spinHalf } from './register';

const quiet: MarkovNoise = {
	dephasing: 0,
	amplitudeDamping: 0,
	nbar: 0,
	depolarizing: 0,
	transverse: 0
};
const noBath: LorentzianNoise = { kind: 'none', gamma: 0, lambda: 1 };

function randomDensity(n: number, prng: Prng): CMat {
	const a = zeros(n);
	for (let k = 0; k < n * n; k++) {
		a.re[k] = prng.normal();
		a.im[k] = prng.normal();
	}
	const rho = matmulBH(a, a);
	return scale(rho, 1 / trace(rho).re);
}

function randomHermitian(n: number, prng: Prng): CMat {
	const a = zeros(n);
	for (let k = 0; k < n * n; k++) {
		a.re[k] = prng.normal();
		a.im[k] = prng.normal();
	}
	return hermitianPart(a);
}

/** Apply a single-qubit map to a 2×2 matrix. */
function onQubit(map: CMat, rho: CMat): CMat {
	const out = copy(rho);
	applyNoise(buildNoiseStep([2], [{ site: 0, map }]), out);
	return out;
}

/** Row-major superoperator Σ K ⊗ K*. */
function krausSuperop(kraus: CMat[]): CMat {
	const d = kraus[0].n;
	let out = zeros(d * d);
	for (const k of kraus) out = add(out, kron(k, { n: d, re: k.re, im: k.im.map((x) => -x) }));
	return out;
}

/** Choi matrix Σ |i⟩⟨j| ⊗ Φ(|i⟩⟨j|) of a row-major superoperator. */
function choi(map: CMat, d: number): CMat {
	const c = zeros(d * d);
	for (let i = 0; i < d; i++)
		for (let j = 0; j < d; j++)
			for (let k = 0; k < d; k++)
				for (let l = 0; l < d; l++) {
					const src = (k * d + l) * d * d + i * d + j;
					const dst = (i * d + k) * d * d + j * d + l;
					c.re[dst] = map.re[src];
					c.im[dst] = map.im[src];
				}
	return c;
}

/** Bloch vector (x, y, z) of a qubit state. */
function bloch(rho: CMat): [number, number, number] {
	return [2 * rho.re[1], -2 * rho.im[1], rho.re[0] - rho.re[3]];
}

describe('Markov site maps', () => {
	const prng = new Prng(7);
	const all: MarkovNoise = {
		dephasing: 0.4,
		amplitudeDamping: 0.7,
		nbar: 0.3,
		depolarizing: 0.2,
		transverse: 0.5
	};

	it('are trace preserving and completely positive', () => {
		for (const m of [all, { ...quiet, transverse: 1 }, { ...quiet, amplitudeDamping: 2 }]) {
			const map = siteMap(markovGenerator(m), 0.37);
			const rho = randomDensity(2, prng);
			expect(trace(onQubit(map, rho)).re).toBeCloseTo(1, 14);
			expect(eigh(choi(map, 2)).values[0]).toBeGreaterThan(-1e-13);
		}
	});

	it('match the Kraus closed forms of dephasing and amplitude damping', () => {
		const gamma = 0.7;
		const dt = 0.3;
		const eta = Math.exp(-gamma * dt);
		const id = zeros(2);
		id.re.set([Math.sqrt((1 + eta) / 2), 0, 0, Math.sqrt((1 + eta) / 2)]);
		const z = zeros(2);
		z.re.set([Math.sqrt((1 - eta) / 2), 0, 0, -Math.sqrt((1 - eta) / 2)]);
		const deph = siteMap(markovGenerator({ ...quiet, dephasing: gamma }), dt);
		expect(normFrob(sub(deph, krausSuperop([id, z])))).toBeLessThan(1e-14);

		const p = 1 - Math.exp(-1.3 * 0.2);
		const k0 = zeros(2);
		k0.re.set([1, 0, 0, Math.sqrt(1 - p)]);
		const k1 = zeros(2);
		k1.re.set([0, Math.sqrt(p), 0, 0]);
		const ad = siteMap(markovGenerator({ ...quiet, amplitudeDamping: 1.3 }), 0.2);
		expect(normFrob(sub(ad, krausSuperop([k0, k1])))).toBeLessThan(1e-14);
	});

	it('shrink the Bloch vector at the documented rates', () => {
		const rho = randomDensity(2, prng);
		const [x, y, z] = bloch(rho);
		const t = 0.8;
		const dep = bloch(onQubit(siteMap(markovGenerator({ ...quiet, depolarizing: 1.1 }), t), rho));
		const f = Math.exp(-1.1 * t);
		expect(dep[0]).toBeCloseTo(x * f, 13);
		expect(dep[1]).toBeCloseTo(y * f, 13);
		expect(dep[2]).toBeCloseTo(z * f, 13);
		const tr = bloch(onQubit(siteMap(markovGenerator({ ...quiet, transverse: 0.9 }), t), rho));
		const g = Math.exp(-0.9 * t);
		expect(tr[0]).toBeCloseTo(x, 13);
		expect(tr[1]).toBeCloseTo(y * g, 13);
		expect(tr[2]).toBeCloseTo(z * g, 13);
	});

	it('relax thermal damping to nbar / (2 nbar + 1) in |1⟩', () => {
		const nbar = 0.6;
		const map = siteMap(markovGenerator({ ...quiet, amplitudeDamping: 1, nbar }), 60);
		const out = onQubit(map, randomDensity(2, prng));
		expect(out.re[3]).toBeCloseTo(nbar / (2 * nbar + 1), 12);
		expect(Math.hypot(out.re[1], out.im[1])).toBeLessThan(1e-12);
	});
});

describe('mode loss and Lorentzian closed forms', () => {
	it('mode loss matches the exact boson-loss Kraus operators', () => {
		const d = 5;
		const lambda = 1;
		const dt = 0.1;
		const eta = Math.exp(-2 * lambda * dt);
		const binom = (n: number, k: number) => {
			let c = 1;
			for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
			return c;
		};
		const kraus = Array.from({ length: d }, (_, loss) => {
			const k = zeros(d);
			for (let n = loss; n < d; n++) {
				k.re[(n - loss) * d + n] = Math.sqrt(
					binom(n, loss) * eta ** (n - loss) * (1 - eta) ** loss
				);
			}
			return k;
		});
		expect(normFrob(sub(modeLossMap(lambda, d, dt), krausSuperop(kraus)))).toBeLessThan(1e-13);
	});

	it('has the Markov and Zeno limits of Γ(t)', () => {
		expect(lorentzianExponent(1, 1e4, 1)).toBeCloseTo(1, 3);
		const zeno = lorentzianExponent(1, 0.2, 0.01);
		expect(Math.abs(zeno / ((0.2 * 0.01 ** 2) / 2) - 1)).toBeLessThan(1e-2);
	});

	it('closed-form dephasing scales coherences by e^{−Γ}', () => {
		const rho = randomDensity(2, new Prng(1));
		const out = onQubit(closedFormDephasingMap(0.3), rho);
		expect(out.re[1]).toBeCloseTo(rho.re[1] * Math.exp(-0.3), 15);
		expect(out.im[2]).toBeCloseTo(rho.im[2] * Math.exp(-0.3), 15);
		expect(out.re[0]).toBe(rho.re[0]);
	});

	it('flags non-covariant channels', () => {
		expect(
			isPhaseCovariant(
				{ ...quiet, dephasing: 1, amplitudeDamping: 1, nbar: 1, depolarizing: 1 },
				noBath
			)
		).toBe(true);
		expect(isPhaseCovariant({ ...quiet, transverse: 0.1 }, noBath)).toBe(false);
		expect(isPhaseCovariant(quiet, { kind: 'dephasing', gamma: 1, lambda: 1 })).toBe(true);
		expect(isPhaseCovariant(quiet, { kind: 'amplitudeDamping', gamma: 1, lambda: 1 })).toBe(false);
	});
});

describe('pseudomode coupling', () => {
	it('dephasing commutes with s_z; Jaynes–Cummings conserves excitations', () => {
		const reg = makeRegister(1, 1, [0, 1], 3);
		const deph = pseudomodeHamiltonian(reg, [
			{ kind: 'dephasing', gamma: 1, lambda: 0.5 },
			{ kind: 'dephasing', gamma: 2, lambda: 0.5 }
		]);
		const jc = pseudomodeHamiltonian(reg, [
			{ kind: 'amplitudeDamping', gamma: 1, lambda: 0.5 },
			noBath
		]);
		const comm = (a: CMat, b: CMat) => normFrob(sub(matmul(a, b), matmul(b, a)));
		const sz0 = embedSiteOperator(spinHalf('z'), 0, reg.dims);
		const sz1 = embedSiteOperator(spinHalf('z'), 1, reg.dims);
		expect(comm(deph, sz0) + comm(deph, sz1)).toBeLessThan(1e-14);
		expect(normFrob(deph)).toBeGreaterThan(1);
		const b = embedSiteOperator(bosonLowering(3), 2, reg.dims);
		const excitations = sub(matmulAH(b, b), sz0);
		expect(comm(jc, excitations)).toBeLessThan(1e-14);
		expect(normFrob(sub(jc, hermitianPart(jc)))).toBe(0);
		// coupling strength sqrt(γλ/2) between |1, 0⟩ and |0, 1⟩
		const n = reg.dim;
		const from = 1 * 18 + 0;
		const to = 0 * 18 + 3;
		expect(jc.re[to * n + from]).toBeCloseTo(Math.sqrt(0.25), 14);
	});
});

describe('noise steps', () => {
	const reg = makeRegister(1, 1, [0, 1], 3);
	const sys = {
		markov: { ...quiet, dephasing: 0.3, amplitudeDamping: 0.2, nbar: 0.1 },
		lorentzian: { kind: 'dephasing', gamma: 1, lambda: 0.5 } as LorentzianNoise
	};
	const anc = {
		markov: { ...quiet, depolarizing: 0.4, transverse: 0.2 },
		lorentzian: { kind: 'amplitudeDamping', gamma: 0.8, lambda: 1.5 } as LorentzianNoise
	};
	const step = registerNoiseStep(reg, [sys, anc], 0.05);

	it('apply local maps that preserve trace and positivity', () => {
		const prng = new Prng(3);
		expect(step.sites.map((s) => s.d2)).toEqual([9, 4, 9, 4]);
		const rho = randomDensity(reg.dim, prng);
		const out = copy(rho);
		applyNoise(step, out);
		expect(trace(out).re).toBeCloseTo(1, 13);
		expect(eigh(out).values[0]).toBeGreaterThan(-1e-13);
		expect(normFrob(sub(out, rho))).toBeGreaterThan(1e-3);
	});

	it('matches the dense product of site maps', () => {
		// On qubits only: Φ = Φ_0 ⊗ Φ_1 ⊗ Φ_2 as a Kraus-free check on vec(ρ).
		const r = makeRegister(1, 1);
		const m0 = siteMap(markovGenerator({ ...quiet, amplitudeDamping: 0.9 }), 0.4);
		const m1 = siteMap(markovGenerator({ ...quiet, transverse: 0.7 }), 0.4);
		const s = buildNoiseStep(r.dims, [
			{ site: 0, map: m0 },
			{ site: 1, map: m1 }
		]);
		const rho = randomDensity(4, new Prng(9));
		const out = copy(rho);
		applyNoise(s, out);
		// Dense reference: vec index (i0 i1, j0 j1) ↔ (i0 j0) for site 0 and (i1 j1) for site 1.
		for (let i = 0; i < 4; i++)
			for (let j = 0; j < 4; j++) {
				let sr = 0;
				let si = 0;
				for (let k = 0; k < 4; k++)
					for (let l = 0; l < 4; l++) {
						const a = ((i >> 1) * 2 + (j >> 1)) * 4 + (k >> 1) * 2 + (l >> 1);
						const b = ((i & 1) * 2 + (j & 1)) * 4 + (k & 1) * 2 + (l & 1);
						const cr = m0.re[a] * m1.re[b] - m0.im[a] * m1.im[b];
						const ci = m0.re[a] * m1.im[b] + m0.im[a] * m1.re[b];
						sr += cr * rho.re[k * 4 + l] - ci * rho.im[k * 4 + l];
						si += cr * rho.im[k * 4 + l] + ci * rho.re[k * 4 + l];
					}
				expect(out.re[i * 4 + j]).toBeCloseTo(sr, 14);
				expect(out.im[i * 4 + j]).toBeCloseTo(si, 14);
			}
	});

	it('has the adjoint ⟨X, Φ(ρ)⟩ = ⟨Φ*(X), ρ⟩', () => {
		const prng = new Prng(4);
		const cf = registerNoiseStep(
			makeRegister(2, 1),
			[sys, sys, anc].map((n, k) => (k < 2 ? n : { ...n, lorentzian: noBath })),
			0.5,
			true
		);
		for (const s of [step, cf]) {
			const rho = randomDensity(s.dim, prng);
			const x = randomHermitian(s.dim, prng);
			const phiRho = copy(rho);
			applyNoise(s, phiRho);
			const phiX = copy(x);
			applyNoiseAdjoint(s, phiX);
			expect(frobInner(x, phiRho)).toBeCloseTo(frobInner(phiX, rho), 13);
		}
	});

	it('refuses a Lorentzian bath without a pseudomode unless closed form', () => {
		expect(() => registerNoiseStep(makeRegister(1, 0), [sys], 0.1)).toThrow();
		expect(() => registerNoiseStep(makeRegister(0, 1), [anc], 1, true)).toThrow();
	});
});
