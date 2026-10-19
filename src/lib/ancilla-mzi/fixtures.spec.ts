import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/python-reference.json';
import type { CVec } from './linalg';
import { outer, rectApply } from './linalg';
import { buildAncilla, buildMzi } from './build';
import { qfiAndSld, qfiOfState } from './qfi';
import { readoutObjectives } from './readouts';
import type { RegisterNoise, Setup } from './types';

interface FixtureCase {
	id: string;
	setup: {
		nS: number;
		nA: number;
		ancillaWeight: number;
		input: 'sym' | 'full';
		noise: { system: RegisterNoise; ancilla: RegisterNoise };
		pmLevels: number;
	};
	steps: number;
	mzi?: boolean;
	bias?: number;
	python: { s_pulses?: boolean };
	pulseTimes: number[];
	controls: number[];
	psi: { re: number[]; im: number[] };
	qfi: number;
	qfi2M?: number;
	steps2M?: number;
}

interface ReadoutCase {
	id: string;
	fromCase: string;
	nS: number;
	nA: number;
	uS: number[];
	xJoint?: number[];
	expected: { ep_s: number; parity_s: number; ep_joint?: number; parity_joint?: number };
}

const all = fixtures.cases as unknown[];
const holdCases = all.filter((c) => !(c as { id: string }).id.startsWith('r')) as FixtureCase[];
const readoutCases = all.filter((c) => (c as { id: string }).id.startsWith('r')) as ReadoutCase[];

/** The fixture's configuration as a Setup: every control on when the case has controls. */
function toSetup(c: FixtureCase): Setup {
	const controlled = c.controls.some((x) => x !== 0) || c.pulseTimes.length > 0;
	const on = controlled && c.setup.nA > 0;
	return {
		nS: c.setup.nS,
		nA: c.setup.nA,
		input: c.setup.input,
		ancillaWeight: c.setup.ancillaWeight,
		coupling: Array.from({ length: 9 }, () => on),
		fieldA: [on, on, on],
		fieldS: [controlled, controlled, controlled],
		controlBound: 10,
		pulseBound: 2 * Math.PI,
		pulses: c.pulseTimes.map((time) => ({ time, target: c.python.s_pulses ? 'both' : 'A' })),
		noise: c.setup.noise,
		mziParticles: c.setup.nS + c.setup.nA,
		ancillaHold: 1,
		pmLevels: c.setup.pmLevels || 3
	};
}

const vec = (p: { re: number[]; im: number[] }): CVec => ({
	re: Float64Array.from(p.re),
	im: Float64Array.from(p.im)
});

function relErr(a: number, b: number): number {
	return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
}

/** QFI of a case at `steps` through build.ts. */
function caseQfi(c: FixtureCase, steps: number): number {
	const setup = toSetup(c);
	const psi = vec(c.psi);
	if (c.mzi) {
		const mzi = buildMzi(setup, c.steps);
		return qfiOfState(mzi.hold(1, c.bias ?? 0, steps), mzi.isoFull, psi);
	}
	const p = buildAncilla(setup, c.steps);
	return qfiOfState(p.hold(c.controls, steps), p.iso, psi);
}

describe('Python reference fixtures', () => {
	it('has every case', () => {
		expect(holdCases.length).toBe(15);
		expect(readoutCases.length).toBe(2);
	});

	for (const c of holdCases) {
		it(`${c.id}: QFI at M = ${c.steps}${c.qfi2M !== undefined ? ' and 2M' : ''}`, () => {
			expect(relErr(caseQfi(c, c.steps), c.qfi)).toBeLessThan(1e-8);
			if (c.qfi2M !== undefined && c.steps2M !== undefined)
				expect(relErr(caseQfi(c, c.steps2M), c.qfi2M)).toBeLessThan(1e-8);
		});
	}

	it('builds the hold the fixtures expect (exactness and pseudomodes)', () => {
		const byId = Object.fromEntries(holdCases.map((c) => [c.id, c]));
		expect(buildAncilla(toSetup(byId.c09_21_passive_closed_form), 24).exact).toBe(true);
		expect(buildAncilla(toSetup(byId.c13_11_weight2), 24).exact).toBe(true);
		expect(buildAncilla(toSetup(byId.c06_11_lor_deph), 12).reg.dim).toBe(36);
		expect(buildAncilla(toSetup(byId.c08_11_lor_ad), 24).reg.dim).toBe(16);
		expect(buildAncilla(toSetup(byId.c05_11_clean_ad), 24).reg.dim).toBe(4);
		expect(buildMzi(toSetup(byId.c10c_mzi2_lor_ad_bias), 48).biasAllowed).toBe(true);
		expect(buildMzi(toSetup(byId.c10a_mzi3_ad), 48).exact).toBe(true);
	});

	for (const r of readoutCases) {
		it(`${r.id}: readouts at fixed rotations`, () => {
			const c = holdCases.find((h) => h.id === r.fromCase) as FixtureCase;
			const setup = toSetup(c);
			let rho, drho;
			if (c.mzi) {
				const mzi = buildMzi(setup, c.steps);
				({ rho, drho } = mzi
					.hold(1, 0, c.steps)
					.forward(outer(rectApply(mzi.isoFull, vec(c.psi)))));
			} else {
				const p = buildAncilla(setup, c.steps);
				({ rho, drho } = p.hold(c.controls).forward(outer(rectApply(p.iso, vec(c.psi)))));
			}
			expect(relErr(qfiAndSld(rho, drho).qfi, c.qfi)).toBeLessThan(1e-8);
			const f = readoutObjectives(rho, drho, r.nS, r.nA);
			const close = (got: number, want: number) =>
				expect(Math.abs(got - want)).toBeLessThan(1e-10 + 1e-8 * Math.abs(want));
			close(f.epS(r.uS), r.expected.ep_s);
			close(f.parityS(r.uS), r.expected.parity_s);
			if (r.xJoint && r.expected.ep_joint !== undefined && r.expected.parity_joint !== undefined) {
				close(f.epJoint(r.xJoint), r.expected.ep_joint);
				close(f.parityJoint(r.xJoint), r.expected.parity_joint);
			}
		});
	}
});
