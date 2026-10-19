import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import type { LorentzianNoise, MarkovNoise, RegisterNoise } from './types';
import {
	type CMat,
	type CVec,
	add,
	expm,
	matmul,
	matvec,
	outer,
	rectApply,
	scale,
	zeros
} from './linalg';
import { HoldMap } from './hold';
import {
	lorentzianExponent,
	perQubitNoise,
	pseudomodeHamiltonian,
	registerNoiseStep
} from './noise';
import { qfiAndSld, qfiOfState, randomState, seesaw } from './qfi';
import {
	type Register,
	collectiveSpin,
	embedSiteOperator,
	inputIsometry,
	liftQubitOperator,
	makeRegister,
	spinHalf,
	symmetricBasis
} from './register';
import { dist, randomDensity, randomHermitian, randomUnitary } from './test-helpers';

const quiet: MarkovNoise = {
	dephasing: 0,
	amplitudeDamping: 0,
	nbar: 0,
	depolarizing: 0,
	transverse: 0
};
const noBath: LorentzianNoise = { kind: 'none', gamma: 0, lambda: 1 };
const markov = (m: Partial<MarkovNoise>): RegisterNoise => ({
	markov: { ...quiet, ...m },
	lorentzian: noBath
});

/** MZI hold on n qubits: generator J_z^T, one exact noise step for the whole hold. */
function mziHold(n: number, noise: RegisterNoise): { hold: HoldMap; reg: Register } {
	const reg = makeRegister(n, 0);
	const step = registerNoiseStep(
		reg,
		perQubitNoise(reg, { system: noise, ancilla: noise }),
		1,
		true
	);
	const hold = new HoldMap({
		dims: reg.dims,
		nQubits: n,
		generator: collectiveSpin(reg, 'z', 'T'),
		hCtrl: zeros(reg.dim),
		noise: step,
		steps: 1,
		t: 1
	});
	return { hold, reg };
}

function product(n: number): CVec {
	const d = 2 ** n;
	return { re: new Float64Array(d).fill(1 / Math.sqrt(d)), im: new Float64Array(d) };
}

function noon(n: number): CVec {
	const v = { re: new Float64Array(2 ** n), im: new Float64Array(2 ** n) };
	v.re[0] = v.re[2 ** n - 1] = Math.SQRT1_2;
	return v;
}

const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('MZI closed forms', () => {
	it('dephased qubit: e^{−2γ}', () => {
		for (const gamma of [0, 0.3, 1.5]) {
			const { hold, reg } = mziHold(1, markov({ dephasing: gamma }));
			expect(
				rel(qfiOfState(hold, inputIsometry(reg, 'full'), product(1)), Math.exp(-2 * gamma))
			).toBeLessThan(1e-10);
		}
	});

	it('amplitude-damped qubit: e^{−γ}', () => {
		for (const gamma of [0.3, 1.5]) {
			const { hold, reg } = mziHold(1, markov({ amplitudeDamping: gamma }));
			expect(
				rel(qfiOfState(hold, inputIsometry(reg, 'full'), product(1)), Math.exp(-gamma))
			).toBeLessThan(1e-10);
		}
	});

	it('dephased NOON: n² e^{−2nγ}', () => {
		for (const n of [2, 3, 4]) {
			const { hold, reg } = mziHold(n, markov({ dephasing: 0.2 }));
			expect(
				rel(qfiOfState(hold, inputIsometry(reg, 'full'), noon(n)), n * n * Math.exp(-0.4 * n))
			).toBeLessThan(1e-10);
		}
	});

	it('lossy NOON: n² ηⁿ / w, w = (1 + (1 − η)ⁿ + ηⁿ) / 2', () => {
		const eta = Math.exp(-0.4);
		for (const n of [2, 3, 4]) {
			const { hold, reg } = mziHold(n, markov({ amplitudeDamping: 0.4 }));
			const w = 0.5 * (1 + (1 - eta) ** n + eta ** n);
			expect(
				rel(qfiOfState(hold, inputIsometry(reg, 'full'), noon(n)), (n * n * eta ** n) / w)
			).toBeLessThan(1e-9);
		}
	});

	it('non-Markovian NOON: 4 e^{−4Γ} by the closed-form map', () => {
		const { hold, reg } = mziHold(2, {
			markov: quiet,
			lorentzian: { kind: 'dephasing', gamma: 1, lambda: 0.5 }
		});
		const big = lorentzianExponent(1, 0.5, 1);
		expect(
			rel(qfiOfState(hold, inputIsometry(reg, 'full'), noon(2)), 4 * Math.exp(-4 * big))
		).toBeLessThan(1e-10);
	});

	it('noiseless twin-Fock: N(N + 2)/2 = 12 at N = 4', () => {
		const n = 4;
		const { hold, reg } = mziHold(n, markov({}));
		const dicke = rectApply(symmetricBasis(n), {
			re: Float64Array.from([0, 0, 1, 0, 0]),
			im: new Float64Array(5)
		});
		const rot = expm(scale(collectiveSpin(reg, 'x', 'T'), 0, -Math.PI / 2));
		const twin = matvec(rot, dicke);
		expect(rel(qfiOfState(hold, inputIsometry(reg, 'full'), twin), 12)).toBeLessThan(1e-9);
	});
});

