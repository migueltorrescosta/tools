import { fixedPoint, optimalRatio, polygon } from './engine';
import type { GamePoint, Matrix, Setup } from './types';

export interface Challenge {
	id: string;
	name: string;
	/** One line shown with the answer. */
	hint: string;
	/** True for the ten patterns from the 2021 blog post. */
	fromPost: boolean;
	setup: Setup;
}

const pts = (xy: [number, number][]): GamePoint[] => xy.map(([x, y]) => ({ x, y }));

function game(points: GamePoint[], ratio: number, forbid: number[] = []): Setup {
	return { points, ratio, rule: { forbid }, seed: 1 };
}

/** Barnsley's fern as four affine maps x ↦ A x + t, each turned into its fixed point and matrix. */
function fern(): GamePoint[] {
	const maps: [Matrix, [number, number], number][] = [
		[[0, 0, 0, 0.16], [0, 0], 1],
		[[0.85, 0.04, -0.04, 0.85], [0, 1.6], 85],
		[[0.2, -0.26, 0.23, 0.22], [0, 1.6], 7],
		[[-0.15, 0.28, 0.26, 0.24], [0, 0.44], 7]
	];
	return maps.map(([matrix, t, weight]) => {
		const p = fixedPoint(matrix, t);
		const round = (v: number) => Math.round(v * 1e4) / 1e4;
		return { x: round(p.x), y: round(p.y), weight, matrix };
	});
}

/**
 * The blog post's ten patterns, with the points read off its images and each
 * ratio fitted to its image (overlap 0.81–0.95), then the new ones.
 */
export const CHALLENGES: readonly Challenge[] = [
	{
		id: 'sierpinski-triangle',
		name: 'Sierpinski Triangle',
		hint: 'Three corners, jumping a little over halfway.',
		fromPost: true,
		setup: game(
			pts([
				[0, 0.71],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.53
		)
	},
	{
		id: 'sierpinski-tetrahedron',
		name: 'Sierpinski Tetrahedron',
		hint: 'The triangle plus a fourth point inside it.',
		fromPost: true,
		setup: game(
			pts([
				[0, 0.71],
				[0, -0.21],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.59
		)
	},
	{
		id: 'sudoku',
		name: 'Sudoku',
		hint: 'Four corners and a point slightly off the centre.',
		fromPost: true,
		setup: game(
			pts([
				[-1, 0.71],
				[1, 0.71],
				[0.1, 0.04],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.7
		)
	},
	{
		id: 'big-sudoku',
		name: 'Big Sudoku',
		hint: 'Four corners and the centre, with shorter jumps.',
		fromPost: true,
		setup: game(
			pts([
				[-1, 0.71],
				[1, 0.71],
				[0, 0],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.63
		)
	},
	{
		id: 'octagon',
		name: 'Octagon',
		hint: 'Eight points around the centre, and the centre.',
		fromPost: true,
		setup: game(
			pts([
				[0, 0.71],
				[-0.67, 0.47],
				[0.67, 0.47],
				[-1, 0],
				[0, 0],
				[1, 0],
				[-0.67, -0.47],
				[0.67, -0.47],
				[0, -0.71]
			]),
			0.75
		)
	},
	{
		id: 'cursor',
		name: 'Cursor',
		hint: 'Six of the eight corners and edge midpoints.',
		fromPost: true,
		setup: game(
			pts([
				[-1, 0.71],
				[0, 0.71],
				[1, 0.71],
				[1, 0],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.7
		)
	},
	{
		id: 'falcon',
		name: 'Falcon',
		hint: 'Three points in a row, two more above and below the left half.',
		fromPost: true,
		setup: game(
			pts([
				[-0.5, 0.71],
				[-1, 0],
				[0, 0],
				[1, 0],
				[-0.5, -0.71]
			]),
			0.67
		)
	},
	{
		id: 'perspective',
		name: 'Perspective',
		hint: 'A small square of four points and one far corner.',
		fromPost: true,
		setup: game(
			pts([
				[1, 0.71],
				[-1, -0.14],
				[0, -0.14],
				[-1, -0.71],
				[0, -0.71]
			]),
			0.7
		)
	},
	{
		id: 'tic-tac-toe',
		name: 'Tic Tac Toe',
		hint: 'Four corners and a small diamond of four points.',
		fromPost: true,
		setup: game(
			pts([
				[-1, 0.71],
				[1, 0.71],
				[0, 0.35],
				[-0.5, 0],
				[0.5, 0],
				[0, -0.35],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.8
		)
	},
	{
		id: 'trapezoid',
		name: 'Trapezoid',
		hint: 'Four corners of a trapezoid, jumping halfway.',
		fromPost: true,
		setup: game(
			pts([
				[-0.5, 0.71],
				[0.5, 0.71],
				[-1, -0.71],
				[1, -0.71]
			]),
			0.51
		)
	},
	{
		id: 'sierpinski-carpet',
		name: 'Sierpinski Carpet',
		hint: 'A square with its edge midpoints, jumping two thirds.',
		fromPost: false,
		setup: game(polygon(4, true), 2 / 3)
	},
	{
		id: 'vicsek',
		name: 'Vicsek Fractal',
		hint: 'A square and its centre, jumping two thirds.',
		fromPost: false,
		setup: game(polygon(4, false, true), 2 / 3)
	},
	{
		id: 'pentagon',
		name: 'Pentagon',
		hint: 'A pentagon at the ratio where the copies just touch.',
		fromPost: false,
		setup: game(polygon(5), optimalRatio(5))
	},
	{
		id: 'hexagon',
		name: 'Hexagon',
		hint: 'A hexagon, jumping two thirds.',
		fromPost: false,
		setup: game(polygon(6), 2 / 3)
	},
	{
		id: 'square-never-twice',
		name: 'Square, never twice',
		hint: 'A square, halfway, never the same corner twice in a row.',
		fromPost: false,
		setup: game(polygon(4), 0.5, [0])
	},
	{
		id: 'square-not-next',
		name: 'Square, not the next',
		hint: 'A square, halfway, never the corner after the last one.',
		fromPost: false,
		setup: game(polygon(4), 0.5, [1])
	},
	{
		id: 'pentagon-no-neighbour',
		name: 'Pentagon star',
		hint: 'A pentagon, halfway, never a corner next to the last one.',
		fromPost: false,
		setup: game(polygon(5), 0.5, [1, 4])
	},
	{
		id: 'twisted-triangle',
		name: 'Twisted Triangle',
		hint: 'Three corners, halfway, each jump turning 30° about the corner.',
		fromPost: false,
		setup: game(
			polygon(3).map((p) => ({ ...p, rotation: 30 })),
			0.5
		)
	},
	{
		id: 'barnsley-fern',
		name: 'Barnsley Fern',
		hint: 'Four weighted points with their own matrices (Advanced).',
		fromPost: false,
		setup: game(fern(), 0.5)
	}
];

/** The page's starting setup: the post's default triangle, jumping halfway. */
export const DEFAULT_SETUP: Setup = game(polygon(3), 0.5);
