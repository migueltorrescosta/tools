import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { logGamma } from '$lib/variates';
import { family, FAMILIES, normalHalfWidth, validateParams } from './families';
import type { Family, FamilyId } from './types';

const SQRT_2PI = Math.sqrt(2 * Math.PI);

const N_INTEGRATE = 20000;
const N_SAMPLE = 50000;

function trapz(f: (x: number) => number, lo: number, hi: number, n = N_INTEGRATE): number {
	const h = (hi - lo) / n;
	let s = 0.5 * (f(lo) + f(hi));
	for (let i = 1; i < n; i++) s += f(lo + i * h);
	return s * h;
}

/** Heavy tails: integrate over the whole line with x = c + s·tan θ. */
const heavy = (f: Family) => f.id === 'cauchy' || f.id === 'studentT';

function integrate(f: Family, params: readonly number[], g: (x: number) => number): number {
	if (!heavy(f)) {
		const [lo, hi] = f.range(params, 1e-12);
		return trapz((x) => g(x) * f.pdf!(x, params), lo, hi);
	}
	const [a, b] = f.range(params, 0.5);
	const c = (a + b) / 2;
	const sc = (b - a) / 2;
	const n = 200000;
	const d = Math.PI / n;
	let sum = 0;
	// Midpoint rule: the transformed integrand need not vanish at ±π/2.
	for (let i = 0; i < n; i++) {
		const th = -Math.PI / 2 + (i + 0.5) * d;
		const x = c + sc * Math.tan(th);
		const jac = sc / Math.cos(th) ** 2;
		sum += g(x) * f.pdf!(x, params) * jac;
	}
	return sum * d;
}

const cache = new Map<
	string,
	{ mean: number; variance: number; cf: Map<number, [number, number]> }
>();

function cacheKey(f: Family, params: readonly number[]): string {
	return f.id + ':' + params.join(',');
}

function getNumericalMoments(
	f: Family,
	params: readonly number[]
): { mean: number; variance: number } {
	const key = cacheKey(f, params);
	if (cache.has(key)) return cache.get(key)!;
	if (f.discrete) {
		const atoms = f.atoms!(params, 1e-12);
		let m = 0;
		let m2 = 0;
		for (let i = 0; i < atoms.x.length; i++) {
			m += atoms.x[i] * atoms.p[i];
			m2 += atoms.x[i] * atoms.x[i] * atoms.p[i];
		}
		const res = { mean: m, variance: m2 - m * m };
		cache.set(key, { ...res, cf: new Map() });
		return res;
	}
	const m = integrate(f, params, (x) => x);
	const v = integrate(f, params, (x) => (x - m) ** 2);
	const res = { mean: m, variance: v };
	cache.set(key, { ...res, cf: new Map() });
	return res;
}

function numericalCf(f: Family, params: readonly number[], t: number): [number, number] {
	const key = cacheKey(f, params);
	const entry = cache.get(key) || { mean: 0, variance: 0, cf: new Map() };
	if (entry.cf.has(t)) return entry.cf.get(t)!;
	let re: number, im: number;
	if (f.discrete) {
		const atoms = f.atoms!(params, 1e-12);
		re = 0;
		im = 0;
		for (let i = 0; i < atoms.x.length; i++) {
			const c = Math.cos(t * atoms.x[i]);
			const sn = Math.sin(t * atoms.x[i]);
			re += atoms.p[i] * c;
			im += atoms.p[i] * sn;
		}
	} else {
		re = integrate(f, params, (x) => Math.cos(t * x));
		im = integrate(f, params, (x) => Math.sin(t * x));
	}
	entry.cf.set(t, [re, im]);
	if (!cache.has(key)) cache.set(key, entry);
	return [re, im];
}

function massInRange(f: Family, params: readonly number[], eps: number): number {
	const [lo, hi] = f.range(params, eps);
	if (f.discrete) {
		const atoms = f.atoms!(params, 1e-12);
		let mass = 0;
		for (let i = 0; i < atoms.x.length; i++)
			if (atoms.x[i] >= lo && atoms.x[i] <= hi) mass += atoms.p[i];
		return mass;
	}
	return trapz((x) => f.pdf!(x, params), lo, hi);
}

