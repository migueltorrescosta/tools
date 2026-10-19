import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import type { LorentzianNoise, MarkovNoise, RegisterNoise } from './types';
import { type CMat, add, expm, frobInner, matmul, outer, rectApply, scale, zeros } from './linalg';
import { HoldMap } from './hold';
import {
	lorentzianExponent,
	perQubitNoise,
	pseudomodeHamiltonian,
	registerNoiseStep
} from './noise';
import { qfiAndSld, qfiOfState } from './qfi';
import {
	type Register,
	collectiveSpin,
	embedSiteOperator,
	inputIsometry,
	makeRegister,
	partialTraceQubits,
	sigmaMinus,
	spinHalf
} from './register';
import { liouvillianReference, randomDensity, randomHermitian, realState } from './test-helpers';

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

/** Random qubit control Hamiltonian lifted to the full space. */
function randomControl(reg: Register, prng: Prng): CMat {
	const h = zeros(reg.dim);
	for (let k = 0; k < reg.nQubits; k++) {
		for (const ax of ['x', 'y', 'z'] as const) {
			const e = embedSiteOperator(spinHalf(ax), k, reg.dims);
			for (let i = 0; i < h.re.length; i++) {
				const c = prng.normal();
				h.re[i] += c * e.re[i];
				h.im[i] += c * e.im[i];
			}
		}
	}
	// a random two-body S–A coupling s_x^0 s_y^last
	const c = matmul(
		embedSiteOperator(spinHalf('x'), 0, reg.dims),
		embedSiteOperator(spinHalf('y'), reg.nQubits - 1, reg.dims)
	);
	return add(h, scale(c, 2 * prng.normal()));
}

/** Rotation exp(−i v · J^A) on the full space. */
function ancillaPulse(reg: Register, prng: Prng): CMat {
	let g = zeros(reg.dim);
	for (const ax of ['x', 'y', 'z'] as const)
		g = add(g, scale(collectiveSpin(reg, ax, 'A'), prng.normal()));
	return expm(scale(g, 0, -1));
}

