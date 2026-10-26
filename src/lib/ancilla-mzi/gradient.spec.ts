import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { applyPreset, defaultSetup, noiseless, type PresetId } from './presets';
import type { RegisterNoise, Setup } from './types';
import { outer, rectApply } from './linalg';
import { buildAncilla } from './build';
import { qfiOfState, randomState } from './qfi';
import { seedParams } from './optimise';

function setupWith(
	nS: number,
	nA: number,
	preset: PresetId,
	noise: (n: RegisterNoise) => void
): Setup {
	const n = noiseless();
	noise(n);
	const s = applyPreset({ ...defaultSetup(), nS, nA, mziParticles: nS + nA }, preset);
	return { ...s, noise: { system: n, ancilla: structuredClone(n) } };
}

describe('adjoint gradient', () => {
	// [label, setup, Strang steps]; the pseudomode case has the largest space, so it uses fewer steps.
	const cases: [string, Setup, number][] = [
		['(1,1) active AD', setupWith(1, 1, 'active', (n) => void (n.markov.amplitudeDamping = 1)), 12],
		[
			'(2,1) active, mixed Markov noise, pulses on both',
			setupWith(2, 1, 'active+S', (n) => {
				n.markov.dephasing = 0.3;
				n.markov.transverse = 0.4;
				n.markov.depolarizing = 0.2;
			}),
			12
		],
		[
			'(1,1) Lorentzian dephasing d=3',
			setupWith(1, 1, 'active', (n) => {
				n.lorentzian = { kind: 'dephasing', gamma: 1, lambda: 5 };
			}),
			4
		]
	];
	for (const [label, s, steps] of cases) {
		it(`${label}: matches the hold and central differences`, () => {
			const p = buildAncilla(s, steps);
			const prng = new Prng(11);
			for (const seed of [0, 1]) {
				const params = seedParams(p, seed, prng);
				const psi = randomState(p.iso.cols, prng);
				const rho0 = outer(rectApply(p.iso, psi));
				const grad = new Float64Array(p.nParams);
				const q = p.objective(params, rho0, grad);
				expect(q).toBeCloseTo(qfiOfState(p.hold(params), p.iso, psi), 11);
				expect(p.objective(params, rho0)).toBeCloseTo(q, 12);
				let scaleG = 0;
				for (const k of p.free) scaleG = Math.max(scaleG, Math.abs(grad[k]));
				for (const k of p.free) {
					const h = 1e-5;
					const plus = Float64Array.from(params);
					const minus = Float64Array.from(params);
					plus[k] += h;
					minus[k] -= h;
					const fd = (p.objective(plus, rho0) - p.objective(minus, rho0)) / (2 * h);
					expect(Math.abs(grad[k] - fd)).toBeLessThan(1e-6 * Math.max(1, scaleG));
				}
			}
		});
	}
});
