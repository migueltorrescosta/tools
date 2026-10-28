/**
 * The distribution catalogue for X (signal) and Y (noise): densities or
 * point masses, characteristic functions, moments, ranges and exact samplers.
 * No DOM or Svelte imports.
 */
import { logGamma, poisson as poissonSampler } from '$lib/variates';
import type { Atoms, Family, FamilyId, ParamError } from './types';

const SQRT_2PI = Math.sqrt(2 * Math.PI);

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
			const u = prng.next() - 0.5;
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

/** Every family, in picker order. */
export const FAMILIES: readonly Family[] = [normal, laplace, poisson];

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