function samplerStats(
	f: Family,
	params: readonly number[],
	n = N_SAMPLE
): { mean: number; variance: number; median: number; q1: number; q3: number } {
	const sampler = f.sampler(params);
	const prng = new Prng(12345);
	const samples = new Float64Array(n);
	for (let i = 0; i < n; i++) samples[i] = sampler(prng);
	let mean = 0;
	for (const x of samples) mean += x;
	mean /= n;
	let variance = 0;
	for (const x of samples) variance += (x - mean) ** 2;
	variance /= n - 1;
	const sorted = [...samples].sort((a, b) => a - b);
	const median = sorted[Math.floor(n / 2)];
	const q1 = sorted[Math.floor(n / 4)];
	const q3 = sorted[Math.floor((3 * n) / 4)];
	return { mean, variance, median, q1, q3 };
}

function closeTo(a: number, b: number, rel = 1e-6): void {
	if (b === 0) {
		expect(Math.abs(a)).toBeLessThan(1e-12);
	} else {
		expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel);
	}
}

function cfClose(got: [number, number], expected: [number, number], abs = 1e-6): void {
	expect(Math.abs(got[0] - expected[0])).toBeLessThan(abs);
	expect(Math.abs(got[1] - expected[1])).toBeLessThan(abs);
}

