/**
 * The page's settings: the model (X, Y, n, seed) and the estimate options,
 * with presets, validation of untrusted input (share links, saved state) and
 * the share-link encoding. Uploaded data is never part of it.
 * No DOM or Svelte imports.
 */
import { defaultParams, isFamilyId } from './families';
import type { DistSpec, MethodId, SimpleSpec } from './types';

export const STORAGE_PREFIX = 'deconvolution:';
export const AUTOSAVE_KEY = `${STORAGE_PREFIX}settings`;
export const HASH_PARAM = 's';
export const VERSION = 1;
export const MAX_N = 100_000;
export const MIN_N = 10;
export const MAX_BOOTSTRAP = 2000;

export const METHODS: readonly MethodId[] = ['mle', 'npmle', 'gmodel', 'kernel', 'gmm'];

export interface Settings {
	v: typeof VERSION;
	x: DistSpec;
	y: SimpleSpec;
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

export function presetSettings(id = PRESETS[0].id): Settings {
	const p = PRESETS.find((q) => q.id === id) ?? PRESETS[0];
	return {
		v: VERSION,
		x: structuredClone(p.x),
		y: structuredClone(p.y),
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

/** Settings from untrusted JSON, or null when anything is missing or out of range. */
export function parseSettings(v: unknown): Settings | null {
	if (!isObject(v) || v.v !== VERSION) return null;
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
		x,
		y,
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
