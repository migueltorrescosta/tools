import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { compareFamilies, fitMle, type MleResult } from './mle';
import { simulate } from './sample';
import type { DistSpec, SimpleSpec } from './types';

const sample = (x: DistSpec, y: SimpleSpec, n: number, seed: number) =>
	simulate(makeDist(x, 'signal'), makeDist(y, 'noise'), n, seed);

const param = (
	r: MleResult,
	role: 'signal' | 'noise',
	key: string,
	component: number | null = null
) => r.params.find((p) => p.role === role && p.key === key && p.component === component)!;

const covers = (r: MleResult, role: 'signal' | 'noise', key: string, truth: number) => {
	const p = param(r, role, key);
	return p.lower <= truth && truth <= p.upper;
};

describe('fitMle', { timeout: 60_000 }, () => {
	it('recovers normal X + Laplace Y from wrong starting values', () => {
		const data = sample(
			{ family: 'normal', params: [1, 1] },
			{ family: 'laplace', params: [0, 0.6] },
			1500,
			1
		);
		const r = fitMle({
			data,
			x: { family: 'normal', params: [0, 2] },
			y: { family: 'laplace', params: [0, 1] },
			seed: 1,
			starts: 3
		});
		expect(covers(r, 'signal', 'mu', 1)).toBe(true);
		expect(covers(r, 'signal', 'sigma', 1)).toBe(true);
		expect(covers(r, 'noise', 'b', 0.6)).toBe(true);
		expect(r.identifiability.flat).toBe(false);
		// The noise's location is held at 0 by definition and isn't reported.
		expect(param(r, 'noise', 'mu')).toBeUndefined();
		expect(r.k).toBe(3);
	});

	it('recovers Poisson X + normal Y', () => {
		const data = sample(
			{ family: 'poisson', params: [4] },
			{ family: 'normal', params: [0, 0.4] },
			1500,
			2
		);
		const r = fitMle({
			data,
			x: { family: 'poisson', params: [2] },
			y: { family: 'normal', params: [0, 1] },
			seed: 2,
			starts: 2
		});
		expect(covers(r, 'signal', 'lambda', 4)).toBe(true);
		expect(covers(r, 'noise', 'sigma', 0.4)).toBe(true);
	});

	it('flags normal X + normal Y, whose σs trade off', () => {
		const data = sample(
			{ family: 'normal', params: [0, 1] },
			{ family: 'normal', params: [0, 0.5] },
			1000,
			3
		);
		const r = fitMle({
			data,
			x: { family: 'normal', params: [0, 1] },
			y: { family: 'normal', params: [0, 0.5] },
			seed: 3,
			starts: 2
		});
		expect(r.identifiability.flat).toBe(true);
		const d = r.identifiability.direction;
		const sx = d.find((v) => v.role === 'signal' && v.key === 'sigma');
		const sy = d.find((v) => v.role === 'noise' && v.key === 'sigma');
		expect(sx && sy).toBeTruthy();
		expect(Math.sign(sx!.weight)).toBe(-Math.sign(sy!.weight));
		// The total variance is still determined.
		const total = param(r, 'signal', 'sigma').value ** 2 + param(r, 'noise', 'sigma').value ** 2;
		expect(Math.abs(total - 1.25)).toBeLessThan(0.15);
	});

	it('holding the noise fixed makes normal + normal identifiable', () => {
		const data = sample(
			{ family: 'normal', params: [0, 1] },
			{ family: 'normal', params: [0, 0.5] },
			1000,
			3
		);
		const r = fitMle({
			data,
			x: { family: 'normal', params: [0, 2] },
			y: { family: 'normal', params: [0, 0.5] },
			fixedY: [false, true],
			seed: 3,
			starts: 2
		});
		expect(r.identifiability.flat).toBe(false);
		expect(r.k).toBe(2);
		const noise = param(r, 'noise', 'sigma');
		expect(noise.fitted).toBe(false);
		expect(noise.value).toBe(0.5);
		expect(covers(r, 'signal', 'sigma', 1)).toBe(true);
	});

	it('fits a two-component mixture under known noise', () => {
		const x: DistSpec = {
			family: 'mixture',
			components: [
				{ family: 'normal', params: [-2, 0.6], weight: 0.4 },
				{ family: 'normal', params: [2, 0.8], weight: 0.6 }
			]
		};
		const data = sample(x, { family: 'normal', params: [0, 0.5] }, 1500, 4);
		const r = fitMle({
			data,
			x: {
				family: 'mixture',
				components: [
					{ family: 'normal', params: [-1, 1], weight: 0.5 },
					{ family: 'normal', params: [1, 1], weight: 0.5 }
				]
			},
			y: { family: 'normal', params: [0, 0.5] },
			fixedY: [false, true],
			seed: 4,
			starts: 2
		});
		expect(Math.abs(param(r, 'signal', 'mu', 0).value + 2)).toBeLessThan(0.25);
		expect(Math.abs(param(r, 'signal', 'mu', 1).value - 2)).toBeLessThan(0.25);
		expect(Math.abs(param(r, 'signal', 'weight', 0).value - 0.4)).toBeLessThan(0.06);
		expect(param(r, 'signal', 'weight', 0).fitted).toBe(false);
		expect(r.k).toBe(5);
	});

	it('95% intervals cover the truth about 95% of the time (Poisson + normal)', () => {
		let lambda = 0;
		let sigma = 0;
		const runs = 30;
		for (let s = 0; s < runs; s++) {
			const data = sample(
				{ family: 'poisson', params: [4] },
				{ family: 'normal', params: [0, 0.4] },
				300,
				100 + s
			);
			const r = fitMle({
				data,
				x: { family: 'poisson', params: [4] },
				y: { family: 'normal', params: [0, 0.4] },
				seed: s,
				starts: 1
			});
			if (covers(r, 'signal', 'lambda', 4)) lambda++;
			if (covers(r, 'noise', 'sigma', 0.4)) sigma++;
		}
		// 95% coverage over 30 runs: at least 25 hits is within about 2.5 binomial sd.
		expect(lambda).toBeGreaterThanOrEqual(25);
		expect(sigma).toBeGreaterThanOrEqual(25);
	});

	it('reports AIC and BIC from its log-likelihood', () => {
		const data = sample(
			{ family: 'normal', params: [0, 1] },
			{ family: 'laplace', params: [0, 0.5] },
			400,
			5
		);
		const r = fitMle({
			data,
			x: { family: 'normal', params: [0, 1] },
			y: { family: 'laplace', params: [0, 0.5] },
			seed: 5,
			starts: 1
		});
		expect(r.aic).toBeCloseTo(2 * r.k - 2 * r.logLik, 9);
		expect(r.bic).toBeCloseTo(r.k * Math.log(400) - 2 * r.logLik, 9);
		expect(r.n).toBe(400);
	});
});

describe('compareFamilies', () => {
	it('ranks the true signal family first', () => {
		const y: SimpleSpec = { family: 'normal', params: [0, 0.3] };
		const data = sample({ family: 'laplace', params: [0, 1] }, y, 2000, 6);
		const ranked = compareFamilies(data, y, ['normal', 'laplace'], 6, [false, true]);
		expect(ranked.map((r) => r.family)).toEqual(['laplace', 'normal']);
		expect(ranked[0].result.bic).toBeLessThan(ranked[1].result.bic);
	});
});
