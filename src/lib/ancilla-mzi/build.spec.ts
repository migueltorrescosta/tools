import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { applyPreset, defaultSetup, noiseless, type PresetId } from './presets';
import { freeControls, type RegisterNoise, type Setup } from './types';
import { outer, rectApply } from './linalg';
import { buildAncilla, buildMzi, hasCompanion, pulseBoundary, su2 } from './build';
import { qfiOfState, randomState } from './qfi';
import { dist } from './test-helpers';
import { expm, scale } from './linalg';
import { spinHalf } from './register';

function setupWith(
	nS: number,
	nA: number,
	preset: PresetId,
	noise: (n: RegisterNoise) => void,
	extra: Partial<Setup> = {}
): Setup {
	const n = noiseless();
	noise(n);
	const s = applyPreset({ ...defaultSetup(), nS, nA, mziParticles: nS + nA }, preset);
	return { ...s, noise: { system: n, ancilla: structuredClone(n) }, ...extra };
}

describe('su2 and pulse boundaries', () => {
	it('su2(u) is exp(−i u · σ/2)', () => {
		const u = [0.3, -1.2, 2.1];
		const h = scale(spinHalf('x'), u[0]);
		for (const [k, a] of [
			[1, 'y'],
			[2, 'z']
		] as const) {
			const s = spinHalf(a);
			for (let i = 0; i < 4; i++) {
				h.re[i] += u[k] * s.re[i];
				h.im[i] += u[k] * s.im[i];
			}
		}
		expect(dist(su2(u), expm(scale(h, 0, -1)))).toBeLessThan(1e-14);
	});

	it('snaps pulse times to boundaries in [1, M − 1]', () => {
		expect(pulseBoundary(1 / 3, 1, 24)).toBe(8);
		expect(pulseBoundary(2 / 3, 1, 48)).toBe(32);
		expect(pulseBoundary(0.001, 1, 24)).toBe(1);
		expect(pulseBoundary(0.999, 1, 24)).toBe(23);
		expect(pulseBoundary(1, 2, 24)).toBe(12);
	});
});

