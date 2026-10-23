/**
 * Distribution families for random inputs: parameter metadata, validation,
 * closed-form moments and exact samplers over the seeded `Prng`.
 * No DOM or Svelte imports.
 */
import type { Prng } from '$lib/prng';
import type { Family } from './types';

export interface ParamInfo {
	/** Short label shown next to the field, e.g. `μ`. */
	label: string;
	/** Value a new input of this family starts with. */
	default: number;
}

export interface FamilyInfo {
	family: Family;
	/** Display name, e.g. `Normal`. */
	name: string;
	params: readonly ParamInfo[];
	/** True when every draw is an integer (binomial, Poisson). */
	discrete: boolean;
}

/** Every family, in picker order. Parameter order matches `RandomInput.params`. */
export const FAMILIES: readonly FamilyInfo[] = [
	{
		family: 'normal',
		name: 'Normal',
		discrete: false,
		params: [
			{ label: 'μ', default: 0 },
			{ label: 'σ', default: 1 }
		]
	},
	{
		family: 'lognormal',
		name: 'Lognormal',
		discrete: false,
		params: [
			{ label: 'median', default: 1 },
			{ label: 'σ', default: 0.5 }
		]
	},
	{
		family: 'uniform',
		name: 'Uniform',
		discrete: false,
		params: [
			{ label: 'low', default: 0 },
			{ label: 'high', default: 1 }
		]
	},
	{
		family: 'exponential',
		name: 'Exponential',
		discrete: false,
		params: [{ label: 'mean', default: 1 }]
	},
	{
		family: 'triangular',
		name: 'Triangular',
		discrete: false,
		params: [
			{ label: 'low', default: 0 },
			{ label: 'mode', default: 0.5 },
			{ label: 'high', default: 1 }
		]
	},
	{
		family: 'binomial',
		name: 'Binomial',
		discrete: true,
		params: [
			{ label: 'n', default: 10 },
			{ label: 'p', default: 0.5 }
		]
	},
	{
		family: 'poisson',
		name: 'Poisson',
		discrete: true,
		params: [{ label: 'λ', default: 1 }]
	},
	{
		family: 'beta',
		name: 'Beta',
		discrete: false,
		params: [
			{ label: 'α', default: 2 },
			{ label: 'β', default: 2 }
		]
	},
	{
		family: 'fixed',
		name: 'Fixed',
		discrete: false,
		params: [{ label: 'value', default: 1 }]
	}
];

const INFO = new Map(FAMILIES.map((f) => [f.family, f]));

/** Metadata for one family. */
export function familyInfo(family: Family): FamilyInfo {
	const info = INFO.get(family);
	if (!info) throw new Error(`Unknown family: ${family}`);
	return info;
}

/** True for a `fixed` input: a known number, not sampled. */
export function isFixed(input: { family: Family }): boolean {
	return input.family === 'fixed';
}

/** True for a known family name (for validating untrusted input). */
export function isFamily(value: unknown): value is Family {
	return typeof value === 'string' && INFO.has(value as Family);
}

/** Default parameters for a new input of `family`. */
export function defaultParams(family: Family): number[] {
	return familyInfo(family).params.map((p) => p.default);
}

/** Largest binomial n and Poisson λ the samplers accept. */
export const MAX_COUNT = 1e9;

export interface ParamError {
	/** Parameter index the message belongs to, or -1 for the whole input. */
	index: number;
	message: string;
}

