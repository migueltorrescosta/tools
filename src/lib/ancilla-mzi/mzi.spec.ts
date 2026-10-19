import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/symbolic-regression/prng';
import { applyPreset, defaultSetup, noiseless } from './presets';
import type { RegisterNoise, Setup } from './types';
import { buildMzi } from './build';
import { qfiOfState } from './qfi';
import { vnorm } from './linalg';
import { computeMzi, oatState, standardStates } from './mzi';

function mziSetup(n: number, noise: (r: RegisterNoise) => void): Setup {
	const r = noiseless();
	noise(r);
	return {
		...applyPreset(defaultSetup(), 'passive-ent'),
		nS: n,
		nA: 0,
		mziParticles: n,
		noise: { system: r, ancilla: noiseless() }
	};
}

describe('standard states', () => {
	it('are normalised, and twin-Fock reaches N(N + 2)/2 without noise', () => {
		for (const n of [2, 4]) {
			const s = standardStates(n);
			for (const v of [s.product, s.noon, s.twinFock, oatState(n, 0.7, 1.1)])
				expect(vnorm(v)).toBeCloseTo(1, 12);
			const p = buildMzi(
				mziSetup(n, () => {}),
				24
			);
			expect(qfiOfState(p.hold(1), p.isoFull, s.twinFock)).toBeCloseTo((n * (n + 2)) / 2, 10);
			expect(qfiOfState(p.hold(1), p.isoFull, s.noon)).toBeCloseTo(n * n, 10);
		}
	});
});

describe('computeMzi', () => {
	it('reaches N² at the full window without noise', () => {
		const { result } = computeMzi(
			mziSetup(2, () => {}),
			{ steps: 24 },
			new Prng(1)
		);
		expect(result.qfiOpt).toBeCloseTo(4, 6);
		expect(result.qfiSym).toBeCloseTo(4, 6);
		expect(result.window).toBe(1);
		expect(result.bias).toBe(0);
		expect(result.standard.noon).toBeCloseTo(4, 10);
		expect(result.readouts.best).toBeGreaterThan(4 * (1 - 1e-4));
	});

	it('optimises the window of a dephased qubit: max t² e^{−2γt} at t = 1/γ', () => {
		const { result } = computeMzi(
			mziSetup(1, (r) => void (r.markov.dephasing = 2)),
			{ steps: 24 },
			new Prng(1)
		);
		expect(result.window).toBeCloseTo(0.5, 2);
		expect(result.qfiOpt).toBeCloseTo(Math.exp(-2) / 4, 6);
		expect(result.qfiFixedWindow).toBeCloseTo(Math.exp(-4), 8);
		expect(result.standard.product).toBeLessThanOrEqual(result.qfiOpt * (1 + 1e-9));
	});

	it('optimises a bias only under non-covariant noise, within its bound', () => {
		const setup = { ...mziSetup(1, (r) => void (r.markov.transverse = 2)), controlBound: 4 };
		const { result } = computeMzi(setup, { steps: 12 }, new Prng(1));
		expect(Math.abs(result.bias)).toBeLessThanOrEqual(4);
		const p = buildMzi(setup, 12);
		const plus = standardStates(1).product;
		expect(result.qfiOpt).toBeGreaterThanOrEqual(
			qfiOfState(p.hold(result.window, 0), p.isoFull, plus) - 1e-9
		);
		expect(result.qfiOpt).toBeCloseTo(
			Math.max(
				...[0, result.bias].map((b) => qfiOfState(p.hold(result.window, b), p.isoFull, plus))
			),
			3
		);
	});
});
