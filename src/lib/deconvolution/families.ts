/**
 * The distribution catalogue for X (signal) and Y (noise): densities or
 * point masses, characteristic functions, moments, ranges and exact samplers.
 * No DOM or Svelte imports.
 */
import {
	logGamma,
	logGammaDraw,
	poisson as poissonSampler,
	binomial as binomialSampler
} from '$lib/variates';
import type { Atoms, Family, FamilyId, ParamError } from './types';

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Lentz's continued fraction for the incomplete gamma, Γ(a, x)/Γ(a) for x ≥ a + 1. */
function gammaQFraction(a: number, x: number): number {
	let b = x + 1 - a;
	let c = 1e30;
	let d = 1 / b;
	let h = d;
	for (let i = 1; i <= 300; i++) {
		const an = -i * (i - a);
		b += 2;
		d = an * d + b;
		if (Math.abs(d) < 1e-300) d = 1e-300;
		c = b + an / c;
		if (Math.abs(c) < 1e-300) c = 1e-300;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-15) break;
	}
	return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularised upper incomplete gamma Q(a, x) = Γ(a, x)/Γ(a) (Numerical Recipes `gammq`). */
export function gammaQ(a: number, x: number): number {
	if (x <= 0) return 1;
	if (x >= a + 1) return gammaQFraction(a, x);
	let sum = 1 / a;
	let term = sum;
	for (let n = 1; n < 500; n++) {
		term *= x / (a + n);
		sum += term;
		if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
	}
	return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Continued fraction for the incomplete beta (Numerical Recipes `betacf`). */
function betaFraction(a: number, b: number, x: number): number {
	const qab = a + b;
	const qap = a + 1;
	const qam = a - 1;
	let c = 1;
	let d = 1 - (qab * x) / qap;
	if (Math.abs(d) < 1e-300) d = 1e-300;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= 300; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < 1e-300) d = 1e-300;
		c = 1 + aa / c;
		if (Math.abs(c) < 1e-300) c = 1e-300;
		d = 1 / d;
		h *= d * c;
		aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < 1e-300) d = 1e-300;
		c = 1 + aa / c;
		if (Math.abs(c) < 1e-300) c = 1e-300;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-15) break;
	}
	return h;
}

/** Regularised incomplete beta I_x(a, b) for a, b > 0 (Numerical Recipes `betai`). */
export function betaI(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const bt = Math.exp(
		logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x)
	);
	return x < (a + 1) / (a + b + 2)
		? (bt * betaFraction(a, b, x)) / a
		: 1 - (bt * betaFraction(b, a, 1 - x)) / b;
}

/**
 * Modified Bessel K_ν(x) = ∫₀^∞ e^{−x·cosh w}·cosh(νw) dw for x > 0, by the
 * trapezoid rule up to where the integrand is below e^{−50} (it is even and
 * smooth, so the rule converges fast).
 */
function besselK(nu: number, x: number): number {
	let W = 1;
	while (x * Math.cosh(W) - nu * W < 50) W *= 1.25;
	const N = 400;
	const dw = W / N;
	let sum = 0.5 * Math.exp(-x);
	for (let i = 1; i <= N; i++) {
		const w = i * dw;
		sum += (i === N ? 0.5 : 1) * Math.exp(-x * Math.cosh(w)) * Math.cosh(nu * w);
	}
	return sum * dw;
}

/** Half-width, in σ, of a normal interval holding at least 1 − eps of the mass. */
export const normalHalfWidth = (eps: number) => Math.sqrt(-2 * Math.log(eps / 2));

/** e^{iμt} times a real value, as [re, im]. */
export const shifted = (mu: number, t: number, value: number): [number, number] => [
	value * Math.cos(mu * t),
	value * Math.sin(mu * t)
];

/** The [first, last] atom: the range of a discrete family. */
export const atomRange = (a: Atoms): [number, number] => [a.x[0], a.x[a.x.length - 1]];