/** Inline-error messages for invalid parameters; empty when the parameters are valid. */
export function validateParams(family: Family, params: readonly number[]): ParamError[] {
	const info = familyInfo(family);
	if (params.length !== info.params.length) {
		return [{ index: -1, message: `${info.name} takes ${info.params.length} parameters.` }];
	}
	const errors: ParamError[] = [];
	params.forEach((v, index) => {
		if (!Number.isFinite(v)) errors.push({ index, message: 'Enter a finite number.' });
	});
	if (errors.length) return errors;
	const check = (index: number, ok: boolean, message: string) => {
		if (!ok) errors.push({ index, message });
	};
	const [a, b, c] = params;
	switch (family) {
		case 'normal':
			check(1, b > 0, 'σ must be positive.');
			break;
		case 'lognormal':
			check(0, a > 0, 'The median must be positive.');
			check(1, b > 0, 'σ must be positive.');
			break;
		case 'uniform':
			check(1, a < b, 'high must be above low.');
			break;
		case 'exponential':
			check(0, a > 0, 'The mean must be positive.');
			break;
		case 'triangular':
			check(2, a < c, 'high must be above low.');
			if (a < c) check(1, a <= b && b <= c, 'mode must lie between low and high.');
			break;
		case 'binomial':
			check(
				0,
				Number.isInteger(a) && a >= 0 && a <= MAX_COUNT,
				'n must be a whole number from 0 to 10⁹.'
			);
			check(1, b >= 0 && b <= 1, 'p must lie between 0 and 1.');
			break;
		case 'poisson':
			check(0, a > 0 && a <= MAX_COUNT, 'λ must be positive and at most 10⁹.');
			break;
		case 'beta':
			check(0, a > 0, 'α must be positive.');
			check(1, b > 0, 'β must be positive.');
			break;
	}
	return errors;
}

/** Closed-form mean of a valid parameter set. */
export function mean(family: Family, params: readonly number[]): number {
	const [a, b, c] = params;
	switch (family) {
		case 'normal':
			return a;
		case 'lognormal':
			return a * Math.exp((b * b) / 2);
		case 'uniform':
			return (a + b) / 2;
		case 'exponential':
			return a;
		case 'triangular':
			return (a + b + c) / 3;
		case 'binomial':
			return a * b;
		case 'poisson':
			return a;
		case 'beta':
			return a / (a + b);
		case 'fixed':
			return a;
	}
}

/** Closed-form variance of a valid parameter set. */
export function variance(family: Family, params: readonly number[]): number {
	const [a, b, c] = params;
	switch (family) {
		case 'normal':
			return b * b;
		case 'lognormal':
			return a * a * Math.exp(b * b) * Math.expm1(b * b);
		case 'uniform':
			return ((b - a) * (b - a)) / 12;
		case 'exponential':
			return a * a;
		case 'triangular':
			return (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
		case 'binomial':
			return a * b * (1 - b);
		case 'poisson':
			return a;
		case 'beta':
			return (a * b) / ((a + b) * (a + b) * (a + b + 1));
		case 'fixed':
			return 0;
	}
}

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
const open0 = (prng: Prng) => 1 - prng.next();

/** ln of a Gamma(shape, 1) draw: Marsaglia–Tsang, with the u^(1/a) boost below shape 1. */
function logGammaDraw(prng: Prng, shape: number): number {
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

function binomial(n: number, p: number): (prng: Prng) => number {
	if (n === 0 || p === 0) return () => 0;
	if (p === 1) return () => n;
	if (p > 0.5) {
		const draw = binomial(n, 1 - p);
		return (prng) => n - draw(prng);
	}
	return n * p < 10 ? binomialInversion(n, p) : binomialBtrs(n, p);
}

/** A sampler for one valid parameter set, drawing exactly from the family. */
export function sampler(family: Family, params: readonly number[]): (prng: Prng) => number {
	const [a, b, c] = params;
	switch (family) {
		case 'normal':
			return (prng) => a + b * prng.normal();
		case 'lognormal':
			return (prng) => a * Math.exp(b * prng.normal());
		case 'uniform':
			return (prng) => a + (b - a) * prng.next();
		case 'exponential':
			return (prng) => -a * Math.log(open0(prng));
		case 'triangular': {
			const width = c - a;
			const split = (b - a) / width;
			return (prng) => {
				const u = prng.next();
				return u < split
					? a + Math.sqrt(u * width * (b - a))
					: c - Math.sqrt((1 - u) * width * (c - b));
			};
		}
		case 'binomial':
			return binomial(a, b);
		case 'poisson':
			return a < 10 ? poissonInversion(a) : poissonPtrs(a);
		case 'beta':
			return (prng) => {
				const lx = logGammaDraw(prng, a);
				const ly = logGammaDraw(prng, b);
				return 1 / (1 + Math.exp(ly - lx));
			};
		case 'fixed':
			return () => a;
	}
}

/** Fill `out[start..end)` with draws from a valid parameter set. */
export function fill(
	family: Family,
	params: readonly number[],
	prng: Prng,
	out: Float64Array,
	start = 0,
	end = out.length
): void {
	const draw = sampler(family, params);
	for (let i = start; i < end; i++) out[i] = draw(prng);
}
