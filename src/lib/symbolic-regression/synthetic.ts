/** Synthetic datasets for specs and benchmarks. */
import { Prng } from '$lib/prng';
import type { PreparedData } from './types';

export interface SyntheticOptions {
	rows: number;
	/** Input ranges, one per input column (ignored for a categorical one). */
	ranges: [number, number][];
	/** Per input: level names to make it categorical, drawn uniformly as codes 0, 1, …; else null. */
	levels?: (string[] | null)[];
	f: (x: number[]) => number;
	/** Relative Gaussian noise on the target. */
	noise?: number;
	validationFraction?: number;
	seed?: number;
	names?: string[];
}

/** Uniform random inputs, `y = f(x)·(1 + noise·N(0,1))`, split train/validation by position. */
export function syntheticData(o: SyntheticOptions): PreparedData {
	const prng = new Prng(o.seed ?? 7);
	const m = o.ranges.length;
	const nVal = Math.round(o.rows * (o.validationFraction ?? 0.2));
	const nTrain = o.rows - nVal;
	const make = (n: number) => ({
		x: Array.from({ length: m }, () => new Float64Array(n)),
		y: new Float64Array(n)
	});
	const train = make(nTrain);
	const validation = make(nVal);
	for (let i = 0; i < o.rows; i++) {
		const set = i < nTrain ? train : validation;
		const r = i < nTrain ? i : i - nTrain;
		const row = o.ranges.map(([lo, hi], j) => {
			const levels = o.levels?.[j];
			return levels ? prng.int(levels.length) : lo + (hi - lo) * prng.next();
		});
		row.forEach((v, j) => (set.x[j][r] = v));
		set.y[r] = o.f(row) * (1 + (o.noise ?? 0) * prng.normal());
	}
	return {
		inputNames: o.names ?? Array.from({ length: m }, (_, j) => `x${j + 1}`),
		levels: Array.from({ length: m }, (_, j) => o.levels?.[j] ?? null),
		targetName: 'y',
		train,
		validation
	};
}