describe('qfiAndSld', () => {
	it('returns an SLD solving dρ = (L ρ + ρ L)/2 on a full-rank state', () => {
		const prng = new Prng(2);
		const rho = randomDensity(6, prng);
		const drho = randomHermitian(6, prng);
		const { qfi, sld } = qfiAndSld(rho, drho);
		const sym = scale(add(matmul(sld, rho), matmul(rho, sld)), 0.5);
		expect(dist(sym, drho)).toBeLessThan(1e-9);
		// F = Tr(dρ L)
		let tr = 0;
		for (let i = 0; i < 6; i++)
			for (let k = 0; k < 6; k++)
				tr += drho.re[i * 6 + k] * sld.re[k * 6 + i] - drho.im[i * 6 + k] * sld.im[k * 6 + i];
		expect(qfi).toBeCloseTo(tr, 9);
	});

	it('gives 4 Var(G) t² for a pure state', () => {
		const prng = new Prng(8);
		const psi = randomState(4, prng);
		const g = randomHermitian(4, prng);
		const rho = outer(psi);
		// dρ = −i [G, ρ]
		const comm = matmul(g, rho);
		const back = matmul(rho, g);
		const drho = zeros(4);
		for (let k = 0; k < 16; k++) {
			drho.re[k] = comm.im[k] - back.im[k];
			drho.im[k] = -(comm.re[k] - back.re[k]);
		}
		const gp = matvec(g, psi);
		let mean = 0;
		let sq = 0;
		for (let i = 0; i < 4; i++) {
			mean += psi.re[i] * gp.re[i] + psi.im[i] * gp.im[i];
			sq += gp.re[i] ** 2 + gp.im[i] ** 2;
		}
		expect(rel(qfiAndSld(rho, drho).qfi, 4 * (sq - mean * mean))).toBeLessThan(1e-9);
	});
});

