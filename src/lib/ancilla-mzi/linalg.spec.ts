import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import {
	adjoint,
	axpy,
	type CMat,
	copy,
	eigh,
	expm,
	fromParts,
	hermitianPart,
	identity,
	kron,
	matmul,
	matmulAH,
	matmulBH,
	normFrob,
	scale,
	solve,
	sub,
	trace,
	unitaryAndDerivative,
	zeros
} from './linalg';

function randomMat(n: number, prng: Prng): CMat {
	const a = zeros(n);
	for (let k = 0; k < n * n; k++) {
		a.re[k] = prng.normal();
		a.im[k] = prng.normal();
	}
	return a;
}

function randomHermitian(n: number, prng: Prng): CMat {
	return hermitianPart(randomMat(n, prng));
}

/** Unitary from the eigenvectors of a random Hermitian matrix. */
function randomUnitary(n: number, prng: Prng): CMat {
	return eigh(randomHermitian(n, prng)).vectors;
}

/** V diag(values) V†. */
function fromSpectrum(v: CMat, values: ArrayLike<number>): CMat {
	const n = v.n;
	const d = zeros(n);
	for (let i = 0; i < n; i++) d.re[i * n + i] = values[i];
	return matmulBH(matmul(v, d), v);
}

function dist(a: CMat, b: CMat): number {
	return normFrob(sub(a, b));
}

