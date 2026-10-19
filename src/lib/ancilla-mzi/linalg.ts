/**
 * Dense complex linear algebra on split real/imaginary Float64Arrays, row-major:
 * entry (i, j) of an n×n matrix sits at index i n + j. Functions taking an
 * `out` write into it and return it; `out` must not alias an input unless the
 * comment says it may.
 */

/** Square complex matrix. */
export interface CMat {
	n: number;
	re: Float64Array;
	im: Float64Array;
}

/** Complex column vector. */
export interface CVec {
	re: Float64Array;
	im: Float64Array;
}

/** Rectangular complex matrix (isometries into the register space). */
export interface CRect {
	rows: number;
	cols: number;
	re: Float64Array;
	im: Float64Array;
}

export function zeros(n: number): CMat {
	return { n, re: new Float64Array(n * n), im: new Float64Array(n * n) };
}

export function identity(n: number): CMat {
	const a = zeros(n);
	for (let i = 0; i < n; i++) a.re[i * n + i] = 1;
	return a;
}

/** Matrix from row-major parts; `im` defaults to zero. */
export function fromParts(n: number, re: ArrayLike<number>, im?: ArrayLike<number>): CMat {
	const a = zeros(n);
	a.re.set(re);
	if (im) a.im.set(im);
	return a;
}

export function copy(a: CMat, out: CMat = zeros(a.n)): CMat {
	out.re.set(a.re);
	out.im.set(a.im);
	return out;
}

export function vzeros(n: number): CVec {
	return { re: new Float64Array(n), im: new Float64Array(n) };
}

/** a b, cache-friendly i-k-j loop that skips zero entries of a. */
export function matmul(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	const { re: ar, im: ai } = a;
	const { re: br, im: bi } = b;
	const { re: or, im: oi } = out;
	or.fill(0);
	oi.fill(0);
	for (let i = 0; i < n; i++) {
		const row = i * n;
		for (let k = 0; k < n; k++) {
			const xr = ar[row + k];
			const xi = ai[row + k];
			if (xr === 0 && xi === 0) continue;
			const bk = k * n;
			for (let j = 0; j < n; j++) {
				const yr = br[bk + j];
				const yi = bi[bk + j];
				or[row + j] += xr * yr - xi * yi;
				oi[row + j] += xr * yi + xi * yr;
			}
		}
	}
	return out;
}

/** a† b without forming a†. */
export function matmulAH(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	const { re: ar, im: ai } = a;
	const { re: br, im: bi } = b;
	const { re: or, im: oi } = out;
	or.fill(0);
	oi.fill(0);
	for (let k = 0; k < n; k++) {
		const bk = k * n;
		for (let i = 0; i < n; i++) {
			const xr = ar[bk + i];
			const xi = -ai[bk + i];
			if (xr === 0 && xi === 0) continue;
			const row = i * n;
			for (let j = 0; j < n; j++) {
				const yr = br[bk + j];
				const yi = bi[bk + j];
				or[row + j] += xr * yr - xi * yi;
				oi[row + j] += xr * yi + xi * yr;
			}
		}
	}
	return out;
}

/**
 * a b when the product is known to be Hermitian (a sandwich such as u ρ u†):
 * computes the upper triangle and mirrors it, half the work of `matmul`.
 */
export function matmulHerm(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	const { re: ar, im: ai } = a;
	const { re: br, im: bi } = b;
	const { re: or, im: oi } = out;
	for (let i = 0; i < n; i++) {
		const row = i * n;
		for (let j = i; j < n; j++) {
			or[row + j] = 0;
			oi[row + j] = 0;
		}
		for (let k = 0; k < n; k++) {
			const xr = ar[row + k];
			const xi = ai[row + k];
			if (xr === 0 && xi === 0) continue;
			const bk = k * n;
			for (let j = i; j < n; j++) {
				const yr = br[bk + j];
				const yi = bi[bk + j];
				or[row + j] += xr * yr - xi * yi;
				oi[row + j] += xr * yi + xi * yr;
			}
		}
	}
	mirrorUpper(out);
	return out;
}

