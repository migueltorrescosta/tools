import { describe, it, expect } from 'vitest';
import { Prng } from '$lib/prng';
import {
	backSolve,
	cholesky,
	dot,
	forwardSolve,
	inverseTranspose,
	solveThenUpper,
	subtractGram,
	upperMul,
	upperTMul
} from './linalg';

// Naive references on row-major m×m arrays.
type Mat = Float64Array;
const at = (a: Mat, m: number, i: number, j: number) => a[i * m + j];

function matMul(a: Mat, b: Mat, m: number): Mat {
	const c = new Float64Array(m * m);
	for (let i = 0; i < m; i++)
		for (let j = 0; j < m; j++) {
			let s = 0;
			for (let k = 0; k < m; k++) s += at(a, m, i, k) * at(b, m, k, j);
			c[i * m + j] = s;
		}
	return c;
}

function transpose(a: Mat, m: number): Mat {
	const t = new Float64Array(m * m);
	for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) t[j * m + i] = a[i * m + j];
	return t;
}

function matVec(a: Mat, m: number, x: Float64Array): Float64Array {
	const y = new Float64Array(m);
	for (let i = 0; i < m; i++) for (let k = 0; k < m; k++) y[i] += at(a, m, i, k) * x[k];
	return y;
}

/** Random SPD matrix B Bᵀ + m I. */
function spd(prng: Prng, m: number): Mat {
	const b = Float64Array.from({ length: m * m }, () => prng.normal());
	const a = matMul(b, transpose(b, m), m);
	for (let i = 0; i < m; i++) a[i * m + i] += m;
	return a;
}

function vec(prng: Prng, m: number): Float64Array {
	return Float64Array.from({ length: m }, () => prng.normal());
}

/** Relative max-abs distance. */
function rel(a: ArrayLike<number>, b: ArrayLike<number>): number {
	let d = 0;
	let s = 1e-300;
	for (let i = 0; i < a.length; i++) {
		d = Math.max(d, Math.abs(a[i] - b[i]));
		s = Math.max(s, Math.abs(b[i]));
	}
	return d / s;
}

const TOL = 1e-10;
const SIZES = [1, 2, 3, 4, 5, 6, 7];

/** Cholesky factor of a random SPD matrix of size m, plus the matrix. */
function factor(prng: Prng, m: number) {
	const a = spd(prng, m);
	const l = Float64Array.from(a);
	expect(cholesky(l, m)).toBe(true);
	return { a, l };
}

describe('split linalg kernels against naive references', () => {
	it('dot matches a plain loop, with offsets and every tail length', () => {
		const prng = new Prng(1);
		const a = vec(prng, 20);
		const b = vec(prng, 20);
		for (let len = 0; len <= 9; len++) {
			let s = 0;
			for (let t = 0; t < len; t++) s += a[3 + t] * b[5 + t];
			expect(Math.abs(dot(a, 3, b, 5, len) - s)).toBeLessThanOrEqual(TOL * (1 + Math.abs(s)));
		}
	});

	it('cholesky gives lower-triangular L with L Lᵀ = A', () => {
		const prng = new Prng(2);
		for (const m of SIZES) {
			const { a, l } = factor(prng, m);
			for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) expect(at(l, m, i, j)).toBe(0);
			expect(rel(matMul(l, transpose(l, m), m), a)).toBeLessThan(TOL);
		}
	});

	it('cholesky rejects a matrix that is not positive definite', () => {
		for (const m of [1, 2, 3]) {
			const a = new Float64Array(m * m);
			a[(m - 1) * m + (m - 1)] = -1;
			for (let i = 0; i < m - 1; i++) a[i * m + i] = 1;
			expect(cholesky(a, m)).toBe(false);
		}
	});

	it('forwardSolve and backSolve solve L x = b and Lᵀ x = b, at an offset', () => {
		const prng = new Prng(3);
		for (const m of SIZES) {
			const { l } = factor(prng, m);
			const b = vec(prng, m);
			const buf = new Float64Array(m + 2);
			buf.set(b, 2);
			forwardSolve(l, m, buf, 2);
			expect(rel(matVec(l, m, buf.subarray(2)), b)).toBeLessThan(TOL);
			buf.set(b, 2);
			backSolve(l, m, buf, 2);
			expect(rel(matVec(transpose(l, m), m, buf.subarray(2)), b)).toBeLessThan(TOL);
		}
	});

	it('inverseTranspose gives U = L⁻ᵀ, upper triangular', () => {
		const prng = new Prng(4);
		for (const m of SIZES) {
			const { l } = factor(prng, m);
			const u = inverseTranspose(l, m);
			for (let i = 0; i < m; i++) for (let j = 0; j < i; j++) expect(at(u, m, i, j)).toBe(0);
			const id = new Float64Array(m * m);
			for (let i = 0; i < m; i++) id[i * m + i] = 1;
			expect(rel(matMul(transpose(l, m), u, m), id)).toBeLessThan(TOL);
		}
	});

	it('upperMul and upperTMul multiply by U and Uᵀ', () => {
		const prng = new Prng(5);
		for (const m of SIZES) {
			const u = inverseTranspose(factor(prng, m).l, m);
			const b = vec(prng, m);
			const out = new Float64Array(m);
			upperMul(u, m, b, out);
			expect(rel(out, matVec(u, m, b))).toBeLessThan(TOL);
			upperTMul(u, m, b, out);
			expect(rel(out, matVec(transpose(u, m), m, b))).toBeLessThan(TOL);
		}
	});

	it('subtractGram subtracts U Uᵀ on the lower triangle', () => {
		const prng = new Prng(6);
		for (const m of SIZES) {
			const u = inverseTranspose(factor(prng, m).l, m);
			const s0 = spd(prng, m);
			const s = Float64Array.from(s0);
			subtractGram(s, u, m);
			const g = matMul(u, transpose(u, m), m);
			for (let i = 0; i < m; i++)
				for (let j = 0; j <= i; j++) {
					const want = at(s0, m, i, j) - at(g, m, i, j);
					expect(Math.abs(at(s, m, i, j) - want)).toBeLessThanOrEqual(
						TOL * (1 + Math.abs(at(s0, m, i, j)))
					);
				}
		}
	});

	it('solveThenUpper computes U (L⁻¹ b_r + e_r) per row, for odd and even row counts', () => {
		const prng = new Prng(7);
		for (const m of SIZES)
			for (const count of [1, 2, 3, 4]) {
				const { l } = factor(prng, m);
				const u = inverseTranspose(l, m);
				const b = Float64Array.from({ length: m * count }, () => prng.normal());
				const e = Float64Array.from({ length: m * count }, () => prng.normal());
				const want = new Float64Array(m * count);
				for (let r = 0; r < count; r++) {
					const y = Float64Array.from(b.subarray(r * m, (r + 1) * m));
					forwardSolve(l, m, y);
					for (let k = 0; k < m; k++) y[k] += e[r * m + k];
					want.set(matVec(u, m, y), r * m);
				}
				const x = new Float64Array(m * count);
				solveThenUpper(l, u, m, b, e, x, count);
				expect(rel(x, want)).toBeLessThan(TOL);
			}
	});
});
