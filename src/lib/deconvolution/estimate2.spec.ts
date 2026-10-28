import { describe, expect, it } from 'vitest';
import { Prng } from '$lib/prng';
import { makeDist2, type Noise2Spec, type Spec2 } from './dist2';
import { runTask } from './estimate';
import { sampleLogLik2, truthOnGrid2, unavailable2 } from './estimate2';
import { supportGrid2 } from './npmle2';
import { slicedW1 } from './metrics2';

const x: Spec2 = { family: 'gauss2', params: [0, 0, 1, 0.7, 0.4] };
const y: Noise2Spec = { family: 'gauss2', params: [0, 0, 0.4, 0.4, 0] };
const X = makeDist2(x, 'signal');
const Y = makeDist2(y, 'noise');
const prng = new Prng(5);
const n = 1500;
const xs = new Float64Array(n);
const ys = new Float64Array(n);
for (let i = 0; i < n; i++) {
	const [a, b] = X.sampler(prng);
	const [c, d] = Y.sampler(prng);
	xs[i] = a + c;
	ys[i] = b + d;
}
const grid = supportGrid2(xs, ys, 40);

describe('2D tasks', { timeout: 60_000 }, () => {
	it('unavailable2: the mixture needs Gaussian noise', () => {
		expect(unavailable2('gmm', y)).toBeNull();
		expect(
			unavailable2('gmm', {
				family: 'product',
				x: { family: 'laplace', params: [0, 1] },
				y: { family: 'laplace', params: [0, 1] }
			})
		).toMatch(/Gaussian noise/);
		expect(unavailable2('npmle', y)).toBeNull();
	});

	it.each(['npmle', 'gmm'] as const)(
		'%s returns masses on the grid close to the truth',
		(method) => {
			const r = runTask({ kind: 'grid2', method, xs, ys, y, grid, seed: 1 });
			if (r.kind !== 'grid2') throw new Error('wrong kind');
			expect(r.result.mass.length).toBe(grid.mx * grid.my);
			expect(r.result.mass.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
			expect(slicedW1(r.result, truthOnGrid2(x, grid))).toBeLessThan(0.15);
			const flat = {
				grid,
				mass: new Float64Array(grid.mx * grid.my).fill(1 / (grid.mx * grid.my))
			};
			expect(r.result.logLik).toBeGreaterThan(sampleLogLik2(xs, ys, y, flat));
		}
	);

	it('bootstrap2 returns one reproducible mass vector per resample', () => {
		const task = {
			kind: 'bootstrap2' as const,
			method: 'gmm' as const,
			xs,
			ys,
			y,
			grid,
			seed: 3,
			count: 2
		};
		const a = runTask(task);
		const b = runTask(task);
		if (a.kind !== 'bootstrap2' || b.kind !== 'bootstrap2') throw new Error('wrong kind');
		expect(a.masses.length).toBe(2);
		expect(a.masses).toEqual(b.masses);
	});
});
