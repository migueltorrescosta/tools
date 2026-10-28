import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import {
	FAMILIES,
	defaultParams,
	familyInfo,
	fill,
	isFamily,
	isFixed,
	mean,
	validateParams,
	variance
} from './distributions';
import { logGamma } from '$lib/variates';
import type { Family } from './types';

const N = 200_000;

function draws(family: Family, params: number[], n = N, seed = 7): Float64Array {
	const out = new Float64Array(n);
	fill(family, params, new Prng(seed), out);
	return out;
}

function moments(xs: Float64Array) {
	let s = 0;
	for (const x of xs) s += x;
	const m = s / xs.length;
	let s2 = 0;
	let s4 = 0;
	for (const x of xs) {
		const d = (x - m) * (x - m);
		s2 += d;
		s4 += d * d;
	}
	const v = s2 / (xs.length - 1);
	return { mean: m, variance: v, m4: s4 / xs.length };
}

/** Sample mean and variance within 5 standard errors of the closed forms. */
function expectMoments(family: Family, params: number[]) {
	const xs = draws(family, params);
	const got = moments(xs);
	const mu = mean(family, params);
	const v = variance(family, params);
	expect(Math.abs(got.mean - mu)).toBeLessThanOrEqual(5 * Math.sqrt(v / xs.length) + 1e-12);
	// SE of the sample variance ≈ sqrt((m4 − σ⁴) / n)
	const seVar = Math.sqrt(Math.max(got.m4 - got.variance ** 2, 0) / xs.length);
	expect(Math.abs(got.variance - v)).toBeLessThanOrEqual(5 * seVar + 1e-12);
}

const logChoose = (n: number, k: number) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
const binomialPmf = (n: number, p: number, k: number) =>
	Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
const poissonPmf = (lambda: number, k: number) =>
	Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));

/** Frequency of each listed value within 5 binomial standard errors of its pmf. */
function expectPmf(xs: Float64Array, pmf: (k: number) => number, ks: number[]) {
	const counts = new Map<number, number>();
	for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
	for (const k of ks) {
		const p = pmf(k);
		const freq = (counts.get(k) ?? 0) / xs.length;
		expect(Math.abs(freq - p)).toBeLessThanOrEqual(5 * Math.sqrt((p * (1 - p)) / xs.length));
	}
}

/** Pearson chi-square over cells with expected count ≥ 20 (tails pooled), below a loose bound. */
function expectChiSquare(xs: Float64Array, pmf: (k: number) => number, lo: number, hi: number) {
	const counts = new Map<number, number>();
	for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
	let chi = 0;
	let cells = 0;
	let restObserved = xs.length;
	let restExpected = xs.length;
	for (let k = lo; k <= hi; k++) {
		const e = pmf(k) * xs.length;
		if (e < 20) continue;
		const o = counts.get(k) ?? 0;
		chi += ((o - e) * (o - e)) / e;
		cells++;
		restObserved -= o;
		restExpected -= e;
	}
	if (restExpected >= 20) {
		chi += (restObserved - restExpected) ** 2 / restExpected;
		cells++;
	}
	// df = cells − 1; mean df, sd √(2 df): allow 6 sd
	const df = cells - 1;
	expect(cells).toBeGreaterThan(5);
	expect(chi).toBeLessThan(df + 6 * Math.sqrt(2 * df));
}

describe('logGamma', () => {
	it('matches factorials and Γ(1/2)', () => {
		let f = 0;
		for (let k = 1; k <= 30; k++) {
			f += Math.log(k);
			expect(logGamma(k + 1)).toBeCloseTo(f, 11);
		}
		expect(logGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 13);
		expect(logGamma(1)).toBeCloseTo(0, 13);
	});
});

describe('family metadata', () => {
	it('lists every family with defaults that validate', () => {
		expect(FAMILIES.map((f) => f.family)).toEqual([
			'normal',
			'lognormal',
			'uniform',
			'exponential',
			'triangular',
			'binomial',
			'poisson',
			'beta',
			'fixed'
		]);
		for (const f of FAMILIES) {
			expect(validateParams(f.family, defaultParams(f.family))).toEqual([]);
			expect(isFamily(f.family)).toBe(true);
		}
		expect(familyInfo('normal').params.map((p) => p.label)).toEqual(['μ', 'σ']);
		expect(familyInfo('triangular').params.map((p) => p.label)).toEqual(['low', 'mode', 'high']);
		expect(isFamily('gamma')).toBe(false);
		expect(isFamily('__proto__')).toBe(false);
	});
});

