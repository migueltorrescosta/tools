/**
 * Exact samplers and special functions shared by the tools that draw random
 * variates over the seeded `Prng`. No DOM or Svelte imports.
 */
import type { Prng } from '$lib/prng';

const HALF_LOG_2PI = 0.5 * Math.log(2 * Math.PI);

/** ln Γ(x) for x > 0 (Stirling series after shifting x to ≥ 10; about 1e-16 relative). */
export function logGamma(x: number): number {
	let shift = 0;
	while (x < 10) {
		shift += Math.log(x);
		x += 1;
	}
	const r = 1 / x;
	const r2 = r * r;
	const series =
		r *
		(1 / 12 -
			r2 * (1 / 360 - r2 * (1 / 1260 - r2 * (1 / 1680 - r2 * (1 / 1188 - r2 * (691 / 360360))))));
	return (x - 0.5) * Math.log(x) - x + HALF_LOG_2PI + series - shift;
}

/** Uniform in (0, 1]. */
export const open0 = (prng: Prng) => 1 - prng.next();

/** ln of a Gamma(shape, 1) draw: Marsaglia–Tsang, with the u^(1/a) boost below shape 1. */
export function logGammaDraw(prng: Prng, shape: number): number {
	const boost = shape < 1 ? Math.log(open0(prng)) / shape : 0;
	const d = (shape < 1 ? shape + 1 : shape) - 1 / 3;
	const c = 1 / Math.sqrt(9 * d);
	for (;;) {
		const x = prng.normal();
		const t = 1 + c * x;
		if (t <= 0) continue;
		const v = t * t * t;
		const u = open0(prng);
		const x2 = x * x;
		if (u < 1 - 0.0331 * x2 * x2 || Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) {
			return Math.log(d * v) + boost;
		}
	}
}

/** Poisson by sequential inversion (λ < 10). */
function poissonInversion(lambda: number): (prng: Prng) => number {
	const p0 = Math.exp(-lambda);
	return (prng) => {
		for (;;) {
			let u = prng.next();
			let p = p0;
			let k = 0;
			// Guards against rounding leaving u above the summed mass; P(k > 200) is below 1e-150.
			while (u > p && k < 200) {
				u -= p;
				k++;
				p *= lambda / k;
			}
			if (k < 200) return k;
		}
	};
}

/** Poisson by PTRS, transformed rejection with squeeze (Hörmann 1993), λ ≥ 10. */
function poissonPtrs(lambda: number): (prng: Prng) => number {
	const slam = Math.sqrt(lambda);
	const loglam = Math.log(lambda);
	const b = 0.931 + 2.53 * slam;
	const a = -0.059 + 0.02483 * b;
	const invAlpha = 1.1239 + 1.1328 / (b - 3.4);
	const vr = 0.9277 - 3.6224 / (b - 2);
	return (prng) => {
		for (;;) {
			const u = prng.next() - 0.5;
			const v = open0(prng);
			const us = 0.5 - Math.abs(u);
			const k = Math.floor(((2 * a) / us + b) * u + lambda + 0.43);
			if (us >= 0.07 && v <= vr) return k;
			if (k < 0 || (us < 0.013 && v > us)) continue;
			if (
				Math.log(v) + Math.log(invAlpha) - Math.log(a / (us * us) + b) <=
				-lambda + k * loglam - logGamma(k + 1)
			) {
				return k;
			}
		}
	};
}

/** Binomial by sequential inversion, p ≤ 0.5 and n·p < 10. */
function binomialInversion(n: number, p: number): (prng: Prng) => number {
	const q = 1 - p;
	const s = p / q;
	const a = (n + 1) * s;
	const r0 = Math.exp(n * Math.log1p(-p));
	const bound = Math.min(n, Math.floor(n * p + 10 * Math.sqrt(n * p * q + 1)) + 50);
	return (prng) => {
		for (;;) {
			let u = prng.next();
			let r = r0;
			let k = 0;
			while (u > r && k < bound) {
				u -= r;
				k++;
				r *= a / k - s;
			}
			if (u <= r) return k;
		}
	};
}

/** Binomial by BTRS, transformed rejection with squeeze (Hörmann 1993), p ≤ 0.5 and n·p ≥ 10. */
function binomialBtrs(n: number, p: number): (prng: Prng) => number {
	const q = 1 - p;
	const spq = Math.sqrt(n * p * q);
	const b = 1.15 + 2.53 * spq;
	const a = -0.0873 + 0.0248 * b + 0.01 * p;
	const c = n * p + 0.5;
	const vr = 0.92 - 4.2 / b;
	const alpha = (2.83 + 5.1 / b) * spq;
	const lpq = Math.log(p / q);
	const m = Math.floor((n + 1) * p);
	const h = logGamma(m + 1) + logGamma(n - m + 1);
	return (prng) => {
		for (;;) {
			const u = prng.next() - 0.5;
			const v = open0(prng);
			const us = 0.5 - Math.abs(u);
			const k = Math.floor(((2 * a) / us + b) * u + c);
			if (k < 0 || k > n) continue;
			if (us >= 0.07 && v <= vr) return k;
			const lv = Math.log((v * alpha) / (a / (us * us) + b));
			if (lv <= h - logGamma(k + 1) - logGamma(n - k + 1) + (k - m) * lpq) return k;
		}
	};
}

export function binomial(n: number, p: number): (prng: Prng) => number {
	if (n === 0 || p === 0) return () => 0;
	if (p === 1) return () => n;
	if (p > 0.5) {
		const draw = binomial(n, 1 - p);
		return (prng) => n - draw(prng);
	}
	return n * p < 10 ? binomialInversion(n, p) : binomialBtrs(n, p);
}

/** An exact Poisson sampler: inversion below λ = 10, PTRS above. */
export function poisson(lambda: number): (prng: Prng) => number {
	return lambda < 10 ? poissonInversion(lambda) : poissonPtrs(lambda);
}
