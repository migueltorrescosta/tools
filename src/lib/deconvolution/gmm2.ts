/**
 * Extreme Deconvolution in 2D (Bovy, Hogg & Roweis 2011): X is a mixture of
 * K correlated Gaussians and Y ~ N(0, S) with S known, so Z's components are
 * N(μ_k, V_k + S). EM per K = 1…kMax from k-means++ starts, best by BIC.
 * Covariances are [a, b, c] for [[a, b], [b, c]]. No DOM or Svelte imports.
 */
import { Prng } from '$lib/prng';
import { binData2 } from './binning2';
import type { Spec2 } from './dist2';

type Cov = [number, number, number];

export interface Gmm2Component {
	weight: number;
	mean: [number, number];
	cov: Cov;
}

export interface Gmm2Fit {
	k: number;
	components: Gmm2Component[];
	logLik: number;
	/** (6k − 1)·ln n − 2ℓ */
	bic: number;
	iterations: number;
}

export interface Gmm2Input {
	xs: Float64Array;
	ys: Float64Array;
	/** The noise covariance S, or each point's own [σx², ρσxσy, σy²] (the data aren't binned then). */
	noise: Noise2;
	kMax?: number;
	seed: number;
	restarts?: number;
	maxIter?: number;
	/** Stop when the log-likelihood gains less than this (default 1e-6·n). */
	tol?: number;
}

const LOG_2PI = Math.log(2 * Math.PI);
const det = ([a, b, c]: Cov) => a * c - b * b;
const inv = (m: Cov): Cov => {
	const d = det(m);
	return [m[2] / d, -m[1] / d, m[0] / d];
};
/** The product of two symmetric 2 × 2 matrices, as a general [p, q; r, s]. */
const mul = (m: Cov, n: Cov): [number, number, number, number] => [
	m[0] * n[0] + m[1] * n[1],
	m[0] * n[1] + m[1] * n[2],
	m[1] * n[0] + m[2] * n[1],
	m[1] * n[1] + m[2] * n[2]
];

interface Component {
	w: number;
	mu: [number, number];
	V: Cov;
}

/** The noise covariance of point i: one S for all, or each point's own (per-point errors). */
export type Noise2 = Cov | Float64Array[];
const isShared = (S: Noise2): S is Cov => typeof S[0] === 'number';

/**
 * One EM step with weights c; returns the log-likelihood at `comps` and the
 * update. With per-point covariances S_i, the gain and posterior covariance
 * are point by point (Bovy, Hogg & Roweis 2011, eq. 13–17).
 */
function step(
	x: Float64Array,
	y: Float64Array,
	c: Float64Array,
	comps: Component[],
	S: Noise2,
	floor: number
): { logLik: number; next: Component[] } {
	const k = comps.length;
	/** For component j under noise covariance N: T⁻¹, the gain V·T⁻¹, B = V − V·T⁻¹·V and log w − log 2π − ½ log det T. */
	const terms = ({ w, V }: Component, N: Cov) => {
		const T: Cov = [V[0] + N[0], V[1] + N[1], V[2] + N[2]];
		const Ti = inv(T);
		const G = mul(V, Ti);
		const B: Cov = [
			V[0] - (G[0] * V[0] + G[1] * V[1]),
			V[1] - (G[0] * V[1] + G[1] * V[2]),
			V[2] - (G[2] * V[1] + G[3] * V[2])
		];
		return { Ti, G, B, logNorm: Math.log(w) - LOG_2PI - 0.5 * Math.log(det(T)) };
	};
	const fixed = isShared(S) ? comps.map((cm) => terms(cm, S)) : null;
	const R = new Float64Array(k);
	const Rb = Array.from({ length: k }, () => [0, 0]);
	const Rbb = Array.from({ length: k }, () => [0, 0, 0]);
	const RB = Array.from({ length: k }, () => [0, 0, 0]);
	const lr = new Float64Array(k);
	let logLik = 0;
	for (let i = 0; i < x.length; i++) {
		const pre = fixed ?? comps.map((cm) => terms(cm, Array.from((S as Float64Array[])[i]) as Cov));
		let top = -Infinity;
		for (let j = 0; j < k; j++) {
			const { Ti, logNorm } = pre[j];
			const { mu } = comps[j];
			const u = x[i] - mu[0];
			const v = y[i] - mu[1];
			lr[j] = logNorm - 0.5 * (Ti[0] * u * u + 2 * Ti[1] * u * v + Ti[2] * v * v);
			top = Math.max(top, lr[j]);
		}
		let total = 0;
		for (let j = 0; j < k; j++) total += lr[j] = Math.exp(lr[j] - top);
		logLik += c[i] * (top + Math.log(total));
		for (let j = 0; j < k; j++) {
			const r = (c[i] * lr[j]) / total;
			const { G, B } = pre[j];
			const { mu } = comps[j];
			const u = x[i] - mu[0];
			const v = y[i] - mu[1];
			const b0 = mu[0] + G[0] * u + G[1] * v;
			const b1 = mu[1] + G[2] * u + G[3] * v;
			R[j] += r;
			Rb[j][0] += r * b0;
			Rb[j][1] += r * b1;
			Rbb[j][0] += r * b0 * b0;
			Rbb[j][1] += r * b0 * b1;
			Rbb[j][2] += r * b1 * b1;
			RB[j][0] += r * B[0];
			RB[j][1] += r * B[1];
			RB[j][2] += r * B[2];
		}
	}
	const n = R.reduce((a, b) => a + b, 0);
	const next = comps.map((old, j): Component => {
		// A component no point claims drops out (weight 0), so the weights still sum to 1.
		if (!(R[j] > 0)) return { ...old, w: 0 };
		const m0 = Rb[j][0] / R[j];
		const m1 = Rb[j][1] / R[j];
		// Σ r(μ − b)(μ − b)ᵀ = Σ r b bᵀ − R μ μᵀ at the new μ, plus the mean posterior covariance.
		const a = (Rbb[j][0] + RB[j][0]) / R[j] - m0 * m0 + floor;
		const cc = (Rbb[j][2] + RB[j][2]) / R[j] - m1 * m1 + floor;
		let b = (Rbb[j][1] + RB[j][1]) / R[j] - m0 * m1;
		// Keep V positive definite.
		const lim = 0.999 * Math.sqrt(a * cc);
		b = Math.max(-lim, Math.min(lim, b));
		return { w: R[j] / n, mu: [m0, m1], V: [a, b, cc] };
	});
	return { logLik, next };
}