describe('families', () => {
	const testSets: { id: FamilyId; default: readonly number[]; alt: readonly number[] }[] = [
		{ id: 'normal', default: [0, 1], alt: [2, 1.5] },
		{ id: 'laplace', default: [0, 1], alt: [-1, 0.7] },
		{ id: 'uniform', default: [0, 2], alt: [5, 3] },
		{ id: 'exponential', default: [1], alt: [2.5] },
		{ id: 'gamma', default: [2, 1], alt: [3, 0.5] },
		{ id: 'lognormal', default: [1, 0.5], alt: [2, 0.8] },
		{ id: 'studentT', default: [3, 0, 1], alt: [5, 1, 2] },
		{ id: 'cauchy', default: [0, 1], alt: [2, 0.5] },
		{ id: 'fringe', default: [0, 2, 3, 0.8, 0], alt: [1, 1.5, 2, 0.5, 0.5] },
		{ id: 'poisson', default: [3], alt: [8] },
		{ id: 'binomial', default: [10, 0.5], alt: [20, 0.3] },
		{ id: 'geometric', default: [0.3], alt: [0.7] }
	];

	for (const { id, default: defParams, alt } of testSets) {
		const f = family(id);

		describe(`${id} (default params)`, () => {
			testFamily(f, defParams);
		});

		describe(`${id} (alt params)`, () => {
			testFamily(f, alt);
		});
	}

	function testFamily(f: Family, params: readonly number[]) {
		it('pdf/atoms integrates/sums to 1', () => {
			const mass = f.discrete
				? f.atoms!(params, 1e-12).p.reduce((a, b) => a + b, 0)
				: integrate(f, params, () => 1);
			closeTo(mass, 1, 1e-6);
		});

		it('range holds at least 1 - eps mass', () => {
			const eps = 1e-3;
			const mass = massInRange(f, params, eps);
			expect(mass).toBeGreaterThanOrEqual(1 - eps - 1e-6);
		});

		it('range is no more than 3× the central interval holding 1 − eps', () => {
			const eps = 1e-3;
			const [lo, hi] = f.range(params, eps);
			// The central interval from 2·10⁵ seeded draws' eps/2 and 1 − eps/2 quantiles.
			const draw = f.sampler(params);
			const prng = new Prng(99);
			const xs = Float64Array.from({ length: 200000 }, () => draw(prng)).sort();
			const central =
				xs[Math.floor(xs.length * (1 - eps / 2))] - xs[Math.floor((xs.length * eps) / 2)];
			expect(hi - lo).toBeLessThanOrEqual(3 * central + 1e-9);
		});

		it('mean matches numerical', () => {
			const m = f.mean(params);
			if (m === undefined) {
				// For Cauchy and studentT ν ≤ 1, mean is undefined
				expect(m).toBeUndefined();
				return;
			}
			const { mean: num } = getNumericalMoments(f, params);
			closeTo(num, m, 1e-6);
		});

		it('variance matches numerical', () => {
			const v = f.variance(params);
			if (v === undefined) {
				// For Cauchy and studentT ν ≤ 2, variance is undefined
				expect(v).toBeUndefined();
				return;
			}
			const { variance: num } = getNumericalMoments(f, params);
			closeTo(num, v, 1e-6);
		});

		it('cf matches numerical at t = 0, 0.3, 1, 2.5', () => {
			const ts = [0, 0.3, 1, 2.5];
			for (const t of ts) {
				const got = f.cf(t, params);
				// Cauchy's integrand oscillates without decaying under the substitution, so
				// check it against Student t with ν = 1 (the same law, through Bessel K) instead.
				const expected =
					f.id === 'cauchy'
						? family('studentT').cf(t, [1, params[0], params[1]])
						: numericalCf(f, params, t);
				cfClose(got, expected, heavy(f) ? 1e-4 : 1e-5);
			}
		});

		it('sampler mean and variance match', () => {
			const m = f.mean(params);
			const v = f.variance(params);
			const { mean: sampMean, variance: sampVar, median, q1, q3 } = samplerStats(f, params);
			if (m !== undefined) {
				const se = Math.sqrt(v! / N_SAMPLE);
				expect(Math.abs(sampMean - m)).toBeLessThan(4 * se);
			}
			// The variance's standard error needs a finite fourth moment (Student t: ν > 4).
			if (v !== undefined && !(f.id === 'studentT' && params[0] <= 4)) {
				const seVar = v * Math.sqrt(2 / N_SAMPLE);
				expect(Math.abs(sampVar - v)).toBeLessThan(4 * seVar);
			}
			if (f.id === 'cauchy') {
				const theoreticalMedian = params[0];
				const theoreticalQ1 = params[0] - params[1];
				const theoreticalQ3 = params[0] + params[1];
				// With 50000 samples, quartile estimates have ~0.005 standard error
				expect(Math.abs(median - theoreticalMedian)).toBeLessThan(0.015);
				expect(Math.abs(q1 - theoreticalQ1)).toBeLessThan(0.025);
				expect(Math.abs(q3 - theoreticalQ3)).toBeLessThan(0.025);
			}
		});
	}

	describe('validateParams', () => {
		it('uniform rejects non-positive width', () => {
			expect(validateParams('uniform', [0, 0])).toEqual([
				{ index: 1, message: 'width must be positive.' }
			]);
			expect(validateParams('uniform', [0, -1])).toEqual([
				{ index: 1, message: 'width must be positive.' }
			]);
		});

		it('exponential rejects non-positive mean', () => {
			expect(validateParams('exponential', [0])).toEqual([
				{ index: 0, message: 'mean must be positive.' }
			]);
			expect(validateParams('exponential', [-1])).toEqual([
				{ index: 0, message: 'mean must be positive.' }
			]);
		});

		it('gamma rejects non-positive shape/scale', () => {
			expect(validateParams('gamma', [0, 1])).toEqual([
				{ index: 0, message: 'k must be positive.' }
			]);
			expect(validateParams('gamma', [1, 0])).toEqual([
				{ index: 1, message: 'θ must be positive.' }
			]);
		});

		it('lognormal rejects non-positive median/sigma', () => {
			expect(validateParams('lognormal', [0, 0.5])).toEqual([
				{ index: 0, message: 'median must be positive.' }
			]);
			expect(validateParams('lognormal', [1, 0])).toEqual([
				{ index: 1, message: 'σ must be positive.' }
			]);
		});

		it('studentT rejects non-positive nu/scale', () => {
			expect(validateParams('studentT', [0, 0, 1])).toEqual([
				{ index: 0, message: 'ν must be positive.' }
			]);
			expect(validateParams('studentT', [3, 0, 0])).toEqual([
				{ index: 2, message: 's must be positive.' }
			]);
		});

		it('cauchy rejects non-positive gamma', () => {
			expect(validateParams('cauchy', [0, 0])).toEqual([
				{ index: 1, message: 'γ must be positive.' }
			]);
		});

		it('fringe rejects invalid V', () => {
			expect(validateParams('fringe', [0, 2, 3, -0.1, 0])).toEqual([
				{ index: 3, message: 'visibility V must lie between 0 and 1.' }
			]);
			expect(validateParams('fringe', [0, 2, 3, 1.1, 0])).toEqual([
				{ index: 3, message: 'visibility V must lie between 0 and 1.' }
			]);
		});

		it('fringe rejects zero mass', () => {
			// C = 1 + V*cos(phi)*exp(-k^2*w^2/2). With V=1, phi=pi, cos(phi)=-1.
			// Need k*w small enough that exp(-k^2*w^2/2) ≈ 1, so C ≈ 0.
			const err = validateParams('fringe', [0, 1, 0.001, 1, Math.PI]);
			expect(err.length).toBe(1);
			expect(err[0].index).toBe(3);
			expect(err[0].message).toBe('This visibility and phase leave no probability mass.');
		});

		it('poisson rejects lambda > 1e6', () => {
			expect(validateParams('poisson', [1e6 + 1])).toEqual([
				{ index: 0, message: 'λ must be at most 10⁶.' }
			]);
		});

		it('binomial rejects non-integer n', () => {
			expect(validateParams('binomial', [10.5, 0.5])).toEqual([
				{ index: 0, message: 'n must be a whole number from 0 to 10⁶.' }
			]);
			expect(validateParams('binomial', [-1, 0.5])).toEqual([
				{ index: 0, message: 'n must be a whole number from 0 to 10⁶.' }
			]);
		});

		it('binomial rejects p outside (0,1)', () => {
			expect(validateParams('binomial', [10, 0])).toEqual([
				{ index: 1, message: 'p must lie strictly between 0 and 1.' }
			]);
			expect(validateParams('binomial', [10, 1])).toEqual([
				{ index: 1, message: 'p must lie strictly between 0 and 1.' }
			]);
		});

		it('geometric rejects p outside (0,1)', () => {
			expect(validateParams('geometric', [0])).toEqual([
				{ index: 0, message: 'p must lie strictly between 0 and 1.' }
			]);
			expect(validateParams('geometric', [1])).toEqual([
				{ index: 0, message: 'p must lie strictly between 0 and 1.' }
			]);
		});
	});

	describe('cf at large |t| for Cauchy and studentT ν ≤ 2', () => {
		it('Cauchy cf matches closed form at large t', () => {
			const f = family('cauchy');
			const params = [2, 0.5];
			for (const t of [10, 50, 100]) {
				const got = f.cf(t, params);
				const expected: [number, number] = [
					Math.exp(-params[1] * t) * Math.cos(params[0] * t),
					Math.exp(-params[1] * t) * Math.sin(params[0] * t)
				];
				cfClose(got, expected, 1e-10);
			}
		});

		it('studentT ν=1 cf matches Cauchy at large t', () => {
			const f = family('studentT');
			const params = [1, 2, 0.5];
			for (const t of [10, 50, 100]) {
				const got = f.cf(t, params);
				const expected: [number, number] = [
					Math.exp(-params[2] * t) * Math.cos(params[1] * t),
					Math.exp(-params[2] * t) * Math.sin(params[1] * t)
				];
				cfClose(got, expected, 1e-6);
			}
		});
	});
});

describe('helpers', () => {
	it('normalHalfWidth', () => {
		// normalHalfWidth is a conservative bound (Mills ratio approximation), not the exact z-score
		expect(normalHalfWidth(0.05)).toBeCloseTo(Math.sqrt(-2 * Math.log(0.025)), 10);
		expect(normalHalfWidth(0.3173)).toBeCloseTo(Math.sqrt(-2 * Math.log(0.3173 / 2)), 10);
		// Check it's wider than the exact z-score
		expect(normalHalfWidth(0.05)).toBeGreaterThan(1.96);
		expect(normalHalfWidth(0.3173)).toBeGreaterThan(1);
	});
});