describe('HoldMap', () => {
	it('adjoint satisfies ⟨X0, ρ0⟩ = ⟨x, ρ⟩ + ⟨y, dρ⟩', () => {
		const prng = new Prng(5);
		const cases = [makeRegister(2, 1), makeRegister(1, 1, [0, 1], 2)];
		for (const reg of cases) {
			const lor: LorentzianNoise[] = reg.modeLevels
				? [
						{ kind: 'dephasing', gamma: 0.7, lambda: 0.5 },
						{ kind: 'amplitudeDamping', gamma: 0.9, lambda: 1.2 }
					]
				: [noBath, noBath, noBath];
			const per = lor.map((l, k) => ({
				markov: { ...quiet, amplitudeDamping: 0.6, dephasing: 0.1 * k },
				lorentzian: l
			}));
			const steps = 12;
			const hold = new HoldMap({
				dims: reg.dims,
				nQubits: reg.nQubits,
				generator: collectiveSpin(reg, 'z', 'S'),
				hCtrl: add(randomControl(reg, prng), pseudomodeHamiltonian(reg, lor)),
				noise: registerNoiseStep(reg, per, 1 / steps),
				steps,
				pulses: new Map([
					[4, ancillaPulse(reg, prng)],
					[8, ancillaPulse(reg, prng)]
				])
			});
			const rho0 = randomDensity(reg.dim, prng);
			const x = randomHermitian(reg.qubitDim, prng);
			const y = randomHermitian(reg.qubitDim, prng);
			const { rho, drho } = hold.forward(rho0);
			const lhs = frobInner(hold.adjoint(x, y), rho0);
			const rhs = frobInner(x, rho) + frobInner(y, drho);
			expect(Math.abs(lhs - rhs)).toBeLessThan(1e-10 * Math.abs(rhs));
		}
	});

	it('rejects pulses off the step boundaries', () => {
		const reg = makeRegister(1, 0);
		const gen = collectiveSpin(reg, 'z', 'T');
		const noise = registerNoiseStep(reg, [markov({})], 0.25);
		const make = (k: number) =>
			new HoldMap({
				dims: reg.dims,
				nQubits: 1,
				generator: gen,
				hCtrl: zeros(2),
				noise,
				steps: 4,
				pulses: new Map([[k, gen]])
			});
		expect(() => make(4)).toThrow();
		expect(() => make(0)).toThrow();
		expect(() => make(2)).not.toThrow();
	});

	for (const [label, gen, noise] of [
		['passive, dephasing', 'S', [markov({ dephasing: 0.8 }), markov({ dephasing: 0.8 })]],
		[
			'active, damping + per-register noise',
			'T',
			[
				markov({ amplitudeDamping: 0.8, nbar: 0.2 }),
				markov({ amplitudeDamping: 0.8, transverse: 0.3, depolarizing: 0.2 })
			]
		]
	] as const) {
		it(`Strang splitting matches a dense Liouvillian (${label})`, () => {
			const prng = new Prng(3);
			const reg = makeRegister(1, 1);
			const steps = 96;
			const h = randomControl(reg, prng);
			const p1 = ancillaPulse(reg, prng);
			const p2 = ancillaPulse(reg, prng);
			const g = collectiveSpin(reg, 'z', gen);
			const hold = new HoldMap({
				dims: reg.dims,
				nQubits: 2,
				generator: g,
				hCtrl: h,
				noise: registerNoiseStep(reg, noise, 1 / steps),
				steps,
				pulses: new Map([
					[32, p1],
					[64, p2]
				])
			});
			const psi = realState([0.3, -0.5, 0.6, 0.2]);
			psi.im.set([0.1, 0.4, 0, -0.3]);
			const n = Math.hypot(...psi.re, ...psi.im);
			psi.re.forEach((_, i) => {
				psi.re[i] /= n;
				psi.im[i] /= n;
			});
			const rho0 = outer(psi);
			const ops: CMat[] = [];
			noise.forEach((rn, k) => {
				const m = rn.markov;
				const on = (op: CMat, rate: number) => {
					if (rate > 0) ops.push(scale(embedSiteOperator(op, k, reg.dims), Math.sqrt(rate)));
				};
				const pz = scale(spinHalf('z'), 2);
				const px = scale(spinHalf('x'), 2);
				const py = scale(spinHalf('y'), 2);
				const raise = zeros(2);
				raise.re[2] = 1;
				on(pz, m.dephasing / 2);
				on(sigmaMinus(), m.amplitudeDamping * (m.nbar + 1));
				on(raise, m.amplitudeDamping * m.nbar);
				for (const p of [px, py, pz]) on(p, m.depolarizing / 4);
				on(px, m.transverse / 2);
			});
			const ref = liouvillianReference(
				h,
				g,
				ops,
				[
					{ at: 1 / 3, u: p1 },
					{ at: 2 / 3, u: p2 }
				],
				rho0
			);
			const { rho, drho } = hold.forward(rho0);
			const qfi = qfiAndSld(rho, drho).qfi;
			const qref = qfiAndSld(ref.rho, ref.drho).qfi;
			expect(qfi).toBeGreaterThan(0.05);
			expect(Math.abs(qfi / qref - 1)).toBeLessThan(1e-4);
		});
	}

	it('applies each register its own noise', () => {
		const gamma = 0.5;
		const reg = makeRegister(1, 1);
		const plus = outer(realState([0.5, 0.5, 0.5, 0.5]));
		for (const [ancilla, expected] of [
			[markov({ dephasing: gamma }), Math.exp(-gamma)],
			[markov({}), 1]
		] as const) {
			const per = perQubitNoise(reg, { system: markov({ dephasing: gamma }), ancilla });
			const hold = new HoldMap({
				dims: reg.dims,
				nQubits: 2,
				generator: collectiveSpin(reg, 'z', 'S'),
				hCtrl: zeros(4),
				noise: registerNoiseStep(reg, per, 1 / 3),
				steps: 3
			});
			const { rho } = hold.forward(plus);
			// ρ_A[0][1] = Σ_s ρ[(s, 0), (s, 1)]
			const re = rho.re[0 * 4 + 1] + rho.re[2 * 4 + 3];
			const im = rho.im[0 * 4 + 1] + rho.im[2 * 4 + 3];
			expect(2 * Math.hypot(re, im)).toBeCloseTo(expected, 10);
		}
	});
});