describe('buildAncilla', () => {
	it('frees the masked controls only, with their bounds', () => {
		const s = setupWith(1, 1, 'active', (n) => void (n.markov.dephasing = 1), {
			coupling: [false, false, false, false, false, false, false, false, true],
			fieldA: [false, false, true],
			fieldS: [true, false, false],
			pulses: [
				{ time: 0.25, target: 'A' },
				{ time: 0.5, target: 'S' },
				{ time: 0.75, target: 'both' }
			]
		});
		const K = 3;
		expect(freeControls(s)).toEqual([
			8,
			11,
			12,
			15,
			16,
			17,
			21,
			22,
			23,
			15 + 3 * K + 3,
			15 + 3 * K + 4,
			15 + 3 * K + 5,
			15 + 3 * K + 6,
			15 + 3 * K + 7,
			15 + 3 * K + 8
		]);
		const p = buildAncilla(s, 24);
		expect(p.nParams).toBe(15 + 6 * K);
		expect(p.bound[8]).toBe(s.controlBound);
		expect(p.bound[15]).toBe(s.pulseBound);
		expect(p.bound[0]).toBe(0);
		expect(p.exact).toBe(false);
		expect(p.steps).toBe(24);
	});

	it('ignores the A-only controls without an ancilla: an MZI with local fields', () => {
		// 'active+S': coupling, both fields, two pulses on both registers
		const s = setupWith(2, 0, 'active+S', (n) => void (n.markov.amplitudeDamping = 1));
		const K = 2;
		const o = 15 + 3 * K;
		expect(freeControls(s)).toEqual([12, 13, 14, o, o + 1, o + 2, o + 3, o + 4, o + 5]);
		// Pulses on A alone are dropped
		expect(freeControls(applyPreset(s, 'active'))).toEqual([12, 13, 14]);
		const p = buildAncilla(s, 24);
		expect(p.reg.dim).toBe(4);
		for (let k = 0; k < 12; k++) expect(p.bound[k]).toBe(0);
	});

	it('uses one exact step for an uncontrolled covariant hold, Strang steps otherwise', () => {
		const deph = setupWith(2, 1, 'passive-ent', (n) => void (n.markov.dephasing = 1));
		expect(buildAncilla(deph, 24).exact).toBe(true);
		const lor = setupWith(2, 1, 'passive-ent', (n) => {
			n.lorentzian = { kind: 'dephasing', gamma: 1, lambda: 2 };
		});
		const p = buildAncilla(lor, 24);
		expect(p.exact).toBe(true);
		expect(p.reg.dim).toBe(8);
		const transverse = setupWith(1, 1, 'passive-ent', (n) => void (n.markov.transverse = 1));
		expect(buildAncilla(transverse, 24).exact).toBe(false);
	});

	it('puts pseudomodes only on qubits with a Lorentzian bath', () => {
		const s = setupWith(1, 1, 'active', (n) => {
			n.lorentzian = { kind: 'dephasing', gamma: 1, lambda: 2 };
		});
		s.noise.ancilla = noiseless();
		const p = buildAncilla(s, 24);
		expect(p.reg.modeQubits).toEqual([0]);
		expect(p.reg.dim).toBe(4 * s.pmLevels);
		const ad = setupWith(1, 1, 'active', (n) => {
			n.lorentzian = { kind: 'amplitudeDamping', gamma: 1, lambda: 2 };
		});
		expect(buildAncilla(ad, 24).reg.dim).toBe(16);
	});

	it('makes the companion by switching every coupling entry off', () => {
		const s = setupWith(1, 1, 'active', (n) => void (n.markov.dephasing = 1));
		expect(hasCompanion(s)).toBe(true);
		const c = buildAncilla(s, 24, 'companion');
		expect(c.free.some((k) => k < 9)).toBe(false);
		expect(c.free.length).toBe(buildAncilla(s, 24).free.length - 9);
		expect(hasCompanion(applyPreset(s, 'local'))).toBe(false);
	});

	it('gives the same QFI for a pulse split over two coinciding times', () => {
		const s = setupWith(1, 1, 'active', (n) => void (n.markov.amplitudeDamping = 1), {
			pulses: [
				{ time: 0.5, target: 'A' },
				{ time: 0.501, target: 'A' }
			]
		});
		const one = { ...s, pulses: [{ time: 0.5, target: 'A' as const }] };
		const p2 = buildAncilla(s, 24);
		const p1 = buildAncilla(one, 24);
		const v = [0.4, -0.3, 0.2];
		const params2 = new Float64Array(p2.nParams);
		params2.set([0, 0, 0.7], 15); // pulse 1 = rotation about z, pulse 2 about z too: they compose
		params2.set([0, 0, 0.5], 18);
		const params1 = new Float64Array(p1.nParams);
		params1.set([0, 0, 1.2], 15);
		params2.set(v, 12);
		params1.set(v, 12);
		const psi = randomState(p1.iso.cols, new Prng(5));
		expect(qfiOfState(p2.hold(params2), p2.iso, psi)).toBeCloseTo(
			qfiOfState(p1.hold(params1), p1.iso, psi),
			12
		);
	});
});

describe('buildMzi', () => {
	it('takes particles in order from S then A with their noise', () => {
		const s = setupWith(1, 2, 'active', (n) => void (n.markov.dephasing = 1));
		s.noise.ancilla = noiseless();
		s.noise.ancilla.markov.transverse = 0.5;
		const two = buildMzi({ ...s, mziParticles: 1 }, 24);
		expect(two.n).toBe(1);
		expect(two.exact).toBe(true);
		expect(two.biasAllowed).toBe(false);
		const three = buildMzi(s, 24);
		expect(three.n).toBe(3);
		expect(three.biasAllowed).toBe(true);
		expect(three.biasBound).toBe(s.controlBound);
		expect(three.exact).toBe(false);
	});

	it('scales the window: QFI of |+⟩ under dephasing is t′² e^{−2γt′}', () => {
		const s = setupWith(1, 0, 'passive-ent', (n) => void (n.markov.dephasing = 2), {
			mziParticles: 1
		});
		const m = buildMzi(s, 24);
		const plus = { re: Float64Array.from([Math.SQRT1_2, Math.SQRT1_2]), im: new Float64Array(2) };
		for (const t of [0.25, 0.5, 1]) {
			expect(qfiOfState(m.hold(t), m.isoFull, plus)).toBeCloseTo(t * t * Math.exp(-4 * t), 12);
		}
	});

	it('uses d = 2 pseudomodes for Lorentzian damping', () => {
		const s = setupWith(1, 1, 'active', (n) => {
			n.lorentzian = { kind: 'amplitudeDamping', gamma: 1, lambda: 2 };
		});
		const m = buildMzi(s, 24);
		expect(m.reg.dim).toBe(16);
		expect(m.biasAllowed).toBe(true);
		expect(m.hold(0.5, 2).steps).toBe(24);
	});
});
