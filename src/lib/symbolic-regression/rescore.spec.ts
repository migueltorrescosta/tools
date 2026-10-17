import { describe, expect, it } from 'vitest';
import { mergeFront } from './rescore';
import type { Expr } from './types';

const x: Expr = { kind: 'var', index: 0 };
const candidate = (complexity: number, trainMse: number) => ({
	complexity,
	expr: x,
	trainMse,
	valMse: trainMse,
	valR2: 0.9,
	valRmse: Math.sqrt(trainMse)
});

describe('mergeFront', () => {
	it('keeps the best per complexity and drops entries that do not improve on simpler ones', () => {
		const front = mergeFront([
			candidate(3, 0.5),
			candidate(1, 1),
			candidate(3, 0.2),
			candidate(5, 0.3),
			candidate(7, 0.1)
		]);
		expect(front.map((f) => [f.complexity, f.trainMse])).toEqual([
			[1, 1],
			[3, 0.2],
			[7, 0.1]
		]);
		expect(front[0].score).toBe(0);
	});

	it('drops a more complex entry whose gain is only rounding noise', () => {
		const front = mergeFront([candidate(3, 0.00225194), candidate(6, 0.00225194 * (1 - 1e-9))]);
		expect(front.map((f) => f.complexity)).toEqual([3]);
	});
});
