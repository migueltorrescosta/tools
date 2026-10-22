import { describe, expect, it } from 'vitest';
import type { Scenarios } from '../types';
import { analyse } from './index';
import { qcut } from './groups';
import { profitSwing } from './swing';

/** Deterministic uniform [0, 1) (mulberry32). */
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal by Box–Muller. */
function normal(u: () => number) {
	return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
}

const sd = (x: Float64Array) => {
	const m = x.reduce((a, b) => a + b, 0) / x.length;
	return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
};

function swingOf(x: Float64Array, r: Float64Array) {
	const g = qcut(x, 10);
	return profitSwing(g.codes, g.count, r);
}

describe('profit swing', () => {
	it('is about zero for an input with no effect', () => {
		const u = rng(1);
		const z = normal(rng(2));
		const n = 50_000;
		const x = Float64Array.from({ length: n }, u);
		const y = Float64Array.from({ length: n }, u);
		const r = y.map((v) => 3 * v + 0.5 * z());
		const s = swingOf(x, r);
		expect(s.sd).toBeLessThan(0.02 * sd(r));
		expect(s.epsilon2).toBeLessThan(5e-4);
		// The input the reward depends on swings it by about 3·SD(Y).
		expect(swingOf(y, r).sd).toBeGreaterThan(0.8);
	});

	it('matches √Var(E[R | decile]) of a linear effect on a uniform input', () => {
		const u = rng(3);
		const z = normal(rng(4));
		const n = 200_000;
		const a = -4;
		const x = Float64Array.from({ length: n }, u);
		const r = x.map((v) => a * v + 2 * z());
		// Decile k of U(0, 1) has mean (k + ½)/10, so Var(E[R | decile]) = a²(K² − 1)/(12K²).
		const K = 10;
		const exact = Math.abs(a) * Math.sqrt((K * K - 1) / (12 * K * K));
		const s = swingOf(x, r);
		expect(s.sd).toBeCloseTo(exact, 1);
		expect(Math.abs(s.sd / exact - 1)).toBeLessThan(0.03);
		expect(s.epsilon2).toBeLessThan(s.eta2);
		expect(s.epsilon2).toBeCloseTo(s.sd ** 2 / sd(r) ** 2, 9);
	});

	it('bias-corrects a pure-noise estimate down to about zero', () => {
		const n = 2_000;
		let raw = 0;
		let corrected = 0;
		for (let seed = 0; seed < 20; seed++) {
			const u = rng(100 + seed);
			const x = Float64Array.from({ length: n }, u);
			const r = Float64Array.from({ length: n }, u);
			const s = swingOf(x, r);
			raw += Math.sqrt(s.eta2) * sd(r);
			corrected += s.sd;
		}
		// Without correction the group means' noise looks like a swing of √((K−1)/N)·SD ≈ 0.067·SD.
		expect(raw / 20).toBeGreaterThan(0.05 * Math.sqrt(1 / 12));
		expect(corrected / 20).toBeLessThan(0.4 * (raw / 20));
	});

	it('is zero for a constant reward or a single group', () => {
		expect(profitSwing(new Uint8Array(4), 1, Float64Array.of(1, 2, 3, 4))).toEqual({
			sd: 0,
			eta2: 0,
			epsilon2: 0
		});
		expect(profitSwing(Uint8Array.of(0, 1, 0, 1), 2, Float64Array.of(5, 5, 5, 5)).sd).toBe(0);
	});
});

describe('intermediates', () => {
	const u = rng(7);
	const n = 5_000;
	const a = Float64Array.from({ length: n }, u);
	const b = Float64Array.from({ length: n }, u);
	const s: Scenarios = {
		n,
		inputs: [
			{ symbol: 'a', column: a },
			{ symbol: 'b', column: b }
		],
		intermediates: [
			{ symbol: 'ab', column: a.map((v, i) => v * b[i]) },
			{ symbol: 'k', column: new Float64Array(n).fill(2) },
			{ symbol: 'inf', column: a.map((v) => (v < 0.5 ? 1 / 0 : v)) }
		],
		decisions: ['no', 'yes'],
		rewards: [new Float64Array(n), a.map((v, i) => v * b[i] - 0.2)],
		optimal: a.map((v, i) => Math.max(0, v * b[i] - 0.2))
	};
	const result = analyse(s, { unit: '€' });

	it('get groups, densities, profit swing and value of information like the inputs', () => {
		const m = result.intermediates;
		expect(m.groups).toHaveLength(3);
		expect(m.densities).toHaveLength(3);
		expect(m.profitSwing).toHaveLength(3);
		expect(m.valueOfInformation.savings).toHaveLength(3);
		expect(m.valueOfInformation.bins).toEqual(result.valueOfInformation.bins);
		expect(m.valueOfInformation.baseline).toBe(result.valueOfInformation.baseline);
		// The product decides the reward exactly: it is worth more than either input.
		const top = (v: typeof m.valueOfInformation) => v.savings[v.order[0]].at(-1)!;
		expect(m.valueOfInformation.order[0]).toBe(0);
		expect(top(m.valueOfInformation)).toBeGreaterThan(top(result.valueOfInformation));
		expect(m.groups[0].groups.at(-1)!.optimal).toBe(1);
		expect(m.groups[0].groups[0].optimal).toBe(0);
		// A constant intermediate is one group, worth nothing.
		expect(m.groups[1].groups).toHaveLength(1);
		expect(m.profitSwing[1].sd).toBe(0);
		expect(m.valueOfInformation.savings[1].every((v) => Math.abs(v) < 1e-12)).toBe(true);
	});

	it('profit swing uses the recommended decision', () => {
		expect(result.summary.best).toBe(1);
		// E[ab − 0.2 | a] = a/2 − 0.2: about half the swing of a uniform input, 0.5 · 0.287.
		for (const p of result.profitSwing) expect(Math.abs(p.sd / 0.1436 - 1)).toBeLessThan(0.1);
		expect(result.profitSwing[0]).toEqual(swingOf(a, s.rewards[1]));
	});
});
