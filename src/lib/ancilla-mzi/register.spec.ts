import { describe, expect, it } from 'vitest';
import {
	type CMat,
	type CRect,
	compress,
	identity,
	kron,
	matmul,
	normFrob,
	scale,
	sub,
	zeros
} from './linalg';
import {
	collectiveSpin,
	embedSiteOperator,
	inputIsometry,
	liftQubitOperator,
	makeRegister,
	modeSite,
	partialTraceQubits,
	sigmaMinus,
	spinHalf,
	symmetricBasis
} from './register';

function dist(a: CMat, b: CMat): number {
	return normFrob(sub(a, b));
}

function isoGram(iso: CRect): CMat {
	return compress(iso, identity(iso.rows));
}

describe('Register', () => {
	it('orders qubits, then pseudomodes', () => {
		const reg = makeRegister(2, 1, [0, 2], 3);
		expect(reg.dims).toEqual([2, 2, 2, 3, 3]);
		expect(reg.dim).toBe(72);
		expect(reg.qubitDim).toBe(8);
		expect(modeSite(reg, 2)).toBe(4);
		expect(modeSite(reg, 1)).toBe(-1);
	});

	it('uses s = σ/2 with σ_z = diag(1, −1) and σ₋ = |0⟩⟨1|', () => {
		const sz = spinHalf('z');
		expect(Array.from(sz.re)).toEqual([0.5, 0, 0, -0.5]);
		// σ₋ |1⟩ = |0⟩
		expect(sigmaMinus().re[1]).toBe(1);
		// site 0 is the most significant index
		const e = embedSiteOperator(sz, 0, [2, 2]);
		expect(Array.from({ length: 4 }, (_, i) => e.re[i * 4 + i])).toEqual([0.5, 0.5, -0.5, -0.5]);
	});

	it('builds collective spins obeying [J_x, J_y] = i J_z', () => {
		const reg = makeRegister(2, 1, [1], 2);
		for (const which of ['S', 'A', 'T'] as const) {
			const jx = collectiveSpin(reg, 'x', which);
			const jy = collectiveSpin(reg, 'y', which);
			const jz = collectiveSpin(reg, 'z', which);
			const comm = sub(matmul(jx, jy), matmul(jy, jx));
			expect(dist(comm, scale(jz, 0, 1))).toBeLessThan(1e-12);
		}
	});

	it('symmetric basis is an isometry onto Dicke states', () => {
		const n = 4;
		const iso = symmetricBasis(n);
		expect(dist(isoGram(iso), identity(n + 1))).toBeLessThan(1e-12);
		const jz = collectiveSpin(makeRegister(n, 0), 'z', 'T');
		const m = compress(iso, jz);
		const expected = zeros(n + 1);
		for (let k = 0; k <= n; k++) expected.re[k * (n + 2)] = n / 2 - k;
		expect(dist(m, expected)).toBeLessThan(1e-12);
	});

	it('orders Sym(S) ⊗ Sym(A) as mS (nA + 1) + mA and puts modes in vacuum', () => {
		const reg = makeRegister(2, 1, [0, 1, 2], 2);
		const iso = inputIsometry(reg, 'sym');
		expect([iso.rows, iso.cols]).toEqual([64, 6]);
		expect(dist(isoGram(iso), identity(6))).toBeLessThan(1e-12);
		const jzs = compress(iso, collectiveSpin(reg, 'z', 'S'));
		const jza = compress(iso, collectiveSpin(reg, 'z', 'A'));
		for (let mS = 0; mS <= 2; mS++) {
			for (let mA = 0; mA <= 1; mA++) {
				const c = mS * 2 + mA;
				expect(jzs.re[c * 7]).toBeCloseTo(1 - mS, 12);
				expect(jza.re[c * 7]).toBeCloseTo(0.5 - mA, 12);
			}
		}
		const nb = embedSiteOperator(sigmaMinus(), 3, reg.dims); // b on the first mode (d = 2)
		expect(normFrob(compress(iso, matmul(nb, identity(64))))).toBe(0);
		expect(inputIsometry(reg, 'symT').cols).toBe(4);
		expect(inputIsometry(reg, 'full').cols).toBe(8);
	});

	it('traces out the pseudomodes', () => {
		const reg = makeRegister(1, 0, [0], 3);
		const q = zeros(2);
		q.re.set([0.3, 0.1, 0.1, 0.7]);
		q.im.set([0, 0.2, -0.2, 0]);
		const m = zeros(3);
		m.re.set([0.5, 0, 0, 0, 0.25, 0, 0, 0, 0.25]);
		expect(dist(partialTraceQubits(kron(q, m), reg), q)).toBeLessThan(1e-15);
		expect(dist(partialTraceQubits(liftQubitOperator(q, reg), reg), scale(q, 3))).toBeLessThan(
			1e-15
		);
	});
});