/**
 * Atoms of a pmf on the integers from `start`, walking outwards from `mode`
 * with `logPmf` until both tails drop below eps (relative to the mode's mass).
 */
export function integerAtoms(
	logPmf: (k: number) => number,
	mode: number,
	start: number,
	eps: number,
	end = Infinity
): Atoms {
	const top = logPmf(mode);
	const cut = top + Math.log(eps) - 5;
	let lo = mode;
	while (lo > start && logPmf(lo - 1) > cut) lo--;
	let hi = mode;
	while (hi < end && logPmf(hi + 1) > cut) hi++;
	const x = new Float64Array(hi - lo + 1);
	const p = new Float64Array(hi - lo + 1);
	let total = 0;
	for (let k = lo; k <= hi; k++) {
		x[k - lo] = k;
		total += p[k - lo] = Math.exp(logPmf(k));
	}
	for (let i = 0; i < p.length; i++) p[i] /= total;
	return { x, p };
}

const normal: Family = {
	id: 'normal',
	name: 'Normal',
	discrete: false,
	location: 0,
	params: [
		{ key: 'mu', label: 'μ', default: 0, domain: 'real' },
		{ key: 'sigma', label: 'σ', default: 1, domain: 'positive' }
	],
	pdf: (x, [mu, s]) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * SQRT_2PI),
	cf: (t, [mu, s]) => shifted(mu, t, Math.exp(-0.5 * s * s * t * t)),
	mean: ([mu]) => mu,
	variance: ([, s]) => s * s,
	range: ([mu, s], eps) => [mu - s * normalHalfWidth(eps), mu + s * normalHalfWidth(eps)],
	sampler:
		([mu, s]) =>
		(prng) =>
			mu + s * prng.normal()
};

const laplace: Family = {
	id: 'laplace',
	name: 'Laplace',
	discrete: false,
	location: 0,
	params: [
		{ key: 'mu', label: 'μ', default: 0, domain: 'real' },
		{ key: 'b', label: 'b', default: 1, domain: 'positive' }
	],
	pdf: (x, [mu, b]) => Math.exp(-Math.abs(x - mu) / b) / (2 * b),
	cf: (t, [mu, b]) => shifted(mu, t, 1 / (1 + b * b * t * t)),
	mean: ([mu]) => mu,
	variance: ([, b]) => 2 * b * b,
	range: ([mu, b], eps) => [mu + b * Math.log(eps), mu - b * Math.log(eps)],
	sampler:
		([mu, b]) =>
		(prng) => {
			// next() is in [0, 1); redraw the one value (u = −0.5) whose log is −∞.
			let u = prng.next() - 0.5;
			while (u === -0.5) u = prng.next() - 0.5;
			return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
		}
};

const poissonAtoms = ([lambda]: readonly number[], eps: number) =>
	integerAtoms((k) => k * Math.log(lambda) - lambda - logGamma(k + 1), Math.floor(lambda), 0, eps);

const poisson: Family = {
	id: 'poisson',
	name: 'Poisson',
	discrete: true,
	params: [{ key: 'lambda', label: 'λ', default: 3, domain: 'positive' }],
	validate: ([lambda]) => (lambda > 1e6 ? [{ index: 0, message: 'λ must be at most 10⁶.' }] : []),
	atoms: poissonAtoms,
	cf: (t, [lambda]) => {
		const r = Math.exp(lambda * (Math.cos(t) - 1));
		const a = lambda * Math.sin(t);
		return [r * Math.cos(a), r * Math.sin(a)];
	},
	mean: ([lambda]) => lambda,
	variance: ([lambda]) => lambda,
	range: (params, eps) => atomRange(poissonAtoms(params, eps)),
	sampler: ([lambda]) => poissonSampler(lambda)
};

