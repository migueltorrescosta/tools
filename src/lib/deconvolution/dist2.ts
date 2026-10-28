/**
 * Two-dimensional signals and noises: a correlated Gaussian, a mixture of
 * them, a product of two 1D catalogue marginals, and a 2D fringe pattern.
 * The noise is a centred Gaussian or a product of two continuous 1D noises,
 * so Z = X + Y always has a density. No DOM or Svelte imports.
 */
import type { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { family, normalHalfWidth, validateParams } from './families';
import { discretise, typicalWidth } from './grid';
import type { Dist, Grid, ParamError, ParamSpec, Role, SimpleSpec } from './types';

/** A uniform 2D grid, x_i = x0 + i·hx, y_j = y0 + j·hy; arrays are row-major by y (j·mx + i). */
export interface Grid2 {
	x0: number;
	hx: number;
	mx: number;
	y0: number;
	hy: number;
	my: number;
}

/** A 2D estimate as cell masses (sums to 1). */
export interface GridEstimate2 {
	grid: Grid2;
	mass: Float64Array;
}

/** [μx, μy, σx, σy, ρ] */
export interface Gauss2Spec {
	family: 'gauss2';
	params: number[];
}
/** 2–3 correlated Gaussians. */
export interface Mixture2Spec {
	family: 'mixture2';
	components: { params: number[]; weight: number }[];
}
/** Independent marginals from the 1D catalogue. */
export interface ProductSpec {
	family: 'product';
	x: SimpleSpec;
	y: SimpleSpec;
}
/** [μx, μy, σx, σy, ρ, kx, ky, V, φ]: (1 + V·cos(k·(x − μ) + φ))·N(μ, Σ), normalised. */
export interface Fringe2Spec {
	family: 'fringe2';
	params: number[];
}
export type Spec2 = Gauss2Spec | Mixture2Spec | ProductSpec | Fringe2Spec;
export type Noise2Spec = Gauss2Spec | ProductSpec;

export const GAUSS2_PARAMS: readonly ParamSpec[] = [
	{ key: 'mux', label: 'μx', default: 0, domain: 'real' },
	{ key: 'muy', label: 'μy', default: 0, domain: 'real' },
	{ key: 'sx', label: 'σx', default: 1, domain: 'positive' },
	{ key: 'sy', label: 'σy', default: 1, domain: 'positive' },
	{ key: 'rho', label: 'ρ', default: 0, domain: 'corr' }
];
export const FRINGE2_PARAMS: readonly ParamSpec[] = [
	...GAUSS2_PARAMS.slice(0, 4).map((p) => ({ ...p, default: p.key.startsWith('s') ? 2 : 0 })),
	GAUSS2_PARAMS[4],
	{ key: 'kx', label: 'kx', default: 3, domain: 'real' },
	{ key: 'ky', label: 'ky', default: 0, domain: 'real' },
	{ key: 'V', label: 'visibility V', default: 0.8, domain: 'unitClosed' },
	{ key: 'phi', label: 'phase φ', default: 0, domain: 'real' }
];

/** A built 2D distribution. */
export interface Dist2 {
	/** Density, or null when a marginal is discrete. */
	pdf: ((x: number, y: number) => number) | null;
	/** Cell masses on a grid (mass outside is dropped; an unresolved peak is capped at total 1). */
	masses(grid: Grid2): Float64Array;
	/** [xlo, xhi, ylo, yhi] holding at least 1 − eps of the mass. */
	box(eps: number): [number, number, number, number];
	/** Per axis, the width holding about half the mass (Infinity on a discrete axis). */
	scale: [number, number];
	mean: [number, number] | undefined;
	/** [var x, cov xy, var y]; undefined when it doesn't exist. */
	cov: [number, number, number] | undefined;
	sampler: (prng: Prng) => [number, number];
	/** Identifies the distribution (role and spec), for caching its cell masses. */
	key: string;
}

/** Inline errors for a correlated Gaussian's parameters (index 0–4). */
function gaussErrors(p: readonly number[], offset = 0): ParamError[] {
	const out: ParamError[] = [];
	p.slice(0, 5).forEach((v, i) => {
		if (!Number.isFinite(v)) out.push({ index: offset + i, message: 'Enter a finite number.' });
	});
	if (out.length) return out;
	if (!(p[2] > 0)) out.push({ index: offset + 2, message: 'σx must be positive.' });
	if (!(p[3] > 0)) out.push({ index: offset + 3, message: 'σy must be positive.' });
	if (!(Math.abs(p[4]) < 1))
		out.push({ index: offset + 4, message: 'ρ must lie strictly between −1 and 1.' });
	return out;
}

/** Errors of a 2D spec, keyed by part ('x', 'y', 'c0'…) for products and mixtures. */
export function validate2(spec: Spec2): { part: string; index: number; message: string }[] {
	switch (spec.family) {
		case 'gauss2':
			return gaussErrors(spec.params).map((e) => ({ part: '', ...e }));
		case 'fringe2': {
			const out = gaussErrors(spec.params).map((e) => ({ part: '', ...e }));
			const [, , sx, sy, rho, kx, ky, V, phi] = spec.params;
			spec.params.slice(5).forEach((v, i) => {
				if (!Number.isFinite(v))
					out.push({ part: '', index: 5 + i, message: 'Enter a finite number.' });
			});
			if (!(V >= 0 && V <= 1))
				out.push({ part: '', index: 7, message: 'V must lie between 0 and 1.' });
			if (!out.length && fringeNorm(sx, sy, rho, kx, ky, V, phi) <= 1e-6)
				out.push({
					part: '',
					index: 7,
					message: 'This visibility and phase leave no probability mass.'
				});
			return out;
		}
		case 'mixture2':
			return spec.components.flatMap((c, i) => [
				...gaussErrors(c.params).map((e) => ({ part: `c${i}`, ...e })),
				...(c.weight > 0 ? [] : [{ part: `c${i}`, index: -1, message: 'weight must be positive.' }])
			]);
		case 'product':
			return [
				...validateParams(spec.x.family, spec.x.params).map((e) => ({ part: 'x', ...e })),
				...validateParams(spec.y.family, spec.y.params).map((e) => ({ part: 'y', ...e }))
			];
	}
}

/** 1 + V·cos φ·e^{−kᵀΣk/2}: the fringe pattern's normalising constant. */
function fringeNorm(
	sx: number,
	sy: number,
	rho: number,
	kx: number,
	ky: number,
	V: number,
	phi: number
) {
	const q = sx * sx * kx * kx + 2 * rho * sx * sy * kx * ky + sy * sy * ky * ky;
	return 1 + V * Math.cos(phi) * Math.exp(-q / 2);
}

/** Density of N((mx, my), Σ) for σx, σy, ρ. */
function gaussPdf(mx: number, my: number, sx: number, sy: number, rho: number) {
	const det = 1 - rho * rho;
	const c = 1 / (2 * Math.PI * sx * sy * Math.sqrt(det));
	return (x: number, y: number) => {
		const u = (x - mx) / sx;
		const v = (y - my) / sy;
		return c * Math.exp(-(u * u - 2 * rho * u * v + v * v) / (2 * det));
	};
}

/** Draws from N((mx, my), Σ) by the Cholesky factor. */
function gaussSampler(mx: number, my: number, sx: number, sy: number, rho: number) {
	const r = Math.sqrt(1 - rho * rho);
	return (prng: Prng): [number, number] => {
		const a = prng.normal();
		const b = prng.normal();
		return [mx + sx * a, my + sy * (rho * a + r * b)];
	};
}

/**
 * Adds weight·N((mx, my), Σ) at every node of g into out, times
 * (1 + V·cos(kx(x − mx) + ky(y − my) + φ)) when a fringe is given. Along a
 * row the exponent is quadratic in i, so from the row's peak each node is two
 * multiplications from its neighbour instead of an exp; the cosine is rotated
 * the same way.
 */
function addGaussGrid(
	out: Float64Array,
	g: Grid2,
	weight: number,
	[mx, my, sx, sy, rho]: readonly number[],
	fringe?: { kx: number; ky: number; V: number; phi: number }
) {
	const d = 1 - rho * rho;
	const c = weight / (2 * Math.PI * sx * sy * Math.sqrt(d));
	const a = (g.hx / sx) ** 2 / d; // Q(i) = a·i² + b·i + e on a row
	const step = Math.exp(-a);
	for (let j = 0; j < g.my; j++) {
		const v = (g.y0 + j * g.hy - my) / sy;
		const u0 = (g.x0 - mx) / sx;
		const du = g.hx / sx;
		const b = (2 * u0 * du - 2 * rho * v * du) / d;
		const e = (u0 * u0 - 2 * rho * u0 * v + v * v) / d;
		const Q = (i: number) => a * i * i + b * i + e;
		const peak = Math.min(g.mx - 1, Math.max(0, Math.round(-b / (2 * a))));
		const row = j * g.mx;
		const theta = (i: number) =>
			fringe
				? fringe.kx * (g.x0 + i * g.hx - mx) + fringe.ky * (g.y0 + j * g.hy - my) + fringe.phi
				: 0;
		const dth = fringe ? fringe.kx * g.hx : 0;
		for (const dir of [1, -1]) {
			let i = dir === 1 ? peak : peak - 1;
			if (i < 0) continue;
			let val = Math.exp(-Q(i) / 2);
			// Ratio to the next node in this direction, and how it changes per step.
			let ratio = Math.exp(-(Q(i + dir) - Q(i)) / 2);
			let cs = Math.cos(theta(i));
			let sn = Math.sin(theta(i));
			const cd = Math.cos(dth);
			const sd = dir * Math.sin(dth);
			for (; i >= 0 && i < g.mx; i += dir) {
				if (val < 1e-300) break;
				out[row + i] += c * val * (fringe ? 1 + fringe.V * cs : 1);
				val *= ratio;
				ratio *= step;
				[cs, sn] = [cs * cd - sn * sd, sn * cd + cs * sd];
			}
		}
	}
}

/** Caps cell masses at total 1 (see `discretise`), in place. */
function cap(out: Float64Array): Float64Array {
	let total = 0;
	for (let k = 0; k < out.length; k++) total += out[k];
	if (total > 1) for (let k = 0; k < out.length; k++) out[k] /= total;
	return out;
}

function gauss2([mx, my, sx, sy, rho]: readonly number[]): Omit<Dist2, 'key'> {
	const pdf = gaussPdf(mx, my, sx, sy, rho);
	return {
		pdf,
		masses: (g) => {
			const out = new Float64Array(g.mx * g.my);
			addGaussGrid(out, g, g.hx * g.hy, [mx, my, sx, sy, rho]);
			return cap(out);
		},
		box: (eps) => {
			// Each axis's marginal holds 1 − eps/2, so the box holds at least 1 − eps.
			const w = normalHalfWidth(eps / 2);
			return [mx - w * sx, mx + w * sx, my - w * sy, my + w * sy];
		},
		scale: [1.349 * sx, 1.349 * sy],
		mean: [mx, my],
		cov: [sx * sx, rho * sx * sy, sy * sy],
		sampler: gaussSampler(mx, my, sx, sy, rho)
	};
}

function fringe2([mx, my, sx, sy, rho, kx, ky, V, phi]: readonly number[]): Omit<Dist2, 'key'> {
	const env = gaussPdf(mx, my, sx, sy, rho);
	const C = fringeNorm(sx, sy, rho, kx, ky, V, phi);
	const pdf = (x: number, y: number) =>
		((1 + V * Math.cos(kx * (x - mx) + ky * (y - my) + phi)) * env(x, y)) / C;
	const draw = gaussSampler(mx, my, sx, sy, rho);
	// Resolve both the envelope and a fringe period along each axis.
	const period = (k: number) => (k === 0 ? Infinity : (2 * Math.PI) / Math.abs(k));
	return {
		pdf,
		masses: (g) => {
			const out = new Float64Array(g.mx * g.my);
			addGaussGrid(out, g, (g.hx * g.hy) / C, [mx, my, sx, sy, rho], { kx, ky, V, phi });
			return cap(out);
		},
		box: (eps) => {
			const w = normalHalfWidth((eps * C) / (2 * (1 + V)));
			return [mx - w * sx, mx + w * sx, my - w * sy, my + w * sy];
		},
		scale: [Math.min(1.349 * sx, period(kx)), Math.min(1.349 * sy, period(ky))],
		mean: undefined,
		cov: undefined,
		sampler: (prng) => {
			for (;;) {
				const [x, y] = draw(prng);
				const accept = (1 + V * Math.cos(kx * (x - mx) + ky * (y - my) + phi)) / (1 + V);
				if (prng.next() < accept) return [x, y];
			}
		}
	};
}

function mixture2(components: { params: number[]; weight: number }[]): Omit<Dist2, 'key'> {
	const total = components.reduce((s, c) => s + c.weight, 0);
	const parts = components.map((c) => ({
		w: c.weight / total,
		d: gauss2(c.params),
		params: c.params
	}));
	const pdf = (x: number, y: number) => parts.reduce((s, p) => s + p.w * p.d.pdf!(x, y), 0);
	const mean: [number, number] = [
		parts.reduce((s, p) => s + p.w * p.d.mean![0], 0),
		parts.reduce((s, p) => s + p.w * p.d.mean![1], 0)
	];
	const second = (a: 0 | 1, b: 0 | 1, c: 0 | 1 | 2) =>
		parts.reduce((s, p) => s + p.w * (p.d.cov![c] + p.d.mean![a] * p.d.mean![b]), 0) -
		mean[a] * mean[b];
	return {
		pdf,
		masses: (g) => {
			const out = new Float64Array(g.mx * g.my);
			for (const p of parts) addGaussGrid(out, g, p.w * g.hx * g.hy, p.params);
			return cap(out);
		},
		box: (eps) => {
			const boxes = parts.map((p) => p.d.box(eps));
			return [
				Math.min(...boxes.map((b) => b[0])),
				Math.max(...boxes.map((b) => b[1])),
				Math.min(...boxes.map((b) => b[2])),
				Math.max(...boxes.map((b) => b[3]))
			];
		},
		scale: [
			Math.min(...parts.map((p) => p.d.scale[0])),
			Math.min(...parts.map((p) => p.d.scale[1]))
		],
		mean,
		cov: [second(0, 0, 0), second(0, 1, 1), second(1, 1, 2)],
		sampler: (prng) => {
			let u = prng.next();
			for (const p of parts) {
				if (u < p.w) return p.d.sampler(prng);
				u -= p.w;
			}
			return parts[parts.length - 1].d.sampler(prng);
		}
	};
}

function product(X: Dist, Y: Dist): Omit<Dist2, 'key'> {
	let scale: [number, number] | undefined;
	const pdf = X.pdf && Y.pdf ? (x: number, y: number) => X.pdf!(x) * Y.pdf!(y) : null;
	return {
		pdf,
		masses: (g) => {
			const mx = discretise(X, { x0: g.x0, h: g.hx, m: g.mx });
			const my = discretise(Y, { x0: g.y0, h: g.hy, m: g.my });
			const out = new Float64Array(g.mx * g.my);
			for (let j = 0; j < g.my; j++)
				for (let i = 0; i < g.mx; i++) out[j * g.mx + i] = mx[i] * my[j];
			return out;
		},
		box: (eps) => {
			const [a, b] = X.range(eps / 2);
			const [c, d] = Y.range(eps / 2);
			return [a, b, c, d];
		},
		// Lazy: a gamma's typical width takes a bisection, and fits build a Dist2 per evaluation
		// but only need the scale when they choose a grid.
		get scale(): [number, number] {
			return (scale ??= [typicalWidth(X), typicalWidth(Y)]);
		},
		mean: X.mean !== undefined && Y.mean !== undefined ? [X.mean, Y.mean] : undefined,
		cov:
			X.variance !== undefined && Y.variance !== undefined
				? [X.variance, 0, Y.variance]
				: undefined,
		sampler: (prng) => [X.sampler(prng), Y.sampler(prng)]
	};
}

/** True when a noise spec is continuous on both axes (required: Z then has a density). */
export function continuousNoise2(spec: Noise2Spec): boolean {
	return (
		spec.family === 'gauss2' || (!family(spec.x.family).discrete && !family(spec.y.family).discrete)
	);
}

/**
 * The distribution a valid spec describes. In the noise role the Gaussian's
 * means are held at 0 and each product marginal follows `makeDist`'s noise rule.
 */
export function makeDist2(spec: Spec2, role: Role): Dist2 {
	// Object.assign keeps the lazy `scale` getter, which a spread would evaluate.
	return Object.assign(build2(spec, role), { key: `${role}:${JSON.stringify(spec)}` });
}

function build2(spec: Spec2, role: Role): Omit<Dist2, 'key'> {
	switch (spec.family) {
		case 'gauss2':
			return gauss2(role === 'noise' ? [0, 0, ...spec.params.slice(2)] : spec.params);
		case 'product':
			return product(makeDist(spec.x, role), makeDist(spec.y, role));
		case 'mixture2':
			if (role === 'noise') throw new Error('Mixtures are signal-only');
			return mixture2(spec.components);
		case 'fringe2':
			if (role === 'noise') throw new Error('Fringe patterns are signal-only in 2D');
			return fringe2(spec.params);
	}
}

/** The marginal cell masses of a 2D estimate along x (axis 0) or y (axis 1), as a 1D estimate. */
export function marginal(est: GridEstimate2, axis: 0 | 1): { grid: Grid; mass: Float64Array } {
	const { grid: g, mass } = est;
	const out = new Float64Array(axis === 0 ? g.mx : g.my);
	for (let j = 0; j < g.my; j++)
		for (let i = 0; i < g.mx; i++) out[axis === 0 ? i : j] += mass[j * g.mx + i];
	return {
		grid: axis === 0 ? { x0: g.x0, h: g.hx, m: g.mx } : { x0: g.y0, h: g.hy, m: g.my },
		mass: out
	};
}
