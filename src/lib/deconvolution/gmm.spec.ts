import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist } from './dist';
import { emStep, fitGmm, gmmSpec } from './gmm';
import type { GmmComponent, GmmState } from './gmm';

function sampleNormal(n: number, mu: number, s: number, seed: number): Float64Array {
	const prng = new Prng(seed);
	const out = new Float64Array(n);
	for (let i = 0; i < n; i++) out[i] = mu + s * prng.normal();
	return out;
}

function sampleMixture(
	n: number,
	components: { weight: number; mean: number; sd: number }[],
	seed: number
): Float64Array {
	const prng = new Prng(seed);
	const out = new Float64Array(n);
	const cumWeights = new Float64Array(components.length);
	let sum = 0;
	for (let j = 0; j < components.length; j++) {
		sum += components[j].weight;
		cumWeights[j] = sum;
	}
	for (let i = 0; i < n; i++) {
		const u = prng.next() * sum;
		let comp = 0;
		while (comp < components.length - 1 && u > cumWeights[comp]) comp++;
		out[i] = components[comp].mean + components[comp].sd * prng.normal();
	}
	return out;
}

describe('fitGmm', () => {
	it('recovers two-component mixture with known noise', () => {
		// X = 0.5·N(−2, 0.5) + 0.5·N(2, 0.7), σ = 0.5, n = 4000
		const seed = 123;
		const n = 4000;
		const noiseSigma = 0.5;
		const trueComponents = [
			{ weight: 0.5, mean: -2, sd: 0.5 },
			{ weight: 0.5, mean: 2, sd: 0.7 }
		];
		const X = sampleMixture(n, trueComponents, seed);
		const Y = sampleNormal(n, 0, noiseSigma, seed + 1);
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) data[i] = X[i] + Y[i];

		const result = fitGmm({ data, noiseSigma, kMax: 4, seed: seed + 2, restarts: 2, maxIter: 200 });
		expect(result.best.k).toBe(2);
		const means = result.best.components.map((c) => c.mean).sort((a, b) => a - b);
		const sds = result.best.components.map((c) => c.sd).sort((a, b) => a - b);
		expect(means[0]).toBeCloseTo(-2, 1); // within 0.15
		expect(means[1]).toBeCloseTo(2, 1);
		expect(sds[0]).toBeCloseTo(0.5, 1); // within 0.15
		expect(sds[1]).toBeCloseTo(0.7, 1);
	});

	it('chooses k=1 for single normal X', () => {
		const seed = 456;
		const n = 2000;
		const noiseSigma = 0.3;
		const X = sampleNormal(n, 1.5, 0.8, seed);
		const Y = sampleNormal(n, 0, noiseSigma, seed + 1);
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) data[i] = X[i] + Y[i];

		const result = fitGmm({ data, noiseSigma, kMax: 4, seed: seed + 2, restarts: 2, maxIter: 200 });
		expect(result.best.k).toBe(1);
		expect(result.best.components[0].mean).toBeCloseTo(1.5, 1);
		expect(result.best.components[0].sd).toBeCloseTo(0.8, 1);
	});

	it('log-likelihood never decreases across EM iterations (via exported emStep)', () => {
		const seed = 789;
		const n = 500;
		const noiseSigma = 0.4;
		const X = sampleNormal(n, 0, 1, seed);
		const Y = sampleNormal(n, 0, noiseSigma, seed + 1);
		const data = new Float64Array(n);
		for (let i = 0; i < n; i++) data[i] = X[i] + Y[i];

		// Initialise a 2-component state
		const prng = new Prng(seed + 2);
		const state: GmmState = {
			weights: new Float64Array([0.5, 0.5]),
			means: new Float64Array([-1, 1]),
			sds: new Float64Array([0.5, 0.5])
		};

		let prevLogLik = -Infinity;
		for (let iter = 0; iter < 20; iter++) {
			const { newState, logLik } = emStep(data, state, noiseSigma);
			expect(logLik).toBeGreaterThanOrEqual(prevLogLik - 1e-10); // allow tiny numerical error
			prevLogLik = logLik;
			state.weights.set(newState.weights);
			state.means.set(newState.means);
			state.sds.set(newState.sds);
		}
	});
});

describe('gmmSpec', () => {
	it('round-trips through makeDist and mean matches mixture mean', () => {
		const fit = {
			k: 2,
			components: [
				{ weight: 0.3, mean: -1, sd: 0.5 },
				{ weight: 0.7, mean: 2, sd: 1.2 }
			] as GmmComponent[],
			logLik: -100,
			bic: 200,
			iterations: 10
		};
		const spec = gmmSpec(fit);
		expect(spec.family).toBe('mixture');
		if (spec.family === 'mixture') {
			const d = makeDist(spec, 'signal');
			const expectedMean = 0.3 * -1 + 0.7 * 2;
			expect(d.mean).toBeCloseTo(expectedMean, 10);
		}
	});

	it('k=1 produces a normal spec', () => {
		const fit = {
			k: 1,
			components: [{ weight: 1, mean: 1.5, sd: 0.8 }] as GmmComponent[],
			logLik: -50,
			bic: 100,
			iterations: 5
		};
		const spec = gmmSpec(fit);
		expect(spec.family).toBe('normal');
		if (spec.family === 'normal') {
			expect(spec.params[0]).toBe(1.5);
			expect(spec.params[1]).toBe(0.8);
		}
	});
});

describe('fitGmm with per-point errors', () => {
	it('recovers a two-component mixture when each point has its own σ_i', () => {
		const n = 4000;
		const X = sampleMixture(
			n,
			[
				{ weight: 0.5, mean: -2, sd: 0.5 },
				{ weight: 0.5, mean: 2, sd: 0.7 }
			],
			7
		);
		const prng = new Prng(8);
		const sigma = Float64Array.from({ length: n }, () => 0.2 + 1.0 * prng.next());
		const data = X.map((x, i) => x + sigma[i] * prng.normal());
		const { best } = fitGmm({ data, noiseSigma: sigma, kMax: 4, seed: 9, restarts: 2 });
		expect(best.k).toBe(2);
		const [a, b] = [...best.components].sort((p, q) => p.mean - q.mean);
		expect(a.mean).toBeCloseTo(-2, 1);
		expect(b.mean).toBeCloseTo(2, 1);
		// Noise up to σ = 1.2 hides the scales more than the means.
		expect(Math.abs(a.sd - 0.5)).toBeLessThan(0.1);
		expect(Math.abs(b.sd - 0.7)).toBeLessThan(0.1);
	});

	it('a constant σ_i gives exactly the shared-σ fit', () => {
		const prng = new Prng(3);
		const data = Float64Array.from(
			{ length: 500 },
			() => (prng.next() < 0.5 ? -2 : 2) + prng.normal()
		);
		const shared = fitGmm({ data, noiseSigma: 0.6, kMax: 2, seed: 1, restarts: 1 });
		const each = fitGmm({
			data,
			noiseSigma: new Float64Array(500).fill(0.6),
			kMax: 2,
			seed: 1,
			restarts: 1
		});
		expect(each.best.logLik).toBeCloseTo(shared.best.logLik, 6);
		expect(each.best.components[0].sd).toBeCloseTo(shared.best.components[0].sd, 6);
	});
});
