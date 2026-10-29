/** Shared by the `bayes.coverage.*.spec.ts` files, one per case so vitest runs them in parallel. */
import { expect } from 'vitest';
import { advance, posterior, startChain, summarise } from './bayes';
import { makeDist } from './dist';
import { family } from './families';
import { fitMle, mleProblem } from './mle';
import { simulate } from './sample';
import type { SimpleSpec } from './types';

/**
 * How many of `runs` seeded Bayesian fits put each fitted parameter's truth
 * inside its 95% credible interval, and how many the MLE's Wald interval does.
 * Two short chains per fit keep the spec affordable; R̂ is checked in bayes.spec.ts.
 */
export function coverage(
	x: SimpleSpec,
	y: SimpleSpec,
	n: number,
	runs: number,
	fixedY?: boolean[]
) {
	const bayes = new Map<string, number>();
	const wald = new Map<string, number>();
	const add = (m: Map<string, number>, k: string, hit: boolean) =>
		m.set(k, (m.get(k) ?? 0) + (hit ? 1 : 0));
	for (let s = 0; s < runs; s++) {
		const data = simulate(makeDist(x, 'signal'), makeDist(y, 'noise'), n, 1000 + s);
		const input = { data, x, y, fixedY, seed: s, starts: 1 };
		const mle = fitMle(input);
		const post = posterior(mleProblem(input), { x: mle.x, y: mle.y });
		const chains = [0, 1].map((c) => {
			const { chain } = advance(post, startChain(post, 10 * s + c), 300, 300, s);
			return advance(post, chain, 600, 300, s + 1).draws;
		});
		for (const p of summarise(post.free, post.box, chains)) {
			const spec = p.role === 'noise' ? y : x;
			const truth = spec.params[family(spec.family).params.findIndex((q) => q.key === p.key)];
			const key = `${p.role}.${p.key}`;
			add(bayes, key, p.lower <= truth && truth <= p.upper);
			const w = mle.params.find((q) => q.role === p.role && q.key === p.key)!;
			add(wald, key, w.lower <= truth && truth <= w.upper);
		}
	}
	return { bayes, wald };
}

// Nominal 95%: each parameter must cover in at least 45 of 50 runs.
export const atLeast = (hits: Map<string, number>, min: number) => {
	expect(hits.size).toBeGreaterThan(0);
	for (const [key, h] of hits) expect(h, key).toBeGreaterThanOrEqual(min);
};