/** k-means++ seeding of k means on the (weighted) points. */
function seedMeans(x: Float64Array, y: Float64Array, c: Float64Array, k: number, prng: Prng) {
	const means: [number, number][] = [];
	const d2 = new Float64Array(x.length).fill(Infinity);
	const pick = (weight: (i: number) => number): [number, number] => {
		let total = 0;
		for (let i = 0; i < x.length; i++) total += weight(i);
		let u = prng.next() * total;
		for (let i = 0; i < x.length; i++) if ((u -= weight(i)) <= 0) return [x[i], y[i]];
		return [x[x.length - 1], y[y.length - 1]];
	};
	means.push(pick((i) => c[i]));
	for (let j = 1; j < k; j++) {
		const [mx, my] = means[j - 1];
		for (let i = 0; i < x.length; i++) d2[i] = Math.min(d2[i], (x[i] - mx) ** 2 + (y[i] - my) ** 2);
		means.push(pick((i) => c[i] * d2[i]));
	}
	return means;
}

export function fitGmm2({
	xs,
	ys,
	noise,
	kMax = 6,
	seed,
	restarts = 3,
	maxIter = 500,
	tol
}: Gmm2Input): { best: Gmm2Fit; fits: Gmm2Fit[] } {
	const { x, y, c } = isShared(noise)
		? binData2(xs, ys)
		: { x: xs, y: ys, c: new Float64Array(xs.length).fill(1) };
	// The typical noise variances, for the starting spread.
	const avg = (k: 0 | 2) =>
		isShared(noise) ? noise[k] : noise.reduce((a, q) => a + q[k], 0) / noise.length;
	let n = 0;
	let sx = 0;
	let sy = 0;
	for (let i = 0; i < x.length; i++) {
		n += c[i];
		sx += c[i] * x[i];
		sy += c[i] * y[i];
	}
	const mx = sx / n;
	const my = sy / n;
	let vxx = 0;
	let vyy = 0;
	for (let i = 0; i < x.length; i++) {
		vxx += c[i] * (x[i] - mx) ** 2;
		vyy += c[i] * (y[i] - my) ** 2;
	}
	vxx /= n;
	vyy /= n;
	const tolerance = tol ?? 1e-6 * n;
	const floor = 1e-6 * Math.min(vxx, vyy);
	const fits: Gmm2Fit[] = [];
	for (let k = 1; k <= kMax; k++) {
		let best: { comps: Component[]; logLik: number; iterations: number } | null = null;
		for (let r = 0; r < restarts; r++) {
			const prng = new Prng(seed + r * 1000 + k);
			const v = (total: number, s: number) => Math.max(total / (k * k) - s, 0.01 * total);
			let comps: Component[] = seedMeans(x, y, c, k, prng).map((mu) => ({
				w: 1 / k,
				mu,
				V: [v(vxx, avg(0)), 0, v(vyy, avg(2))]
			}));
			let prev = -Infinity;
			let iterations = 0;
			while (iterations < maxIter) {
				iterations++;
				const s = step(x, y, c, comps, noise, floor);
				comps = s.next;
				if (s.logLik - prev < tolerance) break;
				prev = s.logLik;
			}
			const logLik = step(x, y, c, comps, noise, floor).logLik;
			if (!best || logLik > best.logLik) best = { comps, logLik, iterations };
		}
		const sorted = [...best!.comps].sort((a, b) => a.mu[0] - b.mu[0] || a.mu[1] - b.mu[1]);
		fits.push({
			k,
			components: sorted.map((q) => ({ weight: q.w, mean: q.mu, cov: q.V })),
			logLik: best!.logLik,
			bic: (6 * k - 1) * Math.log(n) - 2 * best!.logLik,
			iterations: best!.iterations
		});
	}
	return { best: fits.reduce((a, b) => (b.bic < a.bic ? b : a)), fits };
}

/** A fit as a 2D spec: one Gaussian for k = 1, else a Gaussian mixture. */
export function gmm2Spec(fit: Gmm2Fit): Spec2 {
	const params = ({ mean, cov: [a, b, c] }: Gmm2Component) => {
		const sx = Math.sqrt(a);
		const sy = Math.sqrt(c);
		return [mean[0], mean[1], sx, sy, b / (sx * sy)];
	};
	if (fit.k === 1) return { family: 'gauss2', params: params(fit.components[0]) };
	return {
		family: 'mixture2',
		components: fit.components.map((q) => ({ params: params(q), weight: q.weight }))
	};
}
