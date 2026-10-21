/**
 * Dense linear algebra on row-major Float64Arrays for the split engine's block
 * factorisation. Every inner loop is a contiguous dot product (four
 * accumulators, so the adds pipeline) or a contiguous axpy.
 */

/** Σ_{t<len} a[ao+t] · b[bo+t]. */
export function dot(a: Float64Array, ao: number, b: Float64Array, bo: number, len: number): number {
	let s0 = 0;
	let s1 = 0;
	let s2 = 0;
	let s3 = 0;
	let t = 0;
	for (; t + 3 < len; t += 4) {
		s0 += a[ao + t] * b[bo + t];
		s1 += a[ao + t + 1] * b[bo + t + 1];
		s2 += a[ao + t + 2] * b[bo + t + 2];
		s3 += a[ao + t + 3] * b[bo + t + 3];
	}
	for (; t < len; t++) s0 += a[ao + t] * b[bo + t];
	return s0 + s1 + s2 + s3;
}

let d2a = 0;
let d2b = 0;

/** Two dot products sharing the second operand: d2a = a·c, d2b = b·c (length len). */
function dot2(
	x: Float64Array,
	ao: number,
	bo: number,
	y: Float64Array,
	co: number,
	len: number
): void {
	let s0 = 0;
	let s1 = 0;
	let t0 = 0;
	let t1 = 0;
	let t = 0;
	for (; t + 1 < len; t += 2) {
		const c0 = y[co + t];
		const c1 = y[co + t + 1];
		s0 += x[ao + t] * c0;
		t0 += x[bo + t] * c0;
		s1 += x[ao + t + 1] * c1;
		t1 += x[bo + t + 1] * c1;
	}
	if (t < len) {
		const c0 = y[co + t];
		s0 += x[ao + t] * c0;
		t0 += x[bo + t] * c0;
	}
	d2a = s0 + s1;
	d2b = t0 + t1;
}

/**
 * In-place Cholesky A = L Lᵀ of a symmetric positive-definite m×m matrix.
 * Reads the lower triangle, writes L there and zeroes the strict upper
 * triangle. Returns false if a pivot is not positive.
 */
export function cholesky(a: Float64Array, m: number): boolean {
	let i = 0;
	// Rows in pairs: both rows reuse each loaded row j.
	for (; i + 1 < m; i += 2) {
		const r0 = i * m;
		const r1 = r0 + m;
		for (let j = 0; j <= i; j++) {
			const rj = j * m;
			dot2(a, r0, r1, a, rj, j);
			const s0 = a[r0 + j] - d2a;
			const s1 = a[r1 + j] - d2b;
			if (j === i) {
				if (!(s0 > 0)) return false;
				a[r0 + i] = Math.sqrt(s0);
			} else a[r0 + j] = s0 / a[rj + j];
			a[r1 + j] = s1 / a[rj + j];
		}
		const s = a[r1 + i + 1] - dot(a, r1, a, r1, i + 1);
		if (!(s > 0)) return false;
		a[r1 + i + 1] = Math.sqrt(s);
		for (let j = i + 1; j < m; j++) a[r0 + j] = 0;
		for (let j = i + 2; j < m; j++) a[r1 + j] = 0;
	}
	if (i < m) {
		const ri = i * m;
		for (let j = 0; j <= i; j++) {
			const rj = j * m;
			const s = a[ri + j] - dot(a, ri, a, rj, j);
			if (j === i) {
				if (!(s > 0)) return false;
				a[ri + i] = Math.sqrt(s);
			} else a[ri + j] = s / a[rj + j];
		}
	}
	return true;
}

/** Solve L x = b in place (L lower triangular); b starts at offset bo. */
export function forwardSolve(l: Float64Array, m: number, b: Float64Array, bo = 0): void {
	for (let i = 0; i < m; i++) b[bo + i] = (b[bo + i] - dot(l, i * m, b, bo, i)) / l[i * m + i];
}

/** Solve Lᵀ x = b in place (L lower triangular); b starts at offset bo. */
export function backSolve(l: Float64Array, m: number, b: Float64Array, bo = 0): void {
	for (let k = m - 1; k >= 0; k--) {
		const rk = k * m;
		const x = b[bo + k] / l[rk + k];
		b[bo + k] = x;
		for (let i = 0; i < k; i++) b[bo + i] -= l[rk + i] * x;
	}
}

