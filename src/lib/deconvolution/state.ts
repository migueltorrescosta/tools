/**
 * The page's settings: the model (X, Y, n, seed) and the estimate options,
 * with presets, validation of untrusted input (share links, saved state) and
 * the share-link encoding. Uploaded data is never part of it.
 * No DOM or Svelte imports.
 */
import { defaultParams, isFamilyId } from './families';
import { GAUSS2_PARAMS, FRINGE2_PARAMS, type Noise2Spec, type Spec2 } from './dist2';
import type { Method2 } from './estimate2';
import type { DistSpec, MethodId, SimpleSpec } from './types';

export const STORAGE_PREFIX = 'deconvolution:';
export const AUTOSAVE_KEY = `${STORAGE_PREFIX}settings`;
export const HASH_PARAM = 's';
export const VERSION = 2;
export const MAX_N = 100_000;
export const MIN_N = 10;
export const MAX_BOOTSTRAP = 2000;

export const METHODS: readonly MethodId[] = ['mle', 'npmle', 'gmodel', 'kernel', 'gmm'];
export const METHODS2: readonly Method2[] = ['mle', 'npmle', 'gmm'];

export interface Settings {
	v: typeof VERSION;
	/** 1D (x, y, methods) or 2D (x2, y2, methods2); both are kept, so switching back restores them. */
	dim: 1 | 2;
	x: DistSpec;
	y: SimpleSpec;
	x2: Spec2;
	y2: Noise2Spec;
	methods2: Method2[];
	/** The 2D parametric fit also fits the noise (2D presets set it like 1D ones set `fitNoise`). */
	fitNoise2: boolean;
	n: number;
	seed: number;
	source: 'simulated' | 'uploaded';
	methods: MethodId[];
	/** The parametric fit also fits Y's parameters (otherwise holds them as entered). */
	fitNoise: boolean;
	/** Y's parameters for the nonparametric methods: as entered, or from the parametric fit. */
	noiseFor: 'entered' | 'fitted';
	/** g-modeling spline degrees of freedom and penalty. */
	df: number;
	c0: number;
	/** Kernel bandwidth; null picks the default rule. */
	bandwidth: number | null;
	bootstrapB: number;
}

export interface Preset {
	id: string;
	name: string;
	x: DistSpec;
	y: SimpleSpec;
	/** False where the pair can't be identified with the noise fitted too (see the docs). */
	fitNoise: boolean;
}

export const PRESETS: readonly Preset[] = [
	{
		id: 'waiting-times',
		name: 'Waiting times, Laplace noise',
		x: { family: 'gamma', params: [3, 1] },
		y: { family: 'laplace', params: [0, 0.5] },
		fitNoise: true
	},
	{
		id: 'two-peaks',
		name: 'Two peaks in white noise',
		x: {
			family: 'mixture',
			components: [
				{ family: 'normal', params: [-2, 0.6], weight: 0.4 },
				{ family: 'normal', params: [2, 0.8], weight: 0.6 }
			]
		},
		y: { family: 'normal', params: [0, 0.7] },
		fitNoise: false
	},
	{
		id: 'counts',
		name: 'Counts in white noise',
		x: { family: 'poisson', params: [4] },
		y: { family: 'normal', params: [0, 0.3] },
		fitNoise: true
	},
	{
		id: 'fringes',
		name: 'Interference fringes, white noise',
		x: { family: 'fringe', params: [0, 2, 3, 0.8, 0] },
		y: { family: 'normal', params: [0, 0.2] },
		fitNoise: false
	}
];

export interface Preset2 {
	id: string;
	name: string;
	x: Spec2;
	y: Noise2Spec;
	/** False where the pair can't be identified with the noise fitted too. */
	fitNoise: boolean;
}

export const PRESETS2: readonly Preset2[] = [
	{
		id: 'two-peaks-2d',
		name: 'Two correlated peaks, Gaussian noise',
		x: {
			family: 'mixture2',
			components: [
				{ params: [-2, 0, 0.6, 0.8, 0.3], weight: 0.4 },
				{ params: [2, 1, 0.7, 0.5, -0.4], weight: 0.6 }
			]
		},
		y: { family: 'gauss2', params: [0, 0, 0.5, 0.5, 0.2] },
		fitNoise: false
	},
	{
		id: 'waiting-times-2d',
		name: 'Two waiting times, Laplace noise',
		x: {
			family: 'product',
			x: { family: 'gamma', params: [3, 1] },
			y: { family: 'gamma', params: [2, 1.5] }
		},
		y: {
			family: 'product',
			x: { family: 'laplace', params: [0, 0.5] },
			y: { family: 'laplace', params: [0, 0.7] }
		},
		fitNoise: true
	},
	{
		id: 'fringes-2d',
		name: 'Interference fringes, Gaussian noise',
		x: { family: 'fringe2', params: [0, 0, 2, 2, 0, 3, 1, 0.8, 0] },
		y: { family: 'gauss2', params: [0, 0, 0.2, 0.2, 0] },
		fitNoise: false
	}
];

