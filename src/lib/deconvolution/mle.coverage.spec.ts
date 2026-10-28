import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { fitMle, type MleResult } from './mle';
import { simulate } from './sample';
import type { DistSpec, SimpleSpec } from './types';

/** The true value of each fitted, non-weight parameter, keyed like `signal.0.mu`. */
function truths(x: DistSpec, y: SimpleSpec, r: MleResult): Map<string, number> {
	const out = new Map<string, number>();
	const index = new Map<string, number>();
	for (const p of r.params) {
		const spec = p.role === 'noise' ? y : x.family === 'mixture' ? x.components[p.component!] : x;
		const group = `${p.role}.${p.component ?? ''}`;
		const i = index.get(group) ?? 0;
		index.set(group, i + 1);
		if (p.fitted && p.key !== 'weight') out.set(`${group}.${p.key}`, spec.params[i]);
	}
	return out;
}

/** How many of `runs` seeded fits put each parameter's truth inside its 95% interval. */
function coverage(
	x: DistSpec,
	y: SimpleSpec,
	n: number,
	runs: number,
	fixedY?: boolean[]
): Map<string, number> {
	const hits = new Map<string, number>();
	for (let s = 0; s < runs; s++) {
		const data = simulate(makeDist(x, 'signal'), makeDist(y, 'noise'), n, 1000 + s);
		const r = fitMle({ data, x, y, fixedY, seed: s, starts: 1 });
		const truth = truths(x, y, r);
		for (const p of r.params) {
			const key = `${p.role}.${p.component ?? ''}.${p.key}`;
			const t = truth.get(key);
			if (t === undefined) continue;
			hits.set(key, (hits.get(key) ?? 0) + (p.lower <= t && t <= p.upper ? 1 : 0));
		}
	}
	return hits;
}

// Nominal 95%: each parameter must cover in at least 90% of the runs.
const atLeast = (hits: Map<string, number>, min: number) => {
	expect(hits.size).toBeGreaterThan(0);
	for (const [key, h] of hits) expect(h, key).toBeGreaterThanOrEqual(min);
};

describe('parametric MLE coverage', { timeout: 120_000 }, () => {
	it('gamma signal + Laplace noise, 50 runs', () => {
		atLeast(
			coverage(
				{ family: 'gamma', params: [3, 1] },
				{ family: 'laplace', params: [0, 0.5] },
				1000,
				50
			),
			45
		);
	});

	it('Poisson signal + normal noise, 50 runs', () => {
		atLeast(
			coverage({ family: 'poisson', params: [4] }, { family: 'normal', params: [0, 0.4] }, 400, 50),
			45
		);
	});

	it('normal mixture + normal noise of known σ, 50 runs', () => {
		const x: DistSpec = {
			family: 'mixture',
			components: [
				{ family: 'normal', params: [-2, 0.6], weight: 0.4 },
				{ family: 'normal', params: [2, 0.8], weight: 0.6 }
			]
		};
		atLeast(coverage(x, { family: 'normal', params: [0, 0.5] }, 1000, 50, [false, true]), 45);
	});

	// A fringe pattern blurred by normal noise is a fringe pattern again (wider envelope,
	// lower frequency and visibility), so the noise's σ must be known.
	it('fringe signal + normal noise of known σ, 50 runs', () => {
		atLeast(
			coverage(
				{ family: 'fringe', params: [0, 2, 3, 0.8, 0] },
				{ family: 'normal', params: [0, 0.2] },
				1000,
				50,
				[false, true]
			),
			45
		);
	});

	it('flags a fringe signal with free normal noise', () => {
		const x: DistSpec = { family: 'fringe', params: [0, 2, 3, 0.8, 0] };
		const y: SimpleSpec = { family: 'normal', params: [0, 0.2] };
		for (let s = 0; s < 2; s++) {
			const data = simulate(makeDist(x, 'signal'), makeDist(y, 'noise'), 1000, 1000 + s);
			const { identifiability: id } = fitMle({ data, x, y, seed: s, starts: 1 });
			expect(id.flat || id.boundary.length > 0).toBe(true);
		}
	});
});