/** a† b when the product is known to be Hermitian; see `matmulHerm`. */
export function matmulAHHerm(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	const { re: ar, im: ai } = a;
	const { re: br, im: bi } = b;
	const { re: or, im: oi } = out;
	or.fill(0);
	oi.fill(0);
	for (let k = 0; k < n; k++) {
		const bk = k * n;
		for (let i = 0; i < n; i++) {
			const xr = ar[bk + i];
			const xi = -ai[bk + i];
			if (xr === 0 && xi === 0) continue;
			const row = i * n;
			for (let j = i; j < n; j++) {
				const yr = br[bk + j];
				const yi = bi[bk + j];
				or[row + j] += xr * yr - xi * yi;
				oi[row + j] += xr * yi + xi * yr;
			}
		}
	}
	mirrorUpper(out);
	return out;
}

/** Fill the strict lower triangle from the upper one and zero the diagonal's imaginary part. */
function mirrorUpper(a: CMat): void {
	const n = a.n;
	for (let i = 0; i < n; i++) {
		a.im[i * n + i] = 0;
		for (let j = i + 1; j < n; j++) {
			a.re[j * n + i] = a.re[i * n + j];
			a.im[j * n + i] = -a.im[i * n + j];
		}
	}
}

/** a b† without forming b†: row-by-row inner products. */
export function matmulBH(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	const { re: ar, im: ai } = a;
	const { re: br, im: bi } = b;
	const { re: or, im: oi } = out;
	for (let i = 0; i < n; i++) {
		const ri = i * n;
		for (let j = 0; j < n; j++) {
			const rj = j * n;
			let sr = 0;
			let si = 0;
			for (let k = 0; k < n; k++) {
				const xr = ar[ri + k];
				const xi = ai[ri + k];
				const yr = br[rj + k];
				const yi = bi[rj + k];
				sr += xr * yr + xi * yi;
				si += xi * yr - xr * yi;
			}
			or[ri + j] = sr;
			oi[ri + j] = si;
		}
	}
	return out;
}

export function adjoint(a: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			out.re[j * n + i] = a.re[i * n + j];
			out.im[j * n + i] = -a.im[i * n + j];
		}
	}
	return out;
}

/** a + b; `out` may alias a or b. */
export function add(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	for (let k = 0; k < a.re.length; k++) {
		out.re[k] = a.re[k] + b.re[k];
		out.im[k] = a.im[k] + b.im[k];
	}
	return out;
}

/** a − b; `out` may alias a or b. */
export function sub(a: CMat, b: CMat, out: CMat = zeros(a.n)): CMat {
	for (let k = 0; k < a.re.length; k++) {
		out.re[k] = a.re[k] - b.re[k];
		out.im[k] = a.im[k] - b.im[k];
	}
	return out;
}

/** y += (sr + i si) x, in place. */
export function axpy(sr: number, si: number, x: CMat, y: CMat): CMat {
	for (let k = 0; k < x.re.length; k++) {
		const xr = x.re[k];
		const xi = x.im[k];
		y.re[k] += sr * xr - si * xi;
		y.im[k] += sr * xi + si * xr;
	}
	return y;
}

/** (sr + i si) a; `out` may alias a. */
export function scale(a: CMat, sr: number, si = 0, out: CMat = zeros(a.n)): CMat {
	for (let k = 0; k < a.re.length; k++) {
		const xr = a.re[k];
		const xi = a.im[k];
		out.re[k] = sr * xr - si * xi;
		out.im[k] = sr * xi + si * xr;
	}
	return out;
}

/** a ⊗ b (a is the more significant index). */
export function kron(a: CMat, b: CMat): CMat {
	const na = a.n;
	const nb = b.n;
	const n = na * nb;
	const out = zeros(n);
	for (let i = 0; i < na; i++) {
		for (let j = 0; j < na; j++) {
			const xr = a.re[i * na + j];
			const xi = a.im[i * na + j];
			if (xr === 0 && xi === 0) continue;
			for (let k = 0; k < nb; k++) {
				const row = (i * nb + k) * n + j * nb;
				for (let l = 0; l < nb; l++) {
					const yr = b.re[k * nb + l];
					const yi = b.im[k * nb + l];
					out.re[row + l] = xr * yr - xi * yi;
					out.im[row + l] = xr * yi + xi * yr;
				}
			}
		}
	}
	return out;
}

