/**
 * Distribution families for random inputs: parameter metadata, validation,
 * closed-form moments and exact samplers over the seeded `Prng`.
 * No DOM or Svelte imports.
 */
import type { Prng } from '$lib/prng';
import { binomial, logGammaDraw, open0, poisson } from '$lib/variates';
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
			return poisson(a);
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
