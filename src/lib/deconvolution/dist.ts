/**
 * Builds a `Dist` from a `DistSpec`. In the noise role a family's location
 * parameter is held at 0, and a continuous noise without one (exponential,
 * gamma, lognormal, an asymmetric fringe) is shifted to mean 0, so the
 * location of Z is carried by X alone. Discrete noise keeps its natural
 * support (Poisson from 0). No DOM or Svelte imports.
 */
import {
	ATOM_EPS,
	type Atoms,
	type Dist,
	type DistSpec,
	type Role,
	type SimpleSpec
} from './types';
import { family } from './families';

const NO_ATOMS: Atoms = { x: new Float64Array(0), p: new Float64Array(0) };

/** True when every component of the spec is discrete. */
export function isDiscreteSpec(spec: DistSpec): boolean {
	return spec.family === 'mixture'
		? spec.components.every((c) => family(c.family).discrete)
		: family(spec.family).discrete;
}

function simple({ family: id, params }: SimpleSpec): Dist {
	const f = family(id);
	const ps = [...params];
	return {
		pdf: f.pdf ? (x) => f.pdf!(x, ps) : null,
		atoms: f.atoms ? f.atoms(ps, ATOM_EPS) : NO_ATOMS,
		cf: (t) => f.cf(t, ps),
		range: (eps) => f.range(ps, eps),
		mean: f.mean(ps),
		variance: f.variance(ps),
		sampler: f.sampler(ps)
	};
}

/** `d` moved right by `s`. */
export function shift(d: Dist, s: number): Dist {
	if (s === 0) return d;
	const pdf = d.pdf;
	return {
		pdf: pdf ? (x) => pdf(x - s) : null,
		atoms: { x: d.atoms.x.map((x) => x + s), p: d.atoms.p },
		cf: (t) => {
			const [re, im] = d.cf(t);
			const c = Math.cos(s * t);
			const sn = Math.sin(s * t);
			return [re * c - im * sn, re * sn + im * c];
		},
		range: (eps) => {
			const [lo, hi] = d.range(eps);
			return [lo + s, hi + s];
		},
		mean: d.mean === undefined ? undefined : d.mean + s,
		variance: d.variance,
		sampler: (prng) => d.sampler(prng) + s
	};
}

/** Merge sorted atom lists, adding masses at equal positions. */
function mergeAtoms(parts: { atoms: Atoms; weight: number }[]): Atoms {
	const map = new Map<number, number>();
	for (const { atoms, weight } of parts) {
		for (let i = 0; i < atoms.x.length; i++) {
			map.set(atoms.x[i], (map.get(atoms.x[i]) ?? 0) + weight * atoms.p[i]);
		}
	}
	const xs = [...map.keys()].sort((a, b) => a - b);
	return { x: Float64Array.from(xs), p: Float64Array.from(xs, (x) => map.get(x)!) };
}

/** Var = Σ wᵢ(σᵢ² + μᵢ²) − μ²; undefined when any component lacks a variance. */
function mixtureVariance(parts: { weight: number; dist: Dist }[]): number | undefined {
	if (parts.some((p) => p.dist.mean === undefined || p.dist.variance === undefined))
		return undefined;
	const mean = parts.reduce((s, p) => s + p.weight * p.dist.mean!, 0);
	const second = parts.reduce((s, p) => s + p.weight * (p.dist.variance! + p.dist.mean! ** 2), 0);
	return second - mean * mean;
}

function mixture(components: { weight: number; dist: Dist }[]): Dist {
	const total = components.reduce((s, c) => s + c.weight, 0);
	const parts = components.map((c) => ({ weight: c.weight / total, dist: c.dist }));
	const continuous = parts.every((p) => p.dist.pdf !== null);
	const means = parts.map((p) => p.dist.mean);
	return {
		pdf: continuous ? (x) => parts.reduce((s, p) => s + p.weight * p.dist.pdf!(x), 0) : null,
		atoms: continuous
			? NO_ATOMS
			: mergeAtoms(parts.map((p) => ({ atoms: p.dist.atoms, weight: p.weight }))),
		cf: (t) => {
			let re = 0;
			let im = 0;
			for (const p of parts) {
				const [r, i] = p.dist.cf(t);
				re += p.weight * r;
				im += p.weight * i;
			}
			return [re, im];
		},
		range: (eps) => {
			let lo = Infinity;
			let hi = -Infinity;
			for (const p of parts) {
				const [a, b] = p.dist.range(eps);
				lo = Math.min(lo, a);
				hi = Math.max(hi, b);
			}
			return [lo, hi];
		},
		mean: means.every((m) => m !== undefined)
			? parts.reduce((s, p, i) => s + p.weight * means[i]!, 0)
			: undefined,
		variance: mixtureVariance(parts.map((p) => ({ weight: p.weight, dist: p.dist }))),
		sampler: (prng) => {
			let u = prng.next();
			for (const p of parts) {
				if (u < p.weight) return p.dist.sampler(prng);
				u -= p.weight;
			}
			return parts[parts.length - 1].dist.sampler(prng);
		}
	};
}

/** The distribution a valid spec describes, in the given role (see the module comment). */
export function makeDist(spec: DistSpec, role: Role): Dist {
	if (spec.family === 'mixture') {
		if (role === 'noise') throw new Error('Mixtures are signal-only');
		const kinds = new Set(spec.components.map((c) => family(c.family).discrete));
		if (kinds.size !== 1) throw new Error('Mix only continuous or only discrete families');
		return mixture(spec.components.map((c) => ({ weight: c.weight, dist: simple(c) })));
	}
	if (role === 'signal') return simple(spec);
	const f = family(spec.family);
	const params = [...spec.params];
	if (f.location !== undefined) params[f.location] = 0;
	const d = simple({ family: spec.family, params });
	return f.discrete || d.mean === undefined ? d : shift(d, -d.mean);
}
