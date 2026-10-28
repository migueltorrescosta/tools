import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { invertSymmetric, symmetricEigen } from './linalg';

describe('symmetricEigen', () => {
	it('reconstructs a random symmetric 5x5 matrix', () => {
		const prng = new Prng(123);
		const n = 5;
		const a = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			for (let j = i; j < n; j++) {
				const v = prng.normal();
				a[i][j] = v;
				a[j][i] = v;
			}
		}
		const { values, vectors } = symmetricEigen(a);
		// Reconstruct: A = Σₖ λₖ vₖ vₖᵀ
		const recon = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let k = 0; k < n; k++)
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++) recon[i][j] += values[k] * vectors[k][i] * vectors[k][j];
		let err = 0;
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				err = Math.max(err, Math.abs(recon[i][j] - a[i][j]));
			}
		}
		expect(err).toBeLessThan(1e-10);
	});

	it('vectors are orthonormal', () => {
		const prng = new Prng(456);
		const n = 5;
		const a = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			for (let j = i; j < n; j++) {
				const v = prng.normal();
				a[i][j] = v;
				a[j][i] = v;
			}
		}
		const { vectors } = symmetricEigen(a);
		for (let i = 0; i < n; i++) {
			let norm = 0;
			for (let k = 0; k < n; k++) norm += vectors[i][k] * vectors[i][k];
			expect(norm).toBeCloseTo(1, 10);
			for (let j = i + 1; j < n; j++) {
				let dot = 0;
				for (let k = 0; k < n; k++) dot += vectors[i][k] * vectors[j][k];
				expect(Math.abs(dot)).toBeLessThan(1e-10);
			}
		}
	});

	it('values are in ascending order', () => {
		const prng = new Prng(789);
		const n = 5;
		const a = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			for (let j = i; j < n; j++) {
				const v = prng.normal();
				a[i][j] = v;
				a[j][i] = v;
			}
		}
		const { values } = symmetricEigen(a);
		for (let i = 1; i < n; i++) {
			expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
		}
	});
});

describe('invertSymmetric', () => {
	it('inverse times matrix is identity', () => {
		const prng = new Prng(111);
		const n = 5;
		// Create a positive definite matrix: A = M^T M + I
		const m = Array.from({ length: n }, () => Array.from({ length: n }, () => prng.normal()));
		const a = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				let sum = 0;
				for (let k = 0; k < n; k++) {
					sum += m[k][i] * m[k][j];
				}
				a[i][j] = sum + (i === j ? 1 : 0);
			}
		}
		const inv = invertSymmetric(a);
		expect(inv).not.toBeNull();
		if (!inv) return;
		const prod = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				let sum = 0;
				for (let k = 0; k < n; k++) {
					sum += inv[i][k] * a[k][j];
				}
				prod[i][j] = sum;
			}
		}
		for (let i = 0; i < n; i++) {
			expect(prod[i][i]).toBeCloseTo(1, 10);
			for (let j = 0; j < n; j++) {
				if (i !== j) expect(Math.abs(prod[i][j])).toBeLessThan(1e-10);
			}
		}
	});

	it('returns null for a singular matrix', () => {
		const a = [
			[1, 2, 3],
			[2, 4, 6],
			[3, 6, 9]
		];
		expect(invertSymmetric(a)).toBeNull();
	});

	it('returns null for a matrix with negative eigenvalue', () => {
		const a = [
			[1, 0],
			[0, -1]
		];
		expect(invertSymmetric(a)).toBeNull();
	});

	it('returns null for a zero matrix', () => {
		const a = [
			[0, 0],
			[0, 0]
		];
		expect(invertSymmetric(a)).toBeNull();
	});
});
