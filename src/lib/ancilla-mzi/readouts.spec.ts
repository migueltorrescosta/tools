import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/symbolic-regression/prng';
import { outer, rectApply, zeros } from './linalg';
import { buildMzi } from './build';
import { applyPreset, defaultSetup, noiseless } from './presets';
import { qfiAndSld } from './qfi';
import { errorPropagation, maxReadouts, readoutObjectives, readouts } from './readouts';
import { standardStates } from './mzi';

function mziState(n: number, dephasing: number, state: 'noon' | 'product') {
	const noise = noiseless();
	noise.markov.dephasing = dephasing;
	const setup = {
		...applyPreset(defaultSetup(), 'passive-ent'),
		nS: n,
		nA: 0,
		mziParticles: n,
		noise: { system: noise, ancilla: noiseless() }
	};
	const p = buildMzi(setup, 24);
	return p.hold(1).forward(outer(rectApply(p.isoFull, standardStates(n)[state])));
}

describe('readouts', () => {
	it('parity attains the QFI of a dephased NOON state', () => {
		const { rho, drho } = mziState(3, 0.2, 'noon');
		const q = qfiAndSld(rho, drho).qfi;
		expect(q).toBeCloseTo(9 * Math.exp(-2 * 3 * 0.2), 10);
		const r = readouts(rho, drho, 3, 0, new Prng(1));
		expect(r.parity).toBeGreaterThan(q * (1 - 1e-4));
		expect(r.parity).toBeLessThanOrEqual(q * (1 + 1e-9));
		expect(r.epJoint).toBe(r.epSystem);
		expect(r.best).toBe(Math.max(r.epSystem, r.parity));
	});

	it('J_z error propagation attains the QFI of a dephased product state', () => {
		const { rho, drho } = mziState(2, 0.5, 'product');
		const q = qfiAndSld(rho, drho).qfi;
		const r = readouts(rho, drho, 2, 0, new Prng(2));
		expect(r.epSystem).toBeGreaterThan(q * (1 - 1e-5));
	});

	it('splits S and A for the joint readouts', () => {
		const { rho, drho } = mziState(2, 0.5, 'product');
		const f = readoutObjectives(rho, drho, 1, 1);
		const s = f.epS([Math.PI / 2, 0, 0]);
		// cos(x6) = 1 reduces the joint readout to the S readout
		expect(f.epJoint([Math.PI / 2, 0, 0, 0, 0, 0, 0])).toBeCloseTo(s, 12);
		const r = readouts(rho, drho, 1, 1, new Prng(3));
		expect(r.epJoint).toBeGreaterThanOrEqual(r.epSystem);
		expect(r.epJoint).toBeGreaterThan(r.epSystem * 1.5);
	});

	it('excludes a dark fringe and keeps the best entries', () => {
		const rho = zeros(2);
		rho.re[0] = 1;
		const obs = zeros(2);
		obs.re[0] = 1;
		obs.re[3] = -1;
		expect(errorPropagation(rho, zeros(2), obs)).toBe(0);
		const a = { epSystem: 1, epJoint: 2, parity: 0, best: 2 };
		const b = { epSystem: 0.5, epJoint: 3, parity: 1, best: 3 };
		expect(maxReadouts(a, b)).toEqual({ epSystem: 1, epJoint: 3, parity: 1, best: 3 });
	});
});
