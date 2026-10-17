/**
 * Levenberg–Marquardt fitting of an expression's constants to minimise MSE,
 * with a forward-difference Jacobian.
 */
import { compile, programMse, runProgram, setConstants } from './expr';
import type { Dataset, Expr } from './types';

export interface FitResult {
	expr: Expr;
	/** MSE after fitting (Infinity if the expression is infeasible on the data). */
	mse: number;
	/** True when the constants changed. */
	improved: boolean;
}

/** Solves the k×k system `a·d = b` in place (Gaussian elimination, partial pivoting). */
function solve(a: Float64Array, b: Float64Array, k: number): boolean {
	for (let c = 0; c < k; c++) {
		let p = c;
		for (let r = c + 1; r < k; r++) if (Math.abs(a[r * k + c]) > Math.abs(a[p * k + c])) p = r;
		const piv = a[p * k + c];
		if (!(Math.abs(piv) > 1e-300)) return false;
		if (p !== c) {
			for (let j = 0; j < k; j++) {
				const t = a[c * k + j];
				a[c * k + j] = a[p * k + j];
				a[p * k + j] = t;
			}
			const t = b[c];
			b[c] = b[p];
			b[p] = t;
		}
		for (let r = c + 1; r < k; r++) {
			const f = a[r * k + c] / piv;
			if (f === 0) continue;
			for (let j = c; j < k; j++) a[r * k + j] -= f * a[c * k + j];
			b[r] -= f * b[c];
		}
	}
	for (let c = k - 1; c >= 0; c--) {
		let s = b[c];
		for (let j = c + 1; j < k; j++) s -= a[c * k + j] * b[j];
		b[c] = s / a[c * k + c];
	}
	return b.every(Number.isFinite);
}

/**
 * Fits the constants of `expr` to `data` by Levenberg–Marquardt. Returns the
 * input unchanged when it has no constants or nothing improves.
 */
export function fitConstants(expr: Expr, data: Dataset, maxIter = 30): FitResult {
	const prog = compile(expr);
	const { x, y } = data;
	const n = y.length;
	const k = prog.constSlots.length;
	const slots = prog.constSlots;
	let loss = programMse(prog, x, y);
	if (k === 0 || n === 0 || !Number.isFinite(loss) || loss === 0) {
		return { expr, mse: loss, improved: false };
	}
	const p = new Float64Array(k);
	for (let j = 0; j < k; j++) p[j] = prog.arg[slots[j]];
	const start = Float64Array.from(p);
	const setP = (v: Float64Array) => {
		for (let j = 0; j < k; j++) prog.arg[slots[j]] = v[j];
	};

	const resid = new Float64Array(n);
	const jac: Float64Array[] = Array.from({ length: k }, () => new Float64Array(n));
	const jtj = new Float64Array(k * k);
	const jtr = new Float64Array(k);
	const a = new Float64Array(k * k);
	const d = new Float64Array(k);
	const trial = new Float64Array(k);
	let lambda = 1e-3;

	for (let it = 0; it < maxIter; it++) {
		setP(p);
		const f0 = runProgram(prog, x, n);
		if (!f0) break;
		for (let i = 0; i < n; i++) resid[i] = f0[i] - y[i];
		let ok = true;
		for (let j = 0; j < k && ok; j++) {
			const h = 1.5e-8 * Math.max(Math.abs(p[j]), 1);
			const col = jac[j];
			let done = false;
			for (const step of [h, -h]) {
				prog.arg[slots[j]] = p[j] + step;
				const f = runProgram(prog, x, n);
				if (f) {
					for (let i = 0; i < n; i++) col[i] = (f[i] - y[i] - resid[i]) / step;
					done = true;
					break;
				}
			}
			prog.arg[slots[j]] = p[j];
			ok = done;
		}
		if (!ok) break;
		for (let r = 0; r < k; r++) {
			const jr = jac[r];
			let g = 0;
			for (let i = 0; i < n; i++) g += jr[i] * resid[i];
			jtr[r] = g;
			for (let c = r; c < k; c++) {
				const jc = jac[c];
				let s = 0;
				for (let i = 0; i < n; i++) s += jr[i] * jc[i];
				jtj[r * k + c] = s;
				jtj[c * k + r] = s;
			}
		}
		let accepted = false;
		while (lambda < 1e12) {
			for (let r = 0; r < k; r++) {
				for (let c = 0; c < k; c++) a[r * k + c] = jtj[r * k + c];
				a[r * k + r] += lambda * (jtj[r * k + r] + 1e-12);
				d[r] = -jtr[r];
			}
			if (solve(a, d, k)) {
				for (let j = 0; j < k; j++) trial[j] = p[j] + d[j];
				setP(trial);
				const l = programMse(prog, x, y);
				if (l < loss) {
					const rel = (loss - l) / loss;
					p.set(trial);
					loss = l;
					lambda = Math.max(lambda / 10, 1e-12);
					accepted = rel > 1e-12 && l > 0;
					break;
				}
			}
			lambda *= 10;
		}
		if (!accepted) break;
	}
	const improved = p.some((v, j) => v !== start[j]);
	return { expr: improved ? setConstants(expr, p) : expr, mse: loss, improved };
}