const uniform: Family = {
	id: 'uniform',
	name: 'Uniform',
	discrete: false,
	location: 0,
	params: [
		{ key: 'centre', label: 'centre', default: 0, domain: 'real' },
		{ key: 'width', label: 'width', default: 2, domain: 'positive' }
	],
	pdf: (x, [c, w]) => (x >= c - w / 2 && x <= c + w / 2 ? 1 / w : 0),
	cf: (t, [c, w]) => {
		if (t === 0) return [1, 0];
		const a = (t * w) / 2;
		const sinc = Math.sin(a) / a;
		return shifted(c, t, sinc);
	},
	mean: ([c]) => c,
	variance: ([, w]) => (w * w) / 12,
	range: ([c, w]) => [c - w / 2, c + w / 2],
	sampler:
		([c, w]) =>
		(prng) =>
			c + w * (prng.next() - 0.5)
};

const exponential: Family = {
	id: 'exponential',
	name: 'Exponential',
	discrete: false,
	params: [{ key: 'mean', label: 'mean', default: 1, domain: 'positive' }],
	pdf: (x, [m]) => (x >= 0 ? Math.exp(-x / m) / m : 0),
	cf: (t, [m]) => {
		const den = 1 + m * m * t * t;
		return [1 / den, (m * t) / den];
	},
	mean: ([m]) => m,
	variance: ([m]) => m * m,
	range: ([m], eps) => [0, -m * Math.log(eps)],
	sampler:
		([m]) =>
		(prng) =>
			-m * Math.log(1 - prng.next())
};

const gamma: Family = {
	id: 'gamma',
	name: 'Gamma',
	discrete: false,
	params: [
		{ key: 'shape', label: 'k', default: 2, domain: 'positive' },
		{ key: 'scale', label: 'θ', default: 1, domain: 'positive' }
	],
	pdf: (x, [k, th]) => {
		if (x <= 0) return 0;
		return Math.exp((k - 1) * Math.log(x) - x / th - k * Math.log(th) - logGamma(k));
	},
	cf: (t, [k, th]) => {
		const r = Math.sqrt(1 + th * th * t * t);
		const a = k * Math.atan(th * t);
		const mag = Math.pow(r, -k);
		return [mag * Math.cos(a), mag * Math.sin(a)];
	},
	mean: ([k, th]) => k * th,
	variance: ([k, th]) => k * th * th,
	// From 0 (allowed by the contract) to where Q(k, x/θ) ≤ eps/2, by doubling then bisection.
	range: ([k, th], eps) => {
		let a = 0;
		let b = k * th + 10 * th * Math.sqrt(k) + 10 * th;
		while (gammaQ(k, b / th) > eps / 2) b *= 2;
		for (let i = 0; i < 60; i++) {
			const mid = (a + b) / 2;
			if (gammaQ(k, mid / th) > eps / 2) a = mid;
			else b = mid;
		}
		return [0, b];
	},
	sampler:
		([k, th]) =>
		(prng) =>
			th * Math.exp(logGammaDraw(prng, k))
};

/**
 * E[e^{itX}] for a lognormal, as ∫ e^{it·med·e^{su}} φ(u) du by Simpson's
 * rule in u. Steps keep the phase change under π/16 per step, so the fast
 * oscillation of the upper tail is resolved. The tail is dropped once it
 * can't matter: its mass, or 2 f(x)/|t| by integrating by parts (f falls
 * there), is below 1e-7.
 */
function lognormalCf(t: number, med: number, s: number): [number, number] {
	if (t === 0) return [1, 0];
	const at = Math.abs(t);
	let hi = 0;
	while (hi < 9) {
		const phi = Math.exp(-0.5 * hi * hi) / SQRT_2PI;
		// Mass past hi is below φ(hi)/hi; f(x) = φ(hi)/(x s).
		if (Math.min(phi / hi, (2 * phi) / (med * Math.exp(s * hi) * s * at)) < 1e-7) break;
		hi += 0.05;
	}
	const g = (u: number): [number, number] => {
		const w = Math.exp(-0.5 * u * u) / SQRT_2PI;
		const p = t * med * Math.exp(s * u);
		return [w * Math.cos(p), w * Math.sin(p)];
	};
	let re = 0;
	let im = 0;
	let u = -9;
	let [r0, i0] = g(u);
	while (u < hi) {
		// Phase rate at the far end of the pair of steps: it only grows with u.
		const rate = at * med * s * Math.exp(s * Math.min(hi, u + 0.02));
		const du = Math.min(0.01, (hi - u) / 2, Math.PI / (16 * rate));
		const [r1, i1] = g(u + du);
		const [r2, i2] = g(u + 2 * du);
		re += (du / 3) * (r0 + 4 * r1 + r2);
		im += (du / 3) * (i0 + 4 * i1 + i2);
		u += 2 * du;
		[r0, i0] = [r2, i2];
	}
	return [re, im];
}

