import { describe, it, expect } from 'vitest';
import { initState, propose, recordRound, type SplitState } from '../engine';
import { bestResponse, makeCase } from './harness';

/**
 * Plays `rounds` truthful rounds after a Start that places every other item,
 * then times one more propose + recordRound (ms).
 */
function timeRound(n: number, m: number, rounds: number): number {
	const c = makeCase(n, m, 0.3, 1);
	const start = c.entered.map((_, k) => (k % 2 ? -1 : k % n));
	let s: SplitState = initState(c.entered, n, undefined, start);
	const play = () => {
		const p = propose(s);
		s = recordRound(
			s,
			p,
			c.truth.map((v) => bestResponse(v, p))
		);
	};
	for (let r = 0; r < rounds; r++) play();
	const t0 = performance.now();
	play();
	return performance.now() - t0;
}

describe('split engine performance', () => {
	it('fits 6 people × 30 items in well under the 50 ms budget', () => {
		// Measured ≈ 6 ms on fugaku; the bound leaves room for slow CI runners.
		expect(timeRound(6, 30, 20)).toBeLessThan(250);
	});

	// Budget 2 s after ~50 rounds; measured ≈ 1.7 s in Node on fugaku. Takes
	// about 90 s, so it only runs with SPLIT_BENCH=1.
	it.skipIf(!process.env.SPLIT_BENCH)(
		'fits 10 people × 500 items within 2 s after 50 rounds',
		() => {
			expect(timeRound(10, 500, 50)).toBeLessThan(2000);
		},
		300_000
	);
});