describe('pseudomodes', () => {
	const gamma = 1;
	const lambda = 0.5;
	const bath: RegisterNoise = { markov: quiet, lorentzian: { kind: 'dephasing', gamma, lambda } };

	function pseudomodeHold(reg: Register, per: RegisterNoise[], steps: number, gen: CMat): HoldMap {
		return new HoldMap({
			dims: reg.dims,
			nQubits: reg.nQubits,
			generator: gen,
			hCtrl: pseudomodeHamiltonian(
				reg,
				per.map((p) => p.lorentzian)
			),
			noise: registerNoiseStep(reg, per, 1 / steps),
			steps
		});
	}

	it('reproduce e^{−2Γ} for one dephased qubit (d = 6)', () => {
		const reg = makeRegister(1, 0, [0], 6);
		const hold = pseudomodeHold(reg, [bath], 24, collectiveSpin(reg, 'z', 'T'));
		const qfi = qfiOfState(
			hold,
			inputIsometry(reg, 'full'),
			realState([Math.SQRT1_2, Math.SQRT1_2])
		);
		const big = lorentzianExponent(gamma, lambda, 1);
		expect(Math.abs(qfi / Math.exp(-2 * big) - 1)).toBeLessThan(1e-4);
	});

	it('reproduce 4 e^{−4Γ} for a Bell state on S and A (d = 4)', () => {
		const reg = makeRegister(1, 1, [0, 1], 4);
		const hold = pseudomodeHold(reg, [bath, bath], 24, collectiveSpin(reg, 'z', 'T'));
		const psi = realState([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
		const qfi = qfiOfState(hold, inputIsometry(reg, 'full'), psi);
		const big = lorentzianExponent(gamma, lambda, 1);
		expect(Math.abs(qfi / (4 * Math.exp(-4 * big)) - 1)).toBeLessThan(1e-4);
	});

	it('Lorentzian damping matches the exact excited amplitude (d = 2)', () => {
		// Das and Demkowicz-Dobrzański: c(t) = e^{−λt/2}(cosh(δt/2) + λ/δ sinh(δt/2)), δ = sqrt(λ² − 2 γ0 λ).
		const g0 = 2.457;
		const lam = 2.5;
		const reg = makeRegister(1, 0, [0], 2);
		const per: RegisterNoise[] = [
			{ markov: quiet, lorentzian: { kind: 'amplitudeDamping', gamma: g0, lambda: lam } }
		];
		const hold = pseudomodeHold(reg, per, 96, collectiveSpin(reg, 'z', 'T'));
		const excited = rectApply(inputIsometry(reg, 'full'), realState([0, 1]));
		const { rho } = hold.forward(outer(excited));
		// δ is imaginary here: δ = i w, cosh → cos, sinh(δ t/2)/δ → sin(w t/2)/w
		const w = Math.sqrt(2 * g0 * lam - lam * lam);
		const c = Math.exp(-lam / 2) * (Math.cos(w / 2) + (lam / w) * Math.sin(w / 2));
		expect(Math.abs(rho.re[3] / (c * c) - 1)).toBeLessThan(1e-4);
		expect(partialTraceQubits(outer(excited), reg).re[3]).toBe(1);
	});
});