describe('validateParams', () => {
	const errs = (family: Family, params: number[]) => validateParams(family, params);

	it('flags the offending parameter with a message', () => {
		expect(errs('normal', [0, 0])).toEqual([{ index: 1, message: 'σ must be positive.' }]);
		expect(errs('lognormal', [-1, 0.2])[0].index).toBe(0);
		expect(errs('uniform', [2, 2])).toEqual([{ index: 1, message: 'high must be above low.' }]);
		expect(errs('exponential', [0])[0].message).toBe('The mean must be positive.');
		expect(errs('triangular', [0, 2, 1])).toEqual([
			{ index: 1, message: 'mode must lie between low and high.' }
		]);
		expect(errs('triangular', [1, 1, 1])[0].index).toBe(2);
		expect(errs('triangular', [0, 0, 1])).toEqual([]);
		expect(errs('binomial', [10.5, 0.5])[0].index).toBe(0);
		expect(errs('binomial', [2e9, 0.5])[0].index).toBe(0);
		expect(errs('binomial', [-1, 0.5])[0].index).toBe(0);
		expect(errs('binomial', [0, 0])).toEqual([]);
		expect(errs('binomial', [10, 1.1])).toEqual([
			{ index: 1, message: 'p must lie between 0 and 1.' }
		]);
		expect(errs('poisson', [0])[0].index).toBe(0);
		expect(errs('poisson', [2e9])[0].index).toBe(0);
		expect(errs('beta', [1, 0]).map((e) => e.index)).toEqual([1]);
		expect(errs('beta', [-1, -1]).map((e) => e.index)).toEqual([0, 1]);
		expect(errs('fixed', [-1e300])).toEqual([]);
		expect(errs('fixed', [NaN])).toEqual([{ index: 0, message: 'Enter a finite number.' }]);
	});

	it('rejects non-finite values and the wrong parameter count', () => {
		expect(errs('normal', [NaN, Infinity]).map((e) => e.index)).toEqual([0, 1]);
		expect(errs('normal', [0])).toEqual([{ index: -1, message: 'Normal takes 2 parameters.' }]);
	});
});