export function trace(a: CMat): { re: number; im: number } {
	let re = 0;
	let im = 0;
	for (let i = 0; i < a.n; i++) {
		re += a.re[i * a.n + i];
		im += a.im[i * a.n + i];
	}
	return { re, im };
}

/** (a + a†) / 2; `out` may alias a. */
export function hermitianPart(a: CMat, out: CMat = zeros(a.n)): CMat {
	const n = a.n;
	for (let i = 0; i < n; i++) {
		out.re[i * n + i] = a.re[i * n + i];
		out.im[i * n + i] = 0;
		for (let j = i + 1; j < n; j++) {
			const re = 0.5 * (a.re[i * n + j] + a.re[j * n + i]);
			const im = 0.5 * (a.im[i * n + j] - a.im[j * n + i]);
			out.re[i * n + j] = re;
			out.im[i * n + j] = im;
			out.re[j * n + i] = re;
			out.im[j * n + i] = -im;
		}
	}
	return out;
}

/** Frobenius inner product Re Tr(a† b). */
export function frobInner(a: CMat, b: CMat): number {
	let s = 0;
	for (let k = 0; k < a.re.length; k++) s += a.re[k] * b.re[k] + a.im[k] * b.im[k];
	return s;
}

export function normFrob(a: CMat): number {
	return Math.sqrt(frobInner(a, a));
}

/** Maximum absolute column sum. */
export function norm1(a: CMat): number {
	const n = a.n;
	let best = 0;
	for (let j = 0; j < n; j++) {
		let s = 0;
		for (let i = 0; i < n; i++) s += Math.hypot(a.re[i * n + j], a.im[i * n + j]);
		if (s > best) best = s;
	}
	return best;
}

/** v v†. */
export function outer(v: CVec): CMat {
	const n = v.re.length;
	const out = zeros(n);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			out.re[i * n + j] = v.re[i] * v.re[j] + v.im[i] * v.im[j];
			out.im[i * n + j] = v.im[i] * v.re[j] - v.re[i] * v.im[j];
		}
	}
	return out;
}

/** Column j of a. */
export function column(a: CMat, j: number): CVec {
	const v = vzeros(a.n);
	for (let i = 0; i < a.n; i++) {
		v.re[i] = a.re[i * a.n + j];
		v.im[i] = a.im[i * a.n + j];
	}
	return v;
}

/** a v. */
export function matvec(a: CMat, v: CVec): CVec {
	return rectApply({ rows: a.n, cols: a.n, re: a.re, im: a.im }, v);
}

/** Euclidean norm of v. */
export function vnorm(v: CVec): number {
	let s = 0;
	for (let i = 0; i < v.re.length; i++) s += v.re[i] * v.re[i] + v.im[i] * v.im[i];
	return Math.sqrt(s);
}

/** iso v for a rectangular iso. */
export function rectApply(iso: CRect, v: CVec): CVec {
	const out = vzeros(iso.rows);
	for (let i = 0; i < iso.rows; i++) {
		let sr = 0;
		let si = 0;
		for (let k = 0; k < iso.cols; k++) {
			const xr = iso.re[i * iso.cols + k];
			const xi = iso.im[i * iso.cols + k];
			sr += xr * v.re[k] - xi * v.im[k];
			si += xr * v.im[k] + xi * v.re[k];
		}
		out.re[i] = sr;
		out.im[i] = si;
	}
	return out;
}

