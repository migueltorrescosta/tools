import { describe, expect, it } from 'vitest';
import { Prng } from '#lib/prng.js';
import { BLOCK_TRIALS, plan, PRACTICE_TRIALS, WARMUP } from './sequence';

const sizes = { target: [6, 8] as [number, number], attribute: [8, 8] as [number, number] };

describe('plan', () => {
	const rng = new Prng(1);
	const p = plan(sizes, sizes, () => rng.next());

	it('has a 16-trial practice block and four 20-trial blocks', () => {
		expect(p.practice).toHaveLength(PRACTICE_TRIALS);
		expect(p.blocks.map((b) => b.length)).toEqual([20, 20, 20, 20].map(() => BLOCK_TRIALS));
	});

	it('alternates the focal target, starting with firstFocal', () => {
		p.blocks.forEach((b, i) => {
			const focal = i % 2 === 0 ? p.firstFocal : 1 - p.firstFocal;
			for (const t of b.filter((t) => t.group === 'target'))
				expect(t.correct).toBe(t.category === focal ? 'right' : 'left');
			for (const t of b.filter((t) => t.group === 'attribute'))
				expect(t.correct).toBe(t.category === 0 ? 'right' : 'left');
		});
	});

	it('opens each block with target-only warm-ups, then alternates and balances', () => {
		for (const b of p.blocks) {
			expect(b.slice(0, WARMUP).every((t) => t.warmup && t.group === 'target')).toBe(true);
			const rest = b.slice(WARMUP);
			rest.forEach((t, i) => expect(t.group).toBe(i % 2 === 0 ? 'target' : 'attribute'));
			for (const group of ['target', 'attribute'] as const)
				for (const c of [0, 1])
					expect(rest.filter((t) => t.group === group && t.category === c)).toHaveLength(4);
		}
	});

	it('draws valid items and picks either target first', () => {
		for (const t of p.blocks.flat()) expect(t.item).toBeLessThan(sizes[t.group][t.category]);
		const firsts = new Set(
			[...Array(20).keys()].map((s) => {
				const r = new Prng(s);
				return plan(sizes, sizes, () => r.next()).firstFocal;
			})
		);
		expect(firsts).toEqual(new Set([0, 1]));
	});
});
