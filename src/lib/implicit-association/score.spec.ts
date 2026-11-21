import { describe, expect, it } from 'vitest';
import { band, score, sd, summarise } from './score';
import type { Response } from './types';

/** A block of 20 responses: 4 warm-ups at `warm` ms, then 16 at the given latencies. */
function block(index: number, rts: number[], warm = 5000): Response[] {
	return [...Array(4).fill(warm), ...rts].map((rt, i) => ({
		block: index,
		group: 'target',
		category: 0,
		item: 0,
		correct: 'right',
		warmup: i < 4,
		rt,
		error: false,
		input: 'keyboard'
	}));
}

const fill = (a: number, b: number) => [...Array(8).fill(a), ...Array(8).fill(b)];

describe('score', () => {
	it('computes D per block pair from the inclusive SD and averages the pairs', () => {
		// Pair 1: focal-first block at 500/700 (mean 600), other at 700/900 (mean 800).
		const first = fill(500, 700);
		const second = fill(700, 900);
		const all = [...first, ...second];
		const expected = (800 - 600) / sd(all);
		const s = score(
			[...block(0, first), ...block(1, second), ...block(2, first), ...block(3, second)],
			0
		)!;
		expect(s.pairs[0]).toBeCloseTo(expected, 10);
		expect(s.d).toBeCloseTo(expected, 10);
		// Hand check: deviations ±200 for 16 values, ±0 for 16 -> SD = sqrt(16*40000/31).
		expect(expected).toBeCloseTo(200 / Math.sqrt((16 * 40000) / 31), 10);
	});

	it('reverses the sign when the other target came first', () => {
		const first = fill(500, 700);
		const second = fill(700, 900);
		const responses = [
			...block(0, first),
			...block(1, second),
			...block(2, first),
			...block(3, second)
		];
		expect(score(responses, 1)!.d).toBeCloseTo(-score(responses, 0)!.d, 10);
	});

	it('ignores warm-ups, drops trials over 10 s and recodes to 400-2000 ms', () => {
		const a = (i: number) => block(i, [...Array(15).fill(400), 100], 1);
		const b = (i: number) => {
			const x = block(i, [...Array(15).fill(2000), 9000]);
			return [...x.slice(0, 19), { ...x[19], rt: 20_000 }];
		};
		const s = score([...a(0), ...b(1), ...a(2), ...b(3)], 0)!;
		// Block a: all 400 after recoding; block b: 15 at 2000 (the 20 s trial is dropped).
		const xs = [...Array(16).fill(400), ...Array(15).fill(2000)];
		expect(s.d).toBeCloseTo(1600 / sd(xs), 10);
	});

	it('flags runs with more than 10% of responses under 300 ms', () => {
		const fast = (i: number) => block(i, [...Array(8).fill(250), ...Array(8).fill(600)]);
		const slow = (i: number) => block(i, fill(700, 900));
		const s = score([...fast(0), ...slow(1), ...fast(2), ...slow(3)], 0)!;
		expect(s.fastShare).toBeCloseTo(16 / 80);
		expect(s.flagged).toBe(true);
	});

	it('scores only test blocks and returns null without them', () => {
		expect(score(block(-1, fill(500, 600)), 0)).toBeNull();
	});
});

describe('band', () => {
	it('uses the 0.15 / 0.35 / 0.65 thresholds on |D|', () => {
		expect([0.1, -0.15, 0.4, -0.7].map(band)).toEqual(['none', 'slight', 'moderate', 'strong']);
	});
});

describe('summarise', () => {
	it('gives the mean, and a t-based 95% CI from 3 values', () => {
		expect(summarise([0.2, 0.4])).toEqual({ mean: 0.30000000000000004 });
		const { mean, ci } = summarise([0.1, 0.3, 0.5]);
		expect(mean).toBeCloseTo(0.3);
		// SD 0.2, SE 0.2/sqrt(3), t(2) = 4.303.
		expect(ci![1] - mean).toBeCloseTo((4.303 * 0.2) / Math.sqrt(3), 10);
	});
});