/** iso† x iso (cols × cols). */
export function compress(iso: CRect, x: CMat): CMat {
	const { rows, cols } = iso;
	// t = x iso (rows × cols)
	const tr = new Float64Array(rows * cols);
	const ti = new Float64Array(rows * cols);
	for (let i = 0; i < rows; i++) {
		for (let k = 0; k < rows; k++) {
			const xr = x.re[i * rows + k];
			const xi = x.im[i * rows + k];
			if (xr === 0 && xi === 0) continue;
			for (let j = 0; j < cols; j++) {
				const yr = iso.re[k * cols + j];
				const yi = iso.im[k * cols + j];
				tr[i * cols + j] += xr * yr - xi * yi;
				ti[i * cols + j] += xr * yi + xi * yr;
			}
		}
	}
	const out = zeros(cols);
	for (let k = 0; k < rows; k++) {
		for (let i = 0; i < cols; i++) {
			const xr = iso.re[k * cols + i];
			const xi = -iso.im[k * cols + i];
			if (xr === 0 && xi === 0) continue;
			for (let j = 0; j < cols; j++) {
				const yr = tr[k * cols + j];
				const yi = ti[k * cols + j];
				out.re[i * cols + j] += xr * yr - xi * yi;
				out.im[i * cols + j] += xr * yi + xi * yr;
			}
		}
	}
	return out;
}

/** a⁻¹ b by Gaussian elimination with partial pivoting. */
export function solve(a: CMat, b: CMat): CMat {
	const n = a.n;
	const lr = Float64Array.from(a.re);
	const li = Float64Array.from(a.im);
	const x = copy(b);
	const { re: xr, im: xi } = x;
	const swapRows = (r: Float64Array, p: number, q: number) => {
		for (let j = 0; j < n; j++) {
			const t = r[p * n + j];
			r[p * n + j] = r[q * n + j];
			r[q * n + j] = t;
		}
	};
	for (let k = 0; k < n; k++) {
		let piv = k;
		let best = -1;
		for (let i = k; i < n; i++) {
			const m = Math.hypot(lr[i * n + k], li[i * n + k]);
			if (m > best) {
				best = m;
				piv = i;
			}
		}
		if (best === 0) throw new Error('solve: singular matrix');
		if (piv !== k) {
			swapRows(lr, piv, k);
			swapRows(li, piv, k);
			swapRows(xr, piv, k);
			swapRows(xi, piv, k);
		}
		const pr = lr[k * n + k];
		const pi = li[k * n + k];
		const den = pr * pr + pi * pi;
		for (let i = k + 1; i < n; i++) {
			const ar = lr[i * n + k];
			const ai = li[i * n + k];
			if (ar === 0 && ai === 0) continue;
			// f = a_ik / a_kk
			const fr = (ar * pr + ai * pi) / den;
			const fi = (ai * pr - ar * pi) / den;
			for (let j = k + 1; j < n; j++) {
				const yr = lr[k * n + j];
				const yi = li[k * n + j];
				lr[i * n + j] -= fr * yr - fi * yi;
				li[i * n + j] -= fr * yi + fi * yr;
			}
			for (let j = 0; j < n; j++) {
				const yr = xr[k * n + j];
				const yi = xi[k * n + j];
				xr[i * n + j] -= fr * yr - fi * yi;
				xi[i * n + j] -= fr * yi + fi * yr;
			}
		}
	}
	for (let k = n - 1; k >= 0; k--) {
		for (let m = k + 1; m < n; m++) {
			const ar = lr[k * n + m];
			const ai = li[k * n + m];
			if (ar === 0 && ai === 0) continue;
			for (let j = 0; j < n; j++) {
				const yr = xr[m * n + j];
				const yi = xi[m * n + j];
				xr[k * n + j] -= ar * yr - ai * yi;
				xi[k * n + j] -= ar * yi + ai * yr;
			}
		}
		const pr = lr[k * n + k];
		const pi = li[k * n + k];
		const den = pr * pr + pi * pi;
		for (let j = 0; j < n; j++) {
			const yr = xr[k * n + j];
			const yi = xi[k * n + j];
			xr[k * n + j] = (yr * pr + yi * pi) / den;
			xi[k * n + j] = (yi * pr - yr * pi) / den;
		}
	}
	return x;
}

/** Off-diagonal threshold of the Jacobi sweep, relative to sqrt(|a_pp a_qq|). */
const JACOBI_TOL = 1e-15;
const JACOBI_MAX_SWEEPS = 100;

/**
 * Eigen-decomposition of the Hermitian part of a by cyclic complex Jacobi:
 * ascending eigenvalues and unitary eigenvectors (columns of `vectors`).
 * A pair is rotated while |a_pq| > 1e-15 sqrt(|a_pp a_qq|), which keeps small
 * eigenvalues of PSD matrices accurate (Demmel and Veselić 1992).
 */
