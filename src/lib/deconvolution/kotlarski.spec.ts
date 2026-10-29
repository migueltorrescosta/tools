import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { fitKernel } from './kernel';
import { fitKotlarski } from './kotlarski';
import { l1, truthOnGrid } from './metrics';
import { simulateReplicates } from './sample';
import type { Grid, SimpleSpec } from './types';

const gridOver = (lo: number, hi: number, m = 300): Grid => ({ x0: lo, h: (hi - lo) / (m - 1), m });

function check(y: SimpleSpec, n: number, m: number) {
	const X = makeDist({ family: 'gamma', params: [4, 0.5] }, 'signal');
	const Y = makeDist(y, 'noise');
	const readings = simulateReplicates(X, Y, n, m, 3);
	const gridX = gridOver(-2, 7);
	const gridY = gridOver(-4, 4);
	const r = fitKotlarski({ readings, gridX, gridY });
	// The oracle: kernel deconvolution of all the readings with the true noise, at the same bandwidth.
	const pooled = Float64Array.from(readings.flatMap((c) => Array.from(c)));
	const oracle = fitKernel({ data: pooled, y: Y, grid: gridX, bandwidth: r.bandwidth });
	return {
		x: l1(r.x, truthOnGrid(X, gridX)),
		oracle: l1(oracle, truthOnGrid(X, gridX)),
		y: l1(r.y, truthOnGrid(Y, gridY))
	};
}

describe('fitKotlarski', () => {
	// Y gets its own, smaller bandwidth; the kernel still blunts Laplace's cusp (L₁ 0.26 here).
	it('recovers X within 3× the known-noise kernel and Y itself, under Laplace noise', () => {
		const d = check({ family: 'laplace', params: [0, 0.5] }, 2000, 2);
		expect(d.x).toBeLessThan(3 * d.oracle);
		expect(d.y).toBeLessThan(0.35);
	});

	it('needs no symmetry: a skewed (centred exponential) noise, 3 readings', () => {
		const d = check({ family: 'exponential', params: [1.5] }, 2000, 3);
		expect(d.x).toBeLessThan(3 * d.oracle);
		expect(d.y).toBeLessThan(0.35);
	});
});
