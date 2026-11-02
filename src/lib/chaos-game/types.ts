/** 2×2 matrix [a, b, c, d] = [[a, b], [c, d]]. */
export type Matrix = [number, number, number, number];

/**
 * One point of the chaos game. A jump towards it moves the current point x to
 * p + M (x − p), where p is the point and M its linear part: (1 − r)·R(θ) for a
 * jump ratio r and rotation θ, or `matrix` when set (a general affine map with p
 * as its fixed point).
 */
export interface GamePoint {
	x: number;
	y: number;
	/** Relative chance of picking this point; default 1. */
	weight?: number;
	/** Fraction of the way to jump towards the point, in (0, 1); default the game's ratio. */
	ratio?: number;
	/** Degrees, anticlockwise; default 0. */
	rotation?: number;
	/** Overrides ratio and rotation. */
	matrix?: Matrix;
}

/** Which point may follow which. */
export interface Rule {
	/**
	 * Forbidden offsets from the last point's index, modulo the number of points:
	 * [] any point, [0] never the same twice, [1, n − 1] never a neighbour.
	 */
	forbid: number[];
}

export interface Setup {
	points: GamePoint[];
	/** Default jump ratio for points without their own. */
	ratio: number;
	rule: Rule;
	seed: number;
}

export type ColourMode = 'density' | 'point';

/** World → pixel mapping: px = (x − x0)·scale, py = (y0 − y)·scale. */
export interface View {
	x0: number;
	y0: number;
	scale: number;
}

export interface Box {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** RGB in 0–255. */
export type Rgb = [number, number, number];