describe('seesaw', () => {
	it('is monotone and reaches the noiseless optimum N² = 16', () => {
		const n = 4;
		const { hold, reg } = mziHold(n, markov({}));
		const prng = new Prng(1);
		const sym = Math.max(
			...[randomState(n + 1, prng), randomState(n + 1, prng)].map(
				(start) => seesaw(hold, inputIsometry(reg, 'symT'), start, 300).qfi
			)
		);
		expect(rel(sym, 16)).toBeLessThan(1e-6);
		const full = seesaw(hold, inputIsometry(reg, 'full'), randomState(16, prng));
		expect(rel(full.qfi, 16)).toBeLessThan(1e-6);
	});

	it('never decreases under amplitude damping', () => {
		const { hold, reg } = mziHold(3, markov({ amplitudeDamping: 0.5 }));
		const res = seesaw(hold, inputIsometry(reg, 'full'), randomState(8, new Prng(1)));
		for (let i = 1; i < res.history.length; i++)
			expect(res.history[i]).toBeGreaterThanOrEqual(res.history[i - 1] - 1e-12);
		expect(res.qfi).toBeGreaterThan(res.history[0]);
		expect(rel(qfiOfState(hold, inputIsometry(reg, 'full'), res.psi), res.qfi)).toBeLessThan(1e-12);
	});

	it('respects the passive noiseless bound F ≤ (N_S t)²', () => {
		const prng = new Prng(7);
		const reg = makeRegister(2, 1);
		const iso = inputIsometry(reg, 'full');
		const make = (h: CMat, pulses: Map<number, CMat>) =>
			new HoldMap({
				dims: reg.dims,
				nQubits: 3,
				generator: collectiveSpin(reg, 'z', 'S'),
				hCtrl: h,
				noise: registerNoiseStep(
					reg,
					perQubitNoise(reg, { system: markov({}), ancilla: markov({}) }),
					1 / 12
				),
				steps: 12,
				pulses
			});
		for (let trial = 0; trial < 3; trial++) {
			const coupling = matmul(
				embedSiteOperator(spinHalf('z'), 0, reg.dims),
				embedSiteOperator(spinHalf('x'), 2, reg.dims)
			);
			const h = add(scale(randomHermitian(8, prng), 2), scale(coupling, 5));
			const hold = make(h, new Map([[6, randomUnitary(8, prng)]]));
			const res = seesaw(hold, iso, randomState(8, prng), 100);
			expect(res.qfi).toBeLessThanOrEqual(4 + 1e-6);
		}
		const free = seesaw(make(zeros(8), new Map()), iso, randomState(8, prng));
		expect(rel(free.qfi, 4)).toBeLessThan(1e-6);
	});
});

const bench = process.env.ANCILLA_BENCH ? it : it.skip;

describe('benchmark (ANCILLA_BENCH=1)', () => {
	function time(label: string, hold: HoldMap, rho0: CMat, reps: number) {
		hold.forward(rho0);
		const t0 = performance.now();
		let s = 0;
		for (let k = 0; k < reps; k++) {
			const { rho, drho } = hold.forward(rho0);
			s += qfiAndSld(rho, drho).qfi;
		}
		const ms = (performance.now() - t0) / reps;
		console.log(`${label}: forward + qfiAndSld ${ms.toFixed(3)} ms`);
		return s;
	}

	bench('times one evaluation at dim 16 and dim 36, M = 24', () => {
		const prng = new Prng(1);
		const m = 24;
		const four = makeRegister(2, 2);
		const noise4 = perQubitNoise(four, {
			system: markov({ dephasing: 0.3, amplitudeDamping: 0.2 }),
			ancilla: markov({ depolarizing: 0.2 })
		});
		const t0 = performance.now();
		const h4 = new HoldMap({
			dims: four.dims,
			nQubits: 4,
			generator: collectiveSpin(four, 'z', 'S'),
			hCtrl: randomHermitian(16, prng),
			noise: registerNoiseStep(four, noise4, 1 / m),
			steps: m,
			pulses: new Map([
				[8, randomUnitary(16, prng)],
				[16, randomUnitary(16, prng)]
			])
		});
		console.log(`dim 16: HoldMap construction ${(performance.now() - t0).toFixed(3)} ms`);
		const rho4 = outer(randomState(16, prng));
		expect(time('dim 16', h4, rho4, 200)).toBeGreaterThan(0);

		const lor: LorentzianNoise = { kind: 'dephasing', gamma: 1, lambda: 0.5 };
		const pm = makeRegister(1, 1, [0, 1], 3);
		const per = perQubitNoise(pm, {
			system: { markov: quiet, lorentzian: lor },
			ancilla: { markov: quiet, lorentzian: lor }
		});
		const hc = add(
			pseudomodeHamiltonian(
				pm,
				per.map((p) => p.lorentzian)
			),
			liftQubitOperator(randomHermitian(4, prng), pm)
		);
		const t1 = performance.now();
		const h36 = new HoldMap({
			dims: pm.dims,
			nQubits: 2,
			generator: collectiveSpin(pm, 'z', 'T'),
			hCtrl: hc,
			noise: registerNoiseStep(pm, per, 1 / m),
			steps: m
		});
		console.log(`dim 36: HoldMap construction ${(performance.now() - t1).toFixed(3)} ms`);
		const rho36 = outer(rectApply(inputIsometry(pm, 'full'), randomState(4, prng)));
		expect(time('dim 36', h36, rho36, 50)).toBeGreaterThan(0);
	});
});
