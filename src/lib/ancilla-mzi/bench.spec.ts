/**
 * Timings and sanity numbers, skipped unless ANCILLA_BENCH is set:
 * ANCILLA_BENCH=1 taskset -c 0,1 pnpm exec vitest run --project server src/lib/ancilla-mzi/bench.spec.ts
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { applyPreset, DEFAULT_BUDGET, defaultSetup, noiseless, type PresetId } from './presets';
import type { RegisterNoise, Setup } from './types';
import { buildAncilla } from './build';
import { computeMzi } from './mzi';
import { finaliseBest, optimiseSeed, seedParams, toSeedResult } from './optimise';
import { computeMetrics } from './metrics';

const bench = !!process.env.ANCILLA_BENCH;
const SEEDS = Number(process.env.ANCILLA_SEEDS ?? 2);

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

const ad = (g: number) => (n: RegisterNoise) => void (n.markov.amplitudeDamping = g);
const deph = (g: number) => (n: RegisterNoise) => void (n.markov.dephasing = g);
const lor =
	(kind: 'dephasing' | 'amplitudeDamping', gamma: number, lambda: number) => (n: RegisterNoise) =>
		void (n.lorentzian = { kind, gamma, lambda });

function run(label: string, setup: Setup, seeds = SEEDS) {
	const budget = DEFAULT_BUDGET;
	const t0 = performance.now();
	const { result: mzi, timings } = computeMzi(setup, budget, new Prng(1));
	const tMzi = performance.now() - t0;
	const p = buildAncilla(setup, budget.steps);
	const results = [];
	const times: number[] = [];
	for (let k = 0; k < seeds; k++) {
		const prng = new Prng(1000 + k);
		const t = performance.now();
		const o = optimiseSeed(p, seedParams(p, k, prng), prng, budget);
		times.push((performance.now() - t) / 1000);
		results.push(toSeedResult('setup', k, o));
	}
	const top = results.reduce((a, b) => (b.qfi > a.qfi ? b : a));
	const t1 = performance.now();
	const best = finaliseBest(p, top, new Prng(7));
	const tFin = performance.now() - t1;
	const m = computeMetrics({
		setup,
		mzi,
		best,
		optima: results.map((r) => r.qfi),
		companion: null
	});
	process.stderr.write(
		`${label}: dim ${p.reg.dim}, free ${p.free.length}, seeds [${times.map((x) => x.toFixed(2)).join(', ')}] s, ` +
			`evals [${results.map((r) => r.evaluations).join(', ')}], finalise ${(tFin / 1000).toFixed(2)} s, ` +
			`MZI ${(tMzi / 1000).toFixed(2)} s (${Object.entries(timings)
				.map(([k, v]) => `${k} ${(v / 1000).toFixed(2)}`)
				.join(
					', '
				)}), F_MZI ${mzi.qfiOpt.toFixed(4)} at t' ${mzi.window.toFixed(3)} bias ${mzi.bias.toFixed(3)}, ` +
			`F ${best.qfi.toFixed(4)} fine ${best.qfiFine?.toFixed(4)}, R ${m.R.toFixed(3)}, dR ${m.deltaR.toFixed(4)}, ` +
			`Rstd ${m.Rstd.toFixed(3)}, ro ${m.readoutRatio?.toFixed(3)}\n`
	);
	return m;
}

describe.skipIf(!bench)('bench', () => {
	it('times seeds and the MZI baseline', () => {
		const cases: [string, Setup][] = [
			['(1,1) active AD 1', setupWith(1, 1, 'active', ad(1))],
			['(2,2) active AD 1', setupWith(2, 2, 'active', ad(1))],
			['(1,1) active Lorentzian deph (1,5) d=3', setupWith(1, 1, 'active', lor('dephasing', 1, 5))],
			[
				'(1,1) active Lorentzian AD (2.457,2.5)',
				setupWith(1, 1, 'active', lor('amplitudeDamping', 2.457, 2.5))
			],
			['(2,1) active deph 2', setupWith(2, 1, 'active', deph(2))],
			['(1,1) local AD 1', setupWith(1, 1, 'local', ad(1))],
			['(2,1) passive-ent deph 2', setupWith(2, 1, 'passive-ent', deph(2))],
			['(3,1) MZI-only check: (3,1) active AD 1', setupWith(3, 1, 'active', ad(1))]
		];
		const only = process.env.ANCILLA_ONLY;
		for (const [label, s] of cases) if (!only || label.includes(only)) run(label, s);
		expect(true).toBe(true);
	}, 3_600_000);
});
