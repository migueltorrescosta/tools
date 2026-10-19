import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/symbolic-regression/prng';
import { applyPreset, defaultSetup, DEFAULT_BUDGET, noiseless } from './presets';
import type { Setup } from './types';
import { buildAncilla } from './build';
import { qfiOfState } from './qfi';
import { finaliseBest, lbfgsb, optimiseSeed, seedParams, toSeedResult } from './optimise';
import { seminormBound } from './metrics';

const rosen = (x: Float64Array) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
const rosenGrad = (x: Float64Array, g: Float64Array) => {
	g[0] = -400 * x[0] * (x[1] - x[0] ** 2) - 2 * (1 - x[0]);
	g[1] = 200 * (x[1] - x[0] ** 2);
	return rosen(x);
};

describe('lbfgsb', () => {
	it('minimises Rosenbrock with finite differences and with exact gradients', () => {
		const fd = lbfgsb(rosen, [-1.2, 1], [-2, -2], [2, 2], { maxIter: 200 });
		expect(fd.x[0]).toBeCloseTo(1, 3);
		expect(fd.x[1]).toBeCloseTo(1, 3);
		const ex = lbfgsb(rosen, [-1.2, 1], [-2, -2], [2, 2], { maxIter: 200, fg: rosenGrad });
		expect(ex.x[0]).toBeCloseTo(1, 4);
		expect(ex.evaluations).toBeLessThan(fd.evaluations);
	});

	it('stops at an active bound', () => {
		const f = (x: Float64Array) => (x[0] - 3) ** 2 + (x[1] + 1) ** 2;
		const r = lbfgsb(f, [0, 0], [-1, -2], [2, 2], { maxIter: 50 });
		expect(r.x[0]).toBe(2);
		expect(r.x[1]).toBeCloseTo(-1, 5);
		expect(r.f).toBeCloseTo(1, 8);
	});

	it('counts evaluations and reports the best value so far', () => {
		const seen: [number, number][] = [];
		const r = lbfgsb(rosen, [0, 0], [-2, -2], [2, 2], {
			maxIter: 5,
			onEval: (n, best) => seen.push([n, best])
		});
		expect(seen.length).toBe(r.evaluations);
		expect(r.iterations).toBeLessThanOrEqual(5);
		for (let i = 1; i < seen.length; i++) {
			expect(seen[i][0]).toBe(i + 1);
			expect(seen[i][1]).toBeLessThanOrEqual(seen[i - 1][1]);
		}
	});
});

function adSetup(): Setup {
	const n = noiseless();
	n.markov.amplitudeDamping = 1;
	return applyPreset(
		{ ...defaultSetup(), noise: { system: n, ancilla: structuredClone(n) } },
		'active'
	);
}

describe('seedParams', () => {
	it('starts seed 0 with every control off and later seeds on the free entries within bounds', () => {
		const p = buildAncilla({ ...adSetup(), controlBound: 0.5 }, 12);
		expect(seedParams(p, 0, new Prng(1)).every((x) => x === 0)).toBe(true);
		const q = seedParams(p, 3, new Prng(1));
		for (let k = 0; k < p.nParams; k++) {
			if (!p.free.includes(k)) expect(q[k]).toBe(0);
			expect(Math.abs(q[k])).toBeLessThanOrEqual(p.bound[k]);
		}
		expect(q.some((x) => Math.abs(x) === 0.5)).toBe(true);
	});
});

describe('optimiseSeed and finaliseBest', () => {
	const budget = { ...DEFAULT_BUDGET, steps: 8, rounds: 2, maxIter: 10, seesawIter: 30 };

	it('improves on the uncontrolled see-saw and stays below the seminorm bound', () => {
		const setup = adSetup();
		const p = buildAncilla(setup, budget.steps);
		const prng = new Prng(4);
		const trace: [number, number][] = [];
		const o = optimiseSeed(p, seedParams(p, 0, prng), prng, budget, (n, q) => trace.push([n, q]));
		const plain = optimiseSeed(p, new Float64Array(p.nParams), new Prng(4), {
			...budget,
			rounds: 0
		});
		expect(o.qfi).toBeGreaterThan(plain.qfi);
		expect(o.qfi).toBeLessThan(seminormBound(setup));
		expect(qfiOfState(p.hold(o.params), p.iso, o.psi)).toBeCloseTo(o.qfi, 10);
		expect(trace.at(-1)?.[1]).toBeCloseTo(o.qfi, 12);
		for (let i = 1; i < trace.length; i++)
			expect(trace[i][1]).toBeGreaterThanOrEqual(trace[i - 1][1]);
		const fd = optimiseSeed(
			p,
			seedParams(p, 0, new Prng(4)),
			new Prng(4),
			budget,
			undefined,
			'forward'
		);
		expect(fd.qfi).toBeGreaterThan(plain.qfi);
	});

	it('returns the uncontrolled optimum when nothing is free, and finalises', () => {
		const setup = applyPreset(adSetup(), 'passive-ent');
		const p = buildAncilla(setup, budget.steps);
		expect(p.free.length).toBe(0);
		const o = optimiseSeed(p, new Float64Array(p.nParams), new Prng(2), budget);
		const best = finaliseBest(p, toSeedResult('setup', 0, o), new Prng(3));
		expect(best.qfi).toBeGreaterThanOrEqual(o.qfi);
		expect(best.qfiFine).toBe(best.qfi);
		expect(best.saturated.every((s) => !s)).toBe(true);
		expect(best.readouts?.best).toBeLessThanOrEqual(best.qfi * (1 + 1e-6));
	});

	it('flags controls at their bounds and re-evaluates at 2M steps', () => {
		const setup = { ...adSetup(), controlBound: 0.2 };
		const p = buildAncilla(setup, budget.steps);
		const prng = new Prng(8);
		const o = optimiseSeed(p, seedParams(p, 1, prng), prng, budget);
		const best = finaliseBest(p, toSeedResult('setup', 1, o), new Prng(1), { polishMs: 200 });
		const atBound = Array.from(
			o.params,
			(x, k) => p.bound[k] > 0 && Math.abs(x) >= p.bound[k] * 0.999
		);
		expect(best.saturated).toEqual(atBound);
		expect(best.saturated.some(Boolean)).toBe(true);
		expect(Math.abs((best.qfiFine as number) - best.qfi) / best.qfi).toBeLessThan(0.02);
		expect(best.readouts?.best).toBeLessThanOrEqual((best.qfiFine as number) * (1 + 1e-6));
	});
});