describe('samplers match closed-form moments', () => {
	const cases: [Family, number[]][] = [
		['normal', [3, 2]],
		['lognormal', [1.4, 0.35]],
		['lognormal', [3.5e8, 0.2]],
		['uniform', [50, 500]],
		['exponential', [3]],
		['triangular', [0, 2, 10]],
		['triangular', [0, 0, 1]],
		['beta', [2, 5]],
		['beta', [0.3, 0.7]],
		['beta', [0.05, 3]],
		['binomial', [20, 0.1]],
		['binomial', [1000, 0.3]],
		['binomial', [1000, 0.9]],
		['binomial', [1e7, 0.001]],
		['binomial', [1e9, 0.5]],
		['poisson', [0.5]],
		['poisson', [7]],
		['poisson', [40]],
		['poisson', [1e4]],
		['poisson', [1e9]]
	];
	for (const [family, params] of cases) {
		it(`${family}(${params.join(', ')})`, () => expectMoments(family, params));
	}

	it('stays in each support', () => {
		expect(draws('uniform', [1, 2]).every((x) => x >= 1 && x < 2)).toBe(true);
		expect(draws('exponential', [1]).every((x) => x >= 0 && Number.isFinite(x))).toBe(true);
		expect(draws('triangular', [-1, 0, 1]).every((x) => x >= -1 && x <= 1)).toBe(true);
		expect(draws('beta', [0.05, 0.05]).every((x) => x >= 0 && x <= 1)).toBe(true);
		const b = draws('binomial', [50, 0.7]);
		expect(b.every((x) => Number.isInteger(x) && x >= 0 && x <= 50)).toBe(true);
		const p = draws('poisson', [30]);
		expect(p.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
	});
});

describe('binomial and Poisson probability mass', () => {
	it('binomial inversion regime', () => {
		const xs = draws('binomial', [40, 0.1]);
		expectPmf(xs, (k) => binomialPmf(40, 0.1, k), [0, 1, 4, 8]);
		expectChiSquare(xs, (k) => binomialPmf(40, 0.1, k), 0, 40);
	});

	it('binomial BTRS regime (the distribution-centre input)', () => {
		const xs = draws('binomial', [1e7, 0.001]);
		const pmf = (k: number) => binomialPmf(1e7, 0.001, k);
		expectPmf(xs, pmf, [9900, 10000, 10050, 10200]);
		expectChiSquare(xs, pmf, 9500, 10500);
	});

	it('binomial with p above one half uses symmetry', () => {
		const xs = draws('binomial', [200, 0.8]);
		expectChiSquare(xs, (k) => binomialPmf(200, 0.8, k), 0, 200);
	});

	it('binomial edge cases', () => {
		expect(draws('binomial', [0, 0.3], 100).every((x) => x === 0)).toBe(true);
		expect(draws('binomial', [17, 0], 100).every((x) => x === 0)).toBe(true);
		expect(draws('binomial', [17, 1], 100).every((x) => x === 17)).toBe(true);
	});

	it('Poisson inversion regime', () => {
		const xs = draws('poisson', [3.5]);
		expectPmf(xs, (k) => poissonPmf(3.5, k), [0, 2, 3, 7]);
		expectChiSquare(xs, (k) => poissonPmf(3.5, k), 0, 40);
	});

	it('Poisson PTRS regime', () => {
		const xs = draws('poisson', [1e4]);
		const pmf = (k: number) => poissonPmf(1e4, k);
		expectPmf(xs, pmf, [9900, 10000, 10100]);
		expectChiSquare(xs, pmf, 9500, 10500);
		const ys = draws('poisson', [12]);
		expectChiSquare(ys, (k) => poissonPmf(12, k), 0, 60);
	});
});

describe('fill', () => {
	it('fills a fixed input with its value: mean = value, variance 0', () => {
		expect(draws('fixed', [950], 50).every((x) => x === 950)).toBe(true);
		expect(mean('fixed', [950])).toBe(950);
		expect(variance('fixed', [950])).toBe(0);
		expect(isFixed({ family: 'fixed' })).toBe(true);
		expect(isFixed({ family: 'normal' })).toBe(false);
	});

	it('reproduces a fixed seed and differs across seeds', () => {
		for (const f of FAMILIES.filter((f) => f.family !== 'fixed')) {
			const a = draws(f.family, defaultParams(f.family), 1000, 2026);
			const b = draws(f.family, defaultParams(f.family), 1000, 2026);
			const c = draws(f.family, defaultParams(f.family), 1000, 2027);
			expect(a).toEqual(b);
			expect(a).not.toEqual(c);
		}
	});

	it('writes only the requested range', () => {
		const out = new Float64Array(10).fill(-1);
		fill('uniform', [0, 1], new Prng(1), out, 3, 6);
		expect([...out.slice(0, 3), ...out.slice(6)].every((x) => x === -1)).toBe(true);
		expect([...out.slice(3, 6)].every((x) => x >= 0 && x < 1)).toBe(true);
	});

	it('draws 1M binomial(1e7, 0.001) and Poisson(1e4) with the right mean and variance', () => {
		const out = new Float64Array(1_000_000);
		const moments = () => {
			let sum = 0;
			let sumSq = 0;
			let allCounts = true;
			for (const x of out) {
				if (!Number.isInteger(x) || x < 0) allCounts = false;
				sum += x;
				sumSq += x * x;
			}
			const mean = sum / out.length;
			return { allCounts, mean, variance: sumSq / out.length - mean * mean };
		};

		// binomial(1e7, 0.001): mean = 1e4, var = 1e4 * (1 - 0.001) = 9990
		fill('binomial', [1e7, 0.001], new Prng(1), out);
		const b = moments();
		expect(b.allCounts).toBe(true);
		expect(Math.abs(b.mean - 1e4)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(b.variance - 9990)).toBeLessThanOrEqual(9990 * 0.03);

		// Poisson(1e4): mean = 1e4, var = 1e4
		fill('poisson', [1e4], new Prng(1), out);
		const p = moments();
		expect(p.allCounts).toBe(true);
		expect(Math.abs(p.mean - 1e4)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(p.variance - 1e4)).toBeLessThanOrEqual(1e4 * 0.03);
	}, 20_000);
});