export function eigh(a: CMat): { values: Float64Array; vectors: CMat } {
	const n = a.n;
	const h = hermitianPart(a);
	const { re: hr, im: hi } = h;
	const v = identity(n);
	const { re: vr, im: vi } = v;
	for (let sweep = 0; sweep < JACOBI_MAX_SWEEPS; sweep++) {
		let rotated = false;
		for (let p = 0; p < n - 1; p++) {
			for (let q = p + 1; q < n; q++) {
				const pq = p * n + q;
				const xr = hr[pq];
				const xi = hi[pq];
				const r = Math.hypot(xr, xi);
				if (r === 0) continue;
				const app = hr[p * n + p];
				const aqq = hr[q * n + q];
				if (r <= JACOBI_TOL * Math.sqrt(Math.abs(app * aqq))) continue;
				rotated = true;
				// Phase e^{i phi} = a_pq / |a_pq|, then the real rotation of [[app, r], [r, aqq]].
				const er = xr / r;
				const ei = xi / r;
				const theta = (aqq - app) / (2 * r);
				const t2 = theta * theta;
				let t: number;
				if (Number.isFinite(t2)) {
					t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(t2 + 1));
				} else {
					t = 0.5 / theta;
				}
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				// J_pp = c, J_pq = s, J_qp = -s e^{-i phi}, J_qq = c e^{-i phi}.
				const qpr = -s * er;
				const qpi = s * ei;
				const qqr = c * er;
				const qqi = -c * ei;
				for (let k = 0; k < n; k++) {
					if (k === p || k === q) continue;
					const kp = k * n + p;
					const kq = k * n + q;
					const ypr = hr[kp];
					const ypi = hi[kp];
					const yqr = hr[kq];
					const yqi = hi[kq];
					const npr = c * ypr + (yqr * qpr - yqi * qpi);
					const npi = c * ypi + (yqr * qpi + yqi * qpr);
					const nqr = s * ypr + (yqr * qqr - yqi * qqi);
					const nqi = s * ypi + (yqr * qqi + yqi * qqr);
					hr[kp] = npr;
					hi[kp] = npi;
					hr[kq] = nqr;
					hi[kq] = nqi;
					hr[p * n + k] = npr;
					hi[p * n + k] = -npi;
					hr[q * n + k] = nqr;
					hi[q * n + k] = -nqi;
				}
				for (let k = 0; k < n; k++) {
					const kp = k * n + p;
					const kq = k * n + q;
					const ypr = vr[kp];
					const ypi = vi[kp];
					const yqr = vr[kq];
					const yqi = vi[kq];
					vr[kp] = c * ypr + (yqr * qpr - yqi * qpi);
					vi[kp] = c * ypi + (yqr * qpi + yqi * qpr);
					vr[kq] = s * ypr + (yqr * qqr - yqi * qqi);
					vi[kq] = s * ypi + (yqr * qqi + yqi * qqr);
				}
				hr[p * n + p] = app - t * r;
				hr[q * n + q] = aqq + t * r;
				hr[pq] = 0;
				hi[pq] = 0;
				hr[q * n + p] = 0;
				hi[q * n + p] = 0;
			}
		}
		if (!rotated) break;
	}
	const order = Array.from({ length: n }, (_, i) => i).sort(
		(i, j) => hr[i * n + i] - hr[j * n + j]
	);
	const values = new Float64Array(n);
	const vectors = zeros(n);
	order.forEach((src, dst) => {
		values[dst] = hr[src * n + src];
		for (let k = 0; k < n; k++) {
			vectors.re[k * n + dst] = vr[k * n + src];
			vectors.im[k * n + dst] = vi[k * n + src];
		}
	});
	return { values, vectors };
}

