/**
 * Symmetric eigen-decomposition by cyclic Jacobi rotations, and inversion
 * through it. Small matrices only (the parametric fit's Hessian).
 * No DOM or Svelte imports.
 */

/** Sweeps over every off-diagonal pair; Jacobi converges quadratically, so a handful suffice. */
const MAX_SWEEPS = 60;

/**
 * Symmetric eigen-decomposition by cyclic Jacobi rotations.
 * Returns eigenvalues in ascending order; `vectors[i]` is the unit eigenvector of `values[i]`.
 */
export function symmetricEigen(a: number[][]): { values: number[]; vectors: number[][] } {
	const n = a.length;
	if (n === 0) return { values: [], vectors: [] };
	const A = a.map((row) => [...row]);
	const V = Array.from({ length: n }, (_, i) =>
		Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
	);
	let norm = 0;
	for (const row of A) for (const v of row) norm += v * v;
	const tol = 1e-30 * norm;

	for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
		let off = 0;
		for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
		if (off <= tol) break;
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				const apq = A[p][q];
				if (apq === 0) continue;
				const app = A[p][p];
				const aqq = A[q][q];
				const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
				const c = Math.cos(phi);
				const s = Math.sin(phi);
				A[p][p] = c * c * app - 2 * c * s * apq + s * s * aqq;
				A[q][q] = s * s * app + 2 * c * s * apq + c * c * aqq;
				A[p][q] = A[q][p] = 0;
				for (let i = 0; i < n; i++) {
					if (i !== p && i !== q) {
						const aip = A[i][p];
						const aiq = A[i][q];
						A[i][p] = A[p][i] = c * aip - s * aiq;
						A[i][q] = A[q][i] = s * aip + c * aiq;
					}
					const vip = V[i][p];
					const viq = V[i][q];
					V[i][p] = c * vip - s * viq;
					V[i][q] = s * vip + c * viq;
				}
			}
		}
	}

	const values = Array.from({ length: n }, (_, i) => A[i][i]);
	const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]);
	return { values: order.map((i) => values[i]), vectors: order.map((i) => V.map((row) => row[i])) };
}

/**
 * Invert a symmetric positive-definite matrix through its eigen-decomposition.
 * Returns null when it isn't (numerically) positive definite.
 */
export function invertSymmetric(a: number[][]): number[][] | null {
	const { values, vectors } = symmetricEigen(a);
	const n = values.length;

	// Not positive definite, numerically: the smallest eigenvalue is ≤ 1e-14 of the largest.
	if (!(values[0] > 1e-14 * Math.abs(values[n - 1]))) return null;

	// A⁻¹ = Σₖ vₖ vₖᵀ / λₖ
	const inv = Array.from({ length: n }, () => new Array(n).fill(0));
	for (let k = 0; k < n; k++) {
		const v = vectors[k];
		const w = 1 / values[k];
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) inv[i][j] += v[i] * v[j] * w;
	}
	return inv;
}
