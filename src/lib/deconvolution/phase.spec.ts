import { describe, expect, it } from 'vitest';
import { makeDist } from './dist';
import { fitKernel } from './kernel';
import { l1, truthOnGrid } from './metrics';
import { fitPhase } from './phase';
import { simulate } from './sample';
import type { Grid, SimpleSpec } from './types';

const grid: Grid = { x0: -2, h: 9 / 299, m: 300 };

/**
 * L₁ to a gamma signal of the phase estimate (which isn't told the noise),
 * the known-noise kernel and the naive one (no noise removed), at the same bandwidth.
 * Delaigle & Hall found the phase estimate within about 5% of the known-noise one.
 */
function check(y: SimpleSpec) {
	const X = makeDist({ family: 'gamma', params: [4, 0.5] }, 'signal');
	const Y = makeDist(y, 'noise');
	const data = simulate(X, Y, 2000, 5);
	const truth = truthOnGrid(X, grid);
	const r = fitPhase({ data, grid, seed: 1 });
	const known = fitKernel({ data, y: Y, grid, bandwidth: r.bandwidth });
	const none = makeDist({ family: 'normal', params: [0, 1e-6] }, 'noise');
	const naive = fitKernel({ data, y: none, grid, bandwidth: r.bandwidth });
	return { phase: l1(r, truth), known: l1(known, truth), naive: l1(naive, truth), varY: r.varY };
}

describe('fitPhase', { timeout: 60_000 }, () => {
	it('gamma signal, Laplace noise of unknown shape', () => {
		const d = check({ family: 'laplace', params: [0, 0.4] });
		expect(d.phase).toBeLessThan(d.naive);
		expect(d.phase).toBeLessThan(1.3 * d.known);
	});
	it('gamma signal, Student t noise (ν = 6) of unknown shape', () => {
		const d = check({ family: 'studentT', params: [6, 0, 0.35] });
		expect(d.phase).toBeLessThan(d.naive);
		expect(d.phase).toBeLessThan(1.3 * d.known);
	});
});
