import { describe, expect, it } from 'vitest';
import { render, shapeGrid, similarity, validate } from './engine';
import { CHALLENGES, DEFAULT_SETUP } from './presets';

describe('challenges', () => {
	it('has unique ids that share links accept', () => {
		const ids = CHALLENGES.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
	});

	it('keeps the blog post’s ten patterns first, in its order', () => {
		expect(CHALLENGES.filter((c) => c.fromPost).map((c) => c.name)).toEqual([
			'Sierpinski Triangle',
			'Sierpinski Tetrahedron',
			'Sudoku',
			'Big Sudoku',
			'Octagon',
			'Cursor',
			'Falcon',
			'Perspective',
			'Tic Tac Toe',
			'Trapezoid'
		]);
		expect(CHALLENGES.slice(0, 10).every((c) => c.fromPost)).toBe(true);
	});

	it.each(CHALLENGES.map((c) => [c.name, c] as const))(
		'%s is valid, and its answer solves it from another seed',
		(_, c) => {
			expect(validate(c.setup)).toBeNull();
			const target = shapeGrid(render(c.setup, 300, 300, 1_000_000)!)!;
			const answer = shapeGrid(render({ ...c.setup, seed: 99 }, 300, 300, 1_000_000)!)!;
			// Challenges call a match of 0.9 solved
			expect(similarity(target, answer)).toBeGreaterThan(0.9);
		}
	);

	it('turns each fern point back into Barnsley’s map x ↦ A x + t', () => {
		const fern = CHALLENGES.find((c) => c.id === 'barnsley-fern')!.setup;
		// p + M (x − p) = M x + (p − M p), so t = p − M p
		const t = fern.points.map(({ x, y, matrix: m }) => [
			x - (m![0] * x + m![1] * y),
			y - (m![2] * x + m![3] * y)
		]);
		const expected = [
			[0, 0],
			[0, 1.6],
			[0, 1.6],
			[0, 0.44]
		];
		for (const [i, [tx, ty]] of t.entries()) {
			expect(tx).toBeCloseTo(expected[i][0], 3);
			expect(ty).toBeCloseTo(expected[i][1], 3);
		}
		expect(fern.points.map((p) => p.weight)).toEqual([1, 85, 7, 7]);
	});

	it('starts with the post’s default triangle at one half', () => {
		expect(DEFAULT_SETUP.points).toHaveLength(3);
		expect(DEFAULT_SETUP.ratio).toBe(0.5);
		expect(DEFAULT_SETUP.rule.forbid).toEqual([]);
	});
});