const lognormal: Family = {
	id: 'lognormal',
	name: 'Lognormal',
	discrete: false,
	params: [
		{ key: 'median', label: 'median', default: 1, domain: 'positive' },
		{ key: 'sigma', label: 'σ', default: 0.5, domain: 'positive' }
	],
	pdf: (x, [med, s]) => {
		if (x <= 0) return 0;
		const u = Math.log(x / med) / s;
		return Math.exp(-0.5 * u * u) / (x * s * SQRT_2PI);
	},
	cf: (t, [med, s]) => lognormalCf(t, med, s),
	mean: ([med, s]) => med * Math.exp(0.5 * s * s),
	variance: ([med, s]) => {
		const v = Math.exp(s * s);
		return med * med * v * (v - 1);
	},
	range: ([med, s], eps) => {
		const hw = normalHalfWidth(eps);
		return [med * Math.exp(-s * hw), med * Math.exp(s * hw)];
	},
	sampler:
		([med, s]) =>
		(prng) =>
			med * Math.exp(s * prng.normal())
};

const studentT: Family = {
	id: 'studentT',
	name: 'Student t',
	discrete: false,
	location: 1,
	params: [
		{ key: 'nu', label: 'ν', default: 3, domain: 'positive' },
		{ key: 'mu', label: 'μ', default: 0, domain: 'real' },
		{ key: 'scale', label: 's', default: 1, domain: 'positive' }
	],
	pdf: (x, [nu, mu, s]) => {
		const u = (x - mu) / s;
		const logC =
			logGamma((nu + 1) / 2) - logGamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - Math.log(s);
		return Math.exp(logC - 0.5 * (nu + 1) * Math.log(1 + (u * u) / nu));
	},
	cf: (t, [nu, mu, s]) => {
		const tau = s * t;
		if (tau === 0) return shifted(mu, t, 1);
		const u = Math.sqrt(nu) * Math.abs(tau);
		const phi = besselK(nu / 2, u);
		const logDen = logGamma(nu / 2) + (nu / 2 - 1) * Math.log(2);
		const mag = Math.exp((nu / 2) * Math.log(u) - logDen) * phi;
		return shifted(mu, t, mag);
	},
	mean: ([nu, mu]) => (nu > 1 ? mu : undefined),
	variance: ([nu, , s]) => (nu > 2 ? (s * s * nu) / (nu - 2) : undefined),
	range: ([nu, mu, s], eps) => {
		const findR = (eps: number) => {
			let lo = 0;
			let hi = 1;
			while (betaI(nu / (nu + hi * hi), nu / 2, 0.5) > eps) hi *= 2;
			for (let i = 0; i < 60; i++) {
				const mid = (lo + hi) / 2;
				if (betaI(nu / (nu + mid * mid), nu / 2, 0.5) > eps) lo = mid;
				else hi = mid;
			}
			return hi;
		};
		const r = findR(eps);
		return [mu - s * r, mu + s * r];
	},
	sampler:
		([nu, mu, s]) =>
		(prng) => {
			const N = prng.normal();
			const G = 2 * Math.exp(logGammaDraw(prng, nu / 2));
			return mu + (s * N) / Math.sqrt(G / nu);
		}
};

