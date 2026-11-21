import type { Response } from './types.js';

/** Scoring constants from Nosek et al. (2014); docs/implicit-association.md explains them. */
export const MAX_RT = 10_000;
export const FLOOR = 400;
export const CEILING = 2000;
export const FAST = 300;
export const FAST_SHARE_LIMIT = 0.1;
export const BANDS = { slight: 0.15, moderate: 0.35, strong: 0.65 } as const;

export interface Score {
	/** Positive: target 1 goes with the focal attribute more easily than target 2. */
	d: number;
	/** D of blocks 1-2 and of blocks 3-4. */
	pairs: [number, number];
	/** Share of test-block responses under 300 ms. */
	fastShare: number;
	/** More than 10% of responses under 300 ms: kept, but left out of means. */
	flagged: boolean;
	errorShare: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Sample standard deviation (n - 1). */
export function sd(xs: number[]): number {
	const m = mean(xs);
	return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Score a BIAT run: the D of each block pair, averaged. Null when a pair has no usable trials. */
export function score(responses: readonly Response[], firstFocal: 0 | 1): Score | null {
	const test = responses.filter((r) => r.block >= 0);
	if (test.length === 0) return null;
	const fastShare = test.filter((r) => r.rt < FAST).length / test.length;
	const errorShare = test.filter((r) => r.error).length / test.length;
	const pairs: number[] = [];
	for (const [a, b] of [
		[0, 1],
		[2, 3]
	]) {
		const kept = (block: number) =>
			test
				.filter((r) => r.block === block && !r.warmup && r.rt <= MAX_RT)
				.map((r) => Math.min(CEILING, Math.max(FLOOR, r.rt)));
		// Blocks a and b alternate the focal target: a has `firstFocal`, b the other one.
		const withFirst = kept(firstFocal === 0 ? a : b);
		const withSecond = kept(firstFocal === 0 ? b : a);
		if (withFirst.length === 0 || withSecond.length === 0) return null;
		const s = sd([...withFirst, ...withSecond]);
		pairs.push(s > 0 ? (mean(withSecond) - mean(withFirst)) / s : 0);
	}
	return {
		d: (pairs[0] + pairs[1]) / 2,
		pairs: [pairs[0], pairs[1]],
		fastShare,
		flagged: fastShare > FAST_SHARE_LIMIT,
		errorShare
	};
}

export type Band = 'none' | 'slight' | 'moderate' | 'strong';

export function band(d: number): Band {
	const a = Math.abs(d);
	if (a >= BANDS.strong) return 'strong';
	if (a >= BANDS.moderate) return 'moderate';
	if (a >= BANDS.slight) return 'slight';
	return 'none';
}

/** Two-sided 95% t quantiles for 1-30 degrees of freedom; 1.96 beyond. */
const T95 = [
	12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145,
	2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048,
	2.045, 2.042
];

/** Mean and 95% confidence interval of the mean; the interval needs at least 3 values. */
export function summarise(xs: readonly number[]): { mean: number; ci?: [number, number] } {
	const m = mean([...xs]);
	if (xs.length < 3) return { mean: m };
	const half = (T95[xs.length - 2] ?? 1.96) * (sd([...xs]) / Math.sqrt(xs.length));
	return { mean: m, ci: [m - half, m + half] };
}