function checkEigh(a: CMat, tol = 1e-12) {
	const { values, vectors } = eigh(a);
	for (let i = 1; i < a.n; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
	expect(dist(fromSpectrum(vectors, values), a)).toBeLessThan(tol * Math.max(normFrob(a), 1e-300));
	expect(dist(matmulAH(vectors, vectors), identity(a.n))).toBeLessThan(1e-12);
	return values;
}

describe('dense products', () => {
	const prng = new Prng(11);
	const a = randomMat(5, prng);
	const b = randomMat(5, prng);

	it('matmulAH and matmulBH match explicit adjoints', () => {
		expect(dist(matmulAH(a, b), matmul(adjoint(a), b))).toBeLessThan(1e-12);
		expect(dist(matmulBH(a, b), matmul(a, adjoint(b)))).toBeLessThan(1e-12);
	});

	it('kron obeys the mixed-product rule and trace multiplies', () => {
		const c = randomMat(3, prng);
		const d = randomMat(3, prng);
		const small = randomMat(2, prng);
		const lhs = matmul(kron(c, small), kron(d, small));
		const rhs = kron(matmul(c, d), matmul(small, small));
		expect(dist(lhs, rhs)).toBeLessThan(1e-11);
		const t = trace(kron(c, small));
		const tc = trace(c);
		const ts = trace(small);
		expect(t.re).toBeCloseTo(tc.re * ts.re - tc.im * ts.im, 10);
		expect(t.im).toBeCloseTo(tc.re * ts.im + tc.im * ts.re, 10);
	});

	it('solve inverts', () => {
		const x = solve(a, b);
		expect(dist(matmul(a, x), b)).toBeLessThan(1e-10);
	});

	it('axpy and scale use complex scalars', () => {
		const y = copy(b);
		axpy(0.5, -2, a, y);
		const expected = scale(a, 0.5, -2);
		for (let k = 0; k < 25; k++) expected.re[k] += b.re[k];
		for (let k = 0; k < 25; k++) expected.im[k] += b.im[k];
		expect(dist(y, expected)).toBeLessThan(1e-14);
	});
});

describe('eigh', () => {
	it('decomposes random Hermitian matrices up to n = 64', () => {
		const prng = new Prng(1);
		for (const n of [1, 2, 3, 5, 8, 16, 33, 64]) checkEigh(randomHermitian(n, prng));
	});

	it('handles degenerate spectra', () => {
		const prng = new Prng(2);
		const u = randomUnitary(8, prng);
		const values = checkEigh(fromSpectrum(u, [1, 1, 1, 2, 2, 3, 3, 3]));
		expect(Array.from(values)).toEqual(
			[1, 1, 1, 2, 2, 3, 3, 3].map((x) => expect.closeTo(x, 12) as unknown as number)
		);
		checkEigh(identity(6));
		checkEigh(zeros(4));
	});

	it('resolves tiny eigenvalues of rank-deficient PSD matrices', () => {
		const prng = new Prng(3);
		for (const n of [4, 16, 36]) {
			const spectrum = Array.from({ length: n }, (_, i) =>
				i < n / 2 ? 0 : i === n / 2 ? 1e-12 : i === n / 2 + 1 ? 1e-8 : 1 / (i + 1)
			);
			const values = checkEigh(fromSpectrum(randomUnitary(n, prng), spectrum));
			const sorted = [...spectrum].sort((x, y) => x - y);
			for (let i = 0; i < n; i++) expect(Math.abs(values[i] - sorted[i])).toBeLessThan(1e-15);
		}
		// Rank-k Gram matrix B B†.
		const b = randomMat(12, prng);
		for (let i = 0; i < 12; i++)
			for (let j = 3; j < 12; j++) b.re[i * 12 + j] = b.im[i * 12 + j] = 0;
		const values = checkEigh(matmulBH(b, b));
		for (let i = 0; i < 9; i++) expect(Math.abs(values[i])).toBeLessThan(1e-13);
	});
});

describe('expm', () => {
	it('matches the spectral exponential of −i H, including large norms', () => {
		const prng = new Prng(4);
		for (const [n, s] of [
			[3, 0.001],
			[6, 0.3],
			[10, 1],
			[16, 40]
		]) {
			const h = scale(randomHermitian(n, prng), s);
			const { values, vectors } = eigh(h);
			// V diag(e^{-i l}) V†
			const d = zeros(n);
			for (let i = 0; i < n; i++) {
				d.re[i * n + i] = Math.cos(values[i]);
				d.im[i * n + i] = -Math.sin(values[i]);
			}
			const expected = matmulBH(matmul(vectors, d), vectors);
			expect(dist(expm(scale(h, 0, -1)), expected)).toBeLessThan(1e-12 * Math.max(1, s) * n);
		}
	});

	it('exponentiates a Jordan block exactly', () => {
		// exp(a I + b N), N the 4×4 shift: e^a sum_k b^k N^k / k!
		const n = 4;
		const ar = 0.3;
		const ai = -1.2;
		const br = 2.5;
		const bi = 0.7;
		const m = zeros(n);
		for (let i = 0; i < n; i++) {
			m.re[i * n + i] = ar;
			m.im[i * n + i] = ai;
			if (i + 1 < n) {
				m.re[i * n + i + 1] = br;
				m.im[i * n + i + 1] = bi;
			}
		}
		const e = expm(m);
		const ea = Math.exp(ar);
		let pr = 1;
		let pi = 0;
		let fact = 1;
		for (let k = 0; k < n; k++) {
			if (k > 0) {
				[pr, pi] = [pr * br - pi * bi, pr * bi + pi * br];
				fact *= k;
			}
			// coefficient e^{a} b^k / k!
			const cr = (ea * (Math.cos(ai) * pr - Math.sin(ai) * pi)) / fact;
			const ci = (ea * (Math.cos(ai) * pi + Math.sin(ai) * pr)) / fact;
			for (let i = 0; i + k < n; i++) {
				expect(e.re[i * n + i + k]).toBeCloseTo(cr, 12);
				expect(e.im[i * n + i + k]).toBeCloseTo(ci, 12);
			}
		}
		expect(e.re[n * n - n]).toBe(0);
	});

	it('exponentiates a non-normal 2×2 triangular matrix', () => {
		// exp [[a, b], [0, c]] = [[e^a, b (e^a − e^c)/(a − c)], [0, e^c]], here with a large b.
		const m = fromParts(2, [1, 30, 0, -2], [0.5, 0, 0, 0]);
		const e = expm(m);
		const exa = { re: Math.E * Math.cos(0.5), im: Math.E * Math.sin(0.5) };
		const exc = Math.exp(-2);
		// (e^a − e^c)/(a − c) with a − c = 3 + 0.5 i
		const nr = exa.re - exc;
		const ni = exa.im;
		const den = 9 + 0.25;
		const qr = (nr * 3 + ni * 0.5) / den;
		const qi = (ni * 3 - nr * 0.5) / den;
		expect(e.re[0]).toBeCloseTo(exa.re, 12);
		expect(e.im[0]).toBeCloseTo(exa.im, 12);
		expect(e.re[1] / 30).toBeCloseTo(qr, 12);
		expect(e.im[1] / 30).toBeCloseTo(qi, 12);
		expect(e.re[3]).toBeCloseTo(exc, 13);
	});
});

describe('unitaryAndDerivative', () => {
	it('matches a central finite difference of exp(−i τ (h + ω g))', () => {
		const prng = new Prng(5);
		const h = randomHermitian(6, prng);
		const g = randomHermitian(6, prng);
		const tau = 0.7;
		const { v, dv } = unitaryAndDerivative(h, g, tau);
		const at = (w: number) => {
			const hw = copy(h);
			axpy(w, 0, g, hw);
			return expm(scale(hw, 0, -tau));
		};
		expect(dist(v, at(0))).toBeLessThan(1e-13);
		const step = 1e-5;
		const fd = scale(sub(at(step), at(-step)), 1 / (2 * step));
		expect(dist(dv, fd)).toBeLessThan(1e-8);
	});
});