const cauchy: Family = {
	id: 'cauchy',
	name: 'Cauchy',
	discrete: false,
	location: 0,
	params: [
		{ key: 'x0', label: 'x₀', default: 0, domain: 'real' },
		{ key: 'gamma', label: 'γ', default: 1, domain: 'positive' }
	],
	pdf: (x, [x0, g]) => 1 / (Math.PI * g * (1 + ((x - x0) / g) ** 2)),
	cf: (t, [x0, g]) => shifted(x0, t, Math.exp(-g * Math.abs(t))),
	mean: () => undefined,
	variance: () => undefined,
	range: ([x0, g], eps) => {
		const cot = 1 / Math.tan((Math.PI * eps) / 2);
		return [x0 - g * cot, x0 + g * cot];
	},
	sampler:
		([x0, g]) =>
		(prng) =>
			x0 + g * Math.tan(Math.PI * (prng.next() - 0.5))
};

const fringe: Family = {
	id: 'fringe',
	name: 'Fringe pattern',
	discrete: false,
	location: 0,
	params: [
		{ key: 'mu', label: 'μ', default: 0, domain: 'real' },
		{ key: 'w', label: 'envelope w', default: 2, domain: 'positive' },
		{ key: 'k', label: 'k', default: 3, domain: 'positive' },
		{ key: 'V', label: 'visibility V', default: 0.8, domain: 'unitClosed' },
		{ key: 'phi', label: 'phase φ', default: 0, domain: 'real' }
	],
	validate: ([, w, k, V, phi]) => {
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		return C > 1e-6
			? []
			: [{ index: 3, message: 'This visibility and phase leave no probability mass.' }];
	},
	pdf: (x, [mu, w, k, V, phi]) => {
		const u = x - mu;
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		return (
			((1 + V * Math.cos(k * u + phi)) * Math.exp((-0.5 * u * u) / (w * w))) / (w * SQRT_2PI * C)
		);
	},
	cf: (t, [mu, w, k, V, phi]) => {
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		const g = Math.exp(-0.5 * w * w * t * t);
		const gp = Math.exp(-0.5 * w * w * (t + k) ** 2);
		const gm = Math.exp(-0.5 * w * w * (t - k) ** 2);
		const val = (g + (V * Math.cos(phi) * (gp + gm)) / 2) / C;
		const imVal = (V * Math.sin(phi) * (gp - gm)) / 2 / C;
		return [
			val * Math.cos(mu * t) - imVal * Math.sin(mu * t),
			val * Math.sin(mu * t) + imVal * Math.cos(mu * t)
		];
	},
	mean: ([mu, w, k, V, phi]) => {
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		return mu - (V * k * w * w * Math.sin(phi) * Math.exp((-k * k * w * w) / 2)) / C;
	},
	variance: ([mu, w, k, V, phi]) => {
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		const m = (-V * k * w * w * Math.sin(phi) * Math.exp((-k * k * w * w) / 2)) / C;
		const E2 =
			(w * w +
				V * Math.cos(phi) * (w * w - k * k * w * w * w * w) * Math.exp((-k * k * w * w) / 2)) /
			C;
		return E2 - m * m;
	},
	range: ([mu, w, k, V, phi], eps) => {
		const C = 1 + V * Math.cos(phi) * Math.exp((-k * k * w * w) / 2);
		const hw = normalHalfWidth((eps * C) / (1 + V));
		return [mu - w * hw, mu + w * hw];
	},
	sampler:
		([mu, w, k, V, phi]) =>
		(prng) => {
			for (;;) {
				const u = w * prng.normal();
				const accept = (1 + V * Math.cos(k * u + phi)) / (1 + V);
				if (prng.next() < accept) return mu + u;
			}
		}
};