/**
 * Lower-triangular L ↦ U = L⁻ᵀ (upper triangular, row-major). Row j of U is
 * column j of L⁻¹: U[j][i] = (δ_ij − Σ_{j≤k<i} L[i][k] U[j][k]) / L[i][i].
 */
export function inverseTranspose(l: Float64Array, m: number): Float64Array {
	const u = new Float64Array(m * m);
	let j = 0;
	// Rows j, j+1 of U in pairs: both reuse each loaded row i of L.
	for (; j + 1 < m; j += 2) {
		const r0 = j * m;
		const r1 = r0 + m;
		u[r0 + j] = 1 / l[r0 + j];
		u[r0 + j + 1] = (-l[r1 + j] * u[r0 + j]) / l[r1 + j + 1];
		u[r1 + j + 1] = 1 / l[r1 + j + 1];
		for (let i = j + 2; i < m; i++) {
			const ri = i * m;
			// U[j][i] = −(L[i][j] U[j][j] + Σ_{j+1≤k<i} L[i][k] U[j][k]) / L[i][i]
			dot2(u, r0 + j + 1, r1 + j + 1, l, ri + j + 1, i - j - 1);
			const d = l[ri + i];
			u[r0 + i] = -(l[ri + j] * u[r0 + j] + d2a) / d;
			u[r1 + i] = -d2b / d;
		}
	}
	if (j < m) u[j * m + j] = 1 / l[j * m + j];
	return u;
}

/** out = Uᵀ b for upper-triangular U (= L⁻¹ b when U = L⁻ᵀ). */
export function upperTMul(u: Float64Array, m: number, b: Float64Array, out: Float64Array): void {
	out.fill(0);
	for (let k = 0; k < m; k++) {
		const c = b[k];
		if (c === 0) continue;
		const rk = k * m;
		for (let i = k; i < m; i++) out[i] += u[rk + i] * c;
	}
}

/** out = U b for upper-triangular U (= L⁻ᵀ b when U = L⁻ᵀ). */
export function upperMul(u: Float64Array, m: number, b: Float64Array, out: Float64Array): void {
	for (let k = 0; k < m; k++) out[k] = dot(u, k * m + k, b, k, m - k);
}

/** Lower triangle of s ← s − U Uᵀ for upper-triangular U (U Uᵀ = E⁻¹ when U = L⁻ᵀ). */
export function subtractGram(s: Float64Array, u: Float64Array, m: number): void {
	for (let a = 0; a < m; a++) {
		const ra = a * m;
		let b = 0;
		for (; b + 1 <= a; b += 2) {
			dot2(u, b * m + a, (b + 1) * m + a, u, ra + a, m - a);
			s[ra + b] -= d2a;
			s[ra + b + 1] -= d2b;
		}
		if (b <= a) s[ra + b] -= dot(u, ra + a, u, b * m + a, m - a);
	}
}

/**
 * For each of `count` right-hand sides b_r (rows of b, length m): solve
 * L y = b_r in place, add e_r, then write U y to row r of x (U = L⁻ᵀ).
 * Two right-hand sides per pass share each loaded row of L and U.
 */
export function solveThenUpper(
	l: Float64Array,
	u: Float64Array,
	m: number,
	b: Float64Array,
	e: Float64Array,
	x: Float64Array,
	count: number
): void {
	let r = 0;
	for (; r + 1 < count; r += 2) {
		const o0 = r * m;
		const o1 = o0 + m;
		for (let i = 0; i < m; i++) {
			dot2(b, o0, o1, l, i * m, i);
			const d = l[i * m + i];
			b[o0 + i] = (b[o0 + i] - d2a) / d;
			b[o1 + i] = (b[o1 + i] - d2b) / d;
		}
		for (let k = 0; k < m; k++) {
			b[o0 + k] += e[o0 + k];
			b[o1 + k] += e[o1 + k];
		}
		for (let k = 0; k < m; k++) {
			dot2(b, o0 + k, o1 + k, u, k * m + k, m - k);
			x[o0 + k] = d2a;
			x[o1 + k] = d2b;
		}
	}
	for (; r < count; r++) {
		const o = r * m;
		forwardSolve(l, m, b, o);
		for (let k = 0; k < m; k++) b[o + k] += e[o + k];
		for (let k = 0; k < m; k++) x[o + k] = dot(u, k * m + k, b, o + k, m - k);
	}
}