// Padé coefficients and 1-norm thresholds of Higham (2005), Table 2.3.
const PADE: Record<number, number[]> = {
	3: [120, 60, 12, 1],
	5: [30240, 15120, 3360, 420, 30, 1],
	7: [17297280, 8648640, 1995840, 277200, 25200, 1512, 56, 1],
	9: [17643225600, 8821612800, 2075673600, 302702400, 30270240, 2162160, 110880, 3960, 90, 1],
	13: [
		64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800, 129060195264000,
		10559470521600, 670442572800, 33522128640, 1323241920, 40840800, 960960, 16380, 182, 1
	]
};
const THETA: [number, number][] = [
	[3, 1.495585217958292e-2],
	[5, 2.53939833006323e-1],
	[7, 9.504178996162932e-1],
	[9, 2.097847961257068]
];
const THETA13 = 5.371920351148152;

/** (V − U)⁻¹ (V + U) from the odd part U and even part V of the Padé approximant. */
function padeQuotient(u: CMat, v: CMat): CMat {
	return solve(sub(v, u), add(v, u));
}

function padeLow(a: CMat, m: number): CMat {
	const n = a.n;
	const b = PADE[m];
	const a2 = matmul(a, a);
	const pows = [identity(n), a2];
	for (let j = 2; j <= (m - 1) / 2; j++) pows.push(matmul(pows[j - 1], a2));
	const ui = zeros(n);
	const v = zeros(n);
	pows.forEach((p, j) => {
		axpy(b[2 * j + 1], 0, p, ui);
		axpy(b[2 * j], 0, p, v);
	});
	return padeQuotient(matmul(a, ui), v);
}

function pade13(a: CMat): CMat {
	const n = a.n;
	const b = PADE[13];
	const a2 = matmul(a, a);
	const a4 = matmul(a2, a2);
	const a6 = matmul(a2, a4);
	const t = zeros(n);
	axpy(b[13], 0, a6, t);
	axpy(b[11], 0, a4, t);
	axpy(b[9], 0, a2, t);
	const ui = matmul(a6, t);
	axpy(b[7], 0, a6, ui);
	axpy(b[5], 0, a4, ui);
	axpy(b[3], 0, a2, ui);
	for (let i = 0; i < n; i++) ui.re[i * n + i] += b[1];
	t.re.fill(0);
	t.im.fill(0);
	axpy(b[12], 0, a6, t);
	axpy(b[10], 0, a4, t);
	axpy(b[8], 0, a2, t);
	const v = matmul(a6, t);
	axpy(b[6], 0, a6, v);
	axpy(b[4], 0, a4, v);
	axpy(b[2], 0, a2, v);
	for (let i = 0; i < n; i++) v.re[i * n + i] += b[0];
	return padeQuotient(matmul(a, ui), v);
}

/** Matrix exponential of a general complex matrix: scaling and squaring with Padé (Higham 2005). */
export function expm(a: CMat): CMat {
	const nrm = norm1(a);
	for (const [m, theta] of THETA) if (nrm <= theta) return padeLow(a, m);
	const s = Math.max(0, Math.ceil(Math.log2(nrm / THETA13)));
	let r = pade13(s > 0 ? scale(a, 2 ** -s) : a);
	for (let k = 0; k < s; k++) r = matmul(r, r);
	return r;
}

/**
 * V = exp(−i h τ) and dV/dω for h → h + ω g at ω = 0, from the top blocks of
 * exp(−i τ [[h, g], [0, h]]).
 */
export function unitaryAndDerivative(h: CMat, g: CMat, tau: number): { v: CMat; dv: CMat } {
	const n = h.n;
	const m = 2 * n;
	const block = zeros(m);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			// −i τ (x + i y) = τ y − i τ x
			const hr = tau * h.im[i * n + j];
			const hi = -tau * h.re[i * n + j];
			block.re[i * m + j] = hr;
			block.im[i * m + j] = hi;
			block.re[(i + n) * m + j + n] = hr;
			block.im[(i + n) * m + j + n] = hi;
			block.re[i * m + j + n] = tau * g.im[i * n + j];
			block.im[i * m + j + n] = -tau * g.re[i * n + j];
		}
	}
	const big = expm(block);
	const v = zeros(n);
	const dv = zeros(n);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			v.re[i * n + j] = big.re[i * m + j];
			v.im[i * n + j] = big.im[i * m + j];
			dv.re[i * n + j] = big.re[i * m + j + n];
			dv.im[i * n + j] = big.im[i * m + j + n];
		}
	}
	return { v, dv };
}