const binomial: Family = {
	id: 'binomial',
	name: 'Binomial',
	discrete: true,
	params: [
		{ key: 'n', label: 'n', default: 10, domain: 'count' },
		{ key: 'p', label: 'p', default: 0.5, domain: 'unit' }
	],
	atoms: ([n, p], eps) => {
		const logPmf = (k: number) =>
			logGamma(n + 1) -
			logGamma(k + 1) -
			logGamma(n - k + 1) +
			k * Math.log(p) +
			(n - k) * Math.log1p(-p);
		const mode = Math.min(n, Math.max(0, Math.floor((n + 1) * p)));
		return integerAtoms(logPmf, mode, 0, eps, n);
	},
	cf: (t, [n, p]) => {
		const q = 1 - p;
		const re = q + p * Math.cos(t);
		const im = p * Math.sin(t);
		const r = Math.hypot(re, im);
		const a = Math.atan2(im, re);
		return [Math.pow(r, n) * Math.cos(n * a), Math.pow(r, n) * Math.sin(n * a)];
	},
	mean: ([n, p]) => n * p,
	variance: ([n, p]) => n * p * (1 - p),
	range: (params, eps) => atomRange(binomial.atoms!(params, eps)),
	sampler: ([n, p]) => binomialSampler(n, p)
};

const geometric: Family = {
	id: 'geometric',
	name: 'Geometric',
	discrete: true,
	params: [{ key: 'p', label: 'p', default: 0.3, domain: 'unit' }],
	atoms: ([p], eps) => {
		const logPmf = (k: number) => Math.log(p) + k * Math.log1p(-p);
		return integerAtoms(logPmf, 0, 0, eps);
	},
	cf: (t, [p]) => {
		const q = 1 - p;
		const den = 1 - 2 * q * Math.cos(t) + q * q;
		return [(p * (1 - q * Math.cos(t))) / den, (p * q * Math.sin(t)) / den];
	},
	mean: ([p]) => (1 - p) / p,
	variance: ([p]) => (1 - p) / (p * p),
	range: (params, eps) => atomRange(geometric.atoms!(params, eps)),
	sampler:
		([p]) =>
		(prng) =>
			Math.floor(Math.log(1 - prng.next()) / Math.log(1 - p))
};

/** Every family, in picker order. */
export const FAMILIES: readonly Family[] = [
	normal,
	laplace,
	uniform,
	exponential,
	gamma,
	lognormal,
	studentT,
	cauchy,
	fringe,
	poisson,
	binomial,
	geometric
];

const BY_ID = new Map<string, Family>(FAMILIES.map((f) => [f.id, f]));

export function family(id: FamilyId): Family {
	const f = BY_ID.get(id);
	if (!f) throw new Error(`Unknown family: ${id}`);
	return f;
}

/** True for a known family id (for validating untrusted input). */
export function isFamilyId(value: unknown): value is FamilyId {
	return typeof value === 'string' && BY_ID.has(value);
}

export function defaultParams(id: FamilyId): number[] {
	return family(id).params.map((p) => p.default);
}

/** Inline-error messages for invalid parameters; empty when they are valid. */
export function validateParams(id: FamilyId, params: readonly number[]): ParamError[] {
	const f = family(id);
	if (params.length !== f.params.length) {
		return [{ index: -1, message: `${f.name} takes ${f.params.length} parameters.` }];
	}
	const errors: ParamError[] = [];
	params.forEach((v, index) => {
		const { label, domain } = f.params[index];
		if (!Number.isFinite(v)) errors.push({ index, message: 'Enter a finite number.' });
		else if (domain === 'positive' && !(v > 0))
			errors.push({ index, message: `${label} must be positive.` });
		else if (domain === 'unit' && !(v > 0 && v < 1))
			errors.push({ index, message: `${label} must lie strictly between 0 and 1.` });
		else if (domain === 'unitClosed' && !(v >= 0 && v <= 1))
			errors.push({ index, message: `${label} must lie between 0 and 1.` });
		else if (domain === 'count' && !(Number.isInteger(v) && v >= 0 && v <= 1e6))
			errors.push({ index, message: `${label} must be a whole number from 0 to 10⁶.` });
	});
	if (errors.length) return errors;
	return f.validate?.(params) ?? [];
}