export function presetSettings(id = PRESETS[0].id): Settings {
	const p = PRESETS.find((q) => q.id === id) ?? PRESETS[0];
	return {
		v: VERSION,
		dim: 1,
		x: structuredClone(p.x),
		y: structuredClone(p.y),
		x2: structuredClone(PRESETS2[0].x),
		y2: structuredClone(PRESETS2[0].y),
		methods2: ['mle', 'npmle'],
		fitNoise2: PRESETS2[0].fitNoise,
		n: 2000,
		seed: 1,
		source: 'simulated',
		methods: ['mle', 'npmle'],
		fitNoise: p.fitNoise,
		noiseFor: p.fitNoise ? 'fitted' : 'entered',
		df: 5,
		c0: 1,
		bandwidth: null,
		bootstrapB: 200
	};
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function simpleSpec(v: unknown): SimpleSpec | null {
	if (!isObject(v) || !isFamilyId(v.family) || !Array.isArray(v.params)) return null;
	if (v.params.length !== defaultParams(v.family).length || !v.params.every(finite)) return null;
	return { family: v.family, params: [...v.params] };
}

function distSpec(v: unknown): DistSpec | null {
	if (isObject(v) && v.family === 'mixture') {
		const c = v.components;
		if (!Array.isArray(c) || c.length < 2 || c.length > 3) return null;
		const components = c.map((x) => {
			const s = simpleSpec(x);
			return s && isObject(x) && finite(x.weight) && x.weight > 0
				? { ...s, weight: x.weight }
				: null;
		});
		return components.every((x) => x !== null) ? { family: 'mixture', components } : null;
	}
	return simpleSpec(v);
}

const finiteArray = (v: unknown, length: number): v is number[] =>
	Array.isArray(v) && v.length === length && v.every(finite);

function spec2(v: unknown): Spec2 | null {
	if (!isObject(v)) return null;
	switch (v.family) {
		case 'gauss2':
			return finiteArray(v.params, GAUSS2_PARAMS.length)
				? { family: 'gauss2', params: [...v.params] }
				: null;
		case 'fringe2':
			return finiteArray(v.params, FRINGE2_PARAMS.length)
				? { family: 'fringe2', params: [...v.params] }
				: null;
		case 'product': {
			const x = simpleSpec(v.x);
			const y = simpleSpec(v.y);
			return x && y ? { family: 'product', x, y } : null;
		}
		case 'mixture2': {
			const c = v.components;
			if (!Array.isArray(c) || c.length < 2 || c.length > 3) return null;
			const components = c.map((q) =>
				isObject(q) &&
				finiteArray(q.params, GAUSS2_PARAMS.length) &&
				finite(q.weight) &&
				q.weight > 0
					? { params: [...q.params], weight: q.weight }
					: null
			);
			return components.every((q) => q !== null) ? { family: 'mixture2', components } : null;
		}
	}
	return null;
}

function noise2(v: unknown): Noise2Spec | null {
	const s = spec2(v);
	return s && (s.family === 'gauss2' || s.family === 'product') ? s : null;
}

/** Settings from untrusted JSON, or null when anything is missing or out of range. */
export function parseSettings(v: unknown): Settings | null {
	if (!isObject(v)) return null;
	// Version 1 had no 2D settings: start those at the defaults.
	if (v.v === 1) {
		const d = presetSettings();
		v = {
			...v,
			v: VERSION,
			dim: 1,
			x2: d.x2,
			y2: d.y2,
			methods2: d.methods2,
			fitNoise2: d.fitNoise2
		};
	}
	if (!isObject(v) || v.v !== VERSION) return null;
	if (v.dim !== 1 && v.dim !== 2) return null;
	const x2 = spec2(v.x2);
	const y2 = noise2(v.y2);
	if (!x2 || !y2) return null;
	if (typeof v.fitNoise2 !== 'boolean') return null;
	if (!Array.isArray(v.methods2) || !v.methods2.every((m) => METHODS2.includes(m as Method2)))
		return null;
	const x = distSpec(v.x);
	const y = simpleSpec(v.y);
	if (!x || !y) return null;
	const n = v.n;
	if (!finite(n) || !Number.isInteger(n) || n < MIN_N || n > MAX_N) return null;
	if (!finite(v.seed) || !Number.isInteger(v.seed) || v.seed < 0 || v.seed > 2 ** 32 - 1)
		return null;
	if (v.source !== 'simulated' && v.source !== 'uploaded') return null;
	if (!Array.isArray(v.methods) || !v.methods.every((m) => METHODS.includes(m as MethodId)))
		return null;
	if (typeof v.fitNoise !== 'boolean') return null;
	if (v.noiseFor !== 'entered' && v.noiseFor !== 'fitted') return null;
	if (!finite(v.df) || !Number.isInteger(v.df) || v.df < 2 || v.df > 12) return null;
	if (!finite(v.c0) || v.c0 < 0 || v.c0 > 1000) return null;
	if (v.bandwidth !== null && !(finite(v.bandwidth) && v.bandwidth > 0)) return null;
	const b = v.bootstrapB;
	if (!finite(b) || !Number.isInteger(b) || b < 10 || b > MAX_BOOTSTRAP) return null;
	return {
		v: VERSION,
		dim: v.dim,
		x,
		y,
		x2,
		y2,
		methods2: [...new Set(v.methods2 as Method2[])],
		fitNoise2: v.fitNoise2,
		n,
		seed: v.seed,
		source: v.source,
		methods: [...new Set(v.methods as MethodId[])],
		fitNoise: v.fitNoise,
		noiseFor: v.noiseFor,
		df: v.df,
		c0: v.c0,
		bandwidth: v.bandwidth,
		bootstrapB: b
	};
}

/** Settings as a URL-safe base64 string. */
export function encodeSettings(s: Settings): string {
	const bytes = new TextEncoder().encode(JSON.stringify(s));
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The inverse of `encodeSettings`; null for anything that doesn't decode to valid settings. */
export function decodeSettings(text: string): Settings | null {
	if (text.length > 20_000) return null;
	try {
		const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
		return parseSettings(JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		return null;
	}
}
