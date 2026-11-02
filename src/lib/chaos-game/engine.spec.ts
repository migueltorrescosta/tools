import { describe, expect, it } from 'vitest';
import {
	BURN_IN,
	Histogram,
	Walker,
	bounds,
	compile,
	fitView,
	fixedPoint,
	linearPart,
	optimalRatio,
	polygon,
	render,
	shapeGrid,
	similarity,
	toPixel,
	toWorld,
	tone,
	validate
} from './engine';
import type { GamePoint, Matrix, Setup } from './types';

const game = (points: GamePoint[], ratio = 0.5, forbid: number[] = [], seed = 1): Setup => ({
	points,
	ratio,
	rule: { forbid },
	seed
});

/**
 * Box-counting dimension of the hit pixels: the slope of log N(ε) against
 * log(1/ε) over box sizes from 2 to size/8 pixels.
 */
function boxDimension(h: Histogram): number {
	const xs: number[] = [];
	const ys: number[] = [];
	for (let s = 2; s <= Math.min(h.width, h.height) / 8; s *= 2) {
		const cols = Math.ceil(h.width / s);
		const seen = new Set<number>();
		for (let y = 0; y < h.height; y++)
			for (let x = 0; x < h.width; x++)
				if (h.counts[y * h.width + x]) seen.add(Math.floor(y / s) * cols + Math.floor(x / s));
		xs.push(Math.log(1 / s));
		ys.push(Math.log(seen.size));
	}
	const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
	const my = ys.reduce((a, b) => a + b, 0) / ys.length;
	let num = 0;
	let den = 0;
	for (let i = 0; i < xs.length; i++) {
		num += (xs[i] - mx) * (ys[i] - my);
		den += (xs[i] - mx) ** 2;
	}
	return num / den;
}

describe('linearPart', () => {
	it('scales by 1 − r for a plain ratio, the game ratio by default', () => {
		expect(linearPart({ x: 0, y: 0 }, 0.25)).toEqual([0.75, -0, 0, 0.75]);
		expect(linearPart({ x: 0, y: 0, ratio: 0.6 }, 0.25)[0]).toBeCloseTo(0.4);
	});

	it('rotates anticlockwise by the given degrees', () => {
		const [a, b, c, d] = linearPart({ x: 0, y: 0, rotation: 90 }, 0.5);
		expect([a, b, c, d].map((v) => Math.round(v * 1e9) / 1e9 + 0)).toEqual([0, -0.5, 0.5, 0]);
	});

	it('uses the matrix as given, ignoring ratio and rotation', () => {
		const m: Matrix = [0.1, 0.2, 0.3, 0.4];
		expect(linearPart({ x: 0, y: 0, ratio: 0.9, rotation: 45, matrix: m }, 0.5)).toBe(m);
	});
});

describe('validate', () => {
	const tri = polygon(3);

	it('accepts the default triangle', () => {
		expect(validate(game(tri))).toBeNull();
	});

	it.each([
		[game([]), 'Add at least one point.'],
		[game(polygon(33)), 'Use at most 32 points.'],
		[game(tri, 0), 'The jump ratio must be between 0 and 1.'],
		[game(tri, 1), 'The jump ratio must be between 0 and 1.'],
		[game([{ x: NaN, y: 0 }]), 'Point 1 needs numeric coordinates.'],
		[game([tri[0], { ...tri[1], weight: -1 }]), "Point 2's weight must be zero or more."],
		[game([{ ...tri[0], ratio: 1.5 }]), "Point 1's jump ratio must be between 0 and 1."],
		[game([{ ...tri[0], rotation: Infinity }]), "Point 1's rotation must be a number."],
		[game([{ ...tri[0], matrix: [1, NaN, 0, 1] }]), "Point 1's matrix needs numbers."],
		[game(tri.map((p) => ({ ...p, weight: 0 }))), 'Give at least one point a weight above zero.'],
		[game([tri[0]], 0.5, [0]), 'The rule leaves nothing to pick after point 1.']
	])('rejects %#', (setup, message) => {
		expect(validate(setup)).toBe(message);
	});

	it('accepts a zero weight while another point can still be picked', () => {
		expect(validate(game([tri[0], { ...tri[1], weight: 0 }]))).toBeNull();
	});
});

describe('compile', () => {
	it('drops forbidden offsets after each last point, and allows all at the start', () => {
		const c = compile(game(polygon(4), 0.5, [1, -1]));
		expect(Array.from(c.allowed[0])).toEqual([0, 2]);
		expect(Array.from(c.allowed[3])).toEqual([1, 3]);
		expect(Array.from(c.allowed[4])).toEqual([0, 1, 2, 3]);
	});

	it('normalises cumulative weights to end at 1, skipping zero weights', () => {
		const pts = polygon(3).map((p, i) => ({ ...p, weight: [1, 0, 3][i] }));
		const c = compile(game(pts));
		expect(Array.from(c.allowed[3])).toEqual([0, 2]);
		expect(Array.from(c.cumulative[3])).toEqual([0.25, 1]);
	});
});

describe('Walker', () => {
	it('starts at the centroid and jumps the ratio of the way to the chosen point', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 4, y: 0 }
		];
		const w = new Walker(compile(game(pts, 0.25)), 7);
		expect([w.x, w.y]).toEqual([2, 0]);
		const k = w.step();
		expect(w.x).toBeCloseTo(2 + 0.25 * (pts[k].x - 2));
		expect(w.last).toBe(k);
	});

	it('starts where told', () => {
		const w = new Walker(compile(game(polygon(3))), 1, { x: 5, y: -2 });
		expect([w.x, w.y]).toEqual([5, -2]);
	});

	it('is reproducible for a seed and differs across seeds', () => {
		const c = compile(game(polygon(5)));
		const seq = (seed: number) => {
			const w = new Walker(c, seed);
			return Array.from({ length: 50 }, () => w.step());
		};
		expect(seq(3)).toEqual(seq(3));
		expect(seq(3)).not.toEqual(seq(4));
	});

	it('never picks a forbidden offset', () => {
		const n = 5;
		const w = new Walker(compile(game(polygon(n), 0.5, [0, 1])), 2);
		let last = w.step();
		for (let i = 0; i < 5000; i++) {
			const k = w.step();
			expect([0, 1]).not.toContain((k - last + n) % n);
			last = k;
		}
	});

	it('picks points in proportion to their weights', () => {
		const pts = polygon(3).map((p, i) => ({ ...p, weight: [1, 2, 7][i] }));
		const w = new Walker(compile(game(pts)), 5);
		const counts = [0, 0, 0];
		const N = 100_000;
		for (let i = 0; i < N; i++) counts[w.step()]++;
		expect(counts[0] / N).toBeCloseTo(0.1, 2);
		expect(counts[1] / N).toBeCloseTo(0.2, 2);
		expect(counts[2] / N).toBeCloseTo(0.7, 2);
	});

	it('applies a matrix about its point', () => {
		const pts: GamePoint[] = [{ x: 1, y: 1, matrix: [0, -1, 1, 0] }];
		const w = new Walker(compile(game(pts)), 1, { x: 2, y: 1 });
		w.step();
		expect([w.x, w.y]).toEqual([1, 2]);
	});
});

describe('bounds', () => {
	it('covers the attractor and the points', () => {
		const box = bounds(compile(game(polygon(3))), 1)!;
		expect(box.minX).toBeCloseTo(-Math.sqrt(3) / 2, 5);
		expect(box.maxX).toBeCloseTo(Math.sqrt(3) / 2, 5);
		expect(box.maxY).toBe(1);
		expect(box.minY).toBeCloseTo(-0.5, 2);
	});

	it('includes points far from the attractor', () => {
		const pts: GamePoint[] = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10, weight: 0 }
		];
		expect(bounds(compile(game(pts)), 1)!.maxX).toBe(10);
	});

	it('is null when the maps blow up', () => {
		const pts: GamePoint[] = polygon(3).map((p) => ({ ...p, matrix: [1.5, 0, 0, 1.5] }));
		expect(bounds(compile(game(pts)), 1)).toBeNull();
	});
});

describe('views', () => {
	const box = { minX: -2, minY: -1, maxX: 2, maxY: 1 };

	it('fits a box with a margin and centres it', () => {
		const v = fitView(box, 200, 200, 0.1);
		expect(v.scale).toBe(40);
		expect(toPixel(v, -2, 0)).toEqual([20, 100]);
		expect(toPixel(v, 2, 1)).toEqual([180, 60]);
	});

	it('maps back from pixels to the world', () => {
		const v = fitView(box, 300, 150);
		const [x, y] = toWorld(v, ...toPixel(v, 0.7, -0.3));
		expect(x).toBeCloseTo(0.7);
		expect(y).toBeCloseTo(-0.3);
	});

	it('survives a single point', () => {
		const v = fitView({ minX: 1, minY: 1, maxX: 1, maxY: 1 }, 100, 100);
		expect(Number.isFinite(v.scale)).toBe(true);
		expect(toPixel(v, 1, 1).map(Math.round)).toEqual([50, 50]);
	});
});

describe('Histogram', () => {
	it('counts each in-view jump once and tracks the maximum', () => {
		const s = game(polygon(3));
		const h = new Histogram(64, 64, fitView(bounds(compile(s), 1)!, 64, 64));
		h.accumulate(new Walker(compile(s), 1), 10_000);
		expect(h.jumps).toBe(10_000);
		expect(h.counts.reduce((a, b) => a + b, 0)).toBe(10_000);
		expect(h.max).toBe(Math.max(...h.counts));
	});

	it('ignores jumps outside the view', () => {
		const h = new Histogram(10, 10, { x0: 100, y0: 100, scale: 1 });
		h.accumulate(new Walker(compile(game(polygon(3))), 1), 1000);
		expect(h.counts.every((c) => c === 0)).toBe(true);
		expect(h.occupiedBox()).toBeNull();
	});

	it('sums the colour of the point each hit came from', () => {
		const pts = [{ x: 0.5, y: -0.5 }];
		const h = new Histogram(1, 1, { x0: 0, y0: 0, scale: 1 }, [[10, 20, 30]]);
		h.accumulate(new Walker(compile(game(pts)), 1, { x: 0.5, y: -0.5 }), 3);
		expect(h.counts[0]).toBe(3);
		expect(Array.from(h.colours!)).toEqual([30, 60, 90]);
	});

	it('boxes the hit pixels, exclusive at the far edge', () => {
		const h = new Histogram(8, 8, { x0: 0, y0: 0, scale: 1 });
		h.counts[2 * 8 + 3] = 1;
		h.counts[5 * 8 + 6] = 4;
		expect(h.occupiedBox()).toEqual({ minX: 3, minY: 2, maxX: 7, maxY: 6 });
	});
});

describe('tone', () => {
	const h = new Histogram(3, 1, { x0: 0, y0: 0, scale: 1 }, [[0, 0, 255]]);
	h.counts.set([0, 1, 99]);
	h.colours!.set([0, 0, 0, 255, 0, 0, 0, 0, 99 * 255]);
	h.max = 99;

	it('leaves empty pixels transparent and makes the densest opaque', () => {
		const px = tone(h, { ink: [1, 2, 3], mode: 'density', gamma: 1 });
		expect(px[3]).toBe(0);
		expect(px[11]).toBe(255);
		expect(Array.from(px.slice(8, 11))).toEqual([1, 2, 3]);
	});

	it('scales alpha by log density to the power 1/gamma, above a floor', () => {
		const at = (gamma: number) => tone(h, { ink: [0, 0, 0], mode: 'density', gamma })[7];
		const a = Math.log(2) / Math.log(100);
		expect(at(1)).toBe(Math.round(40 + 215 * a));
		expect(at(2)).toBe(Math.round(40 + 215 * Math.sqrt(a)));
	});

	it('averages the summed colours in point mode', () => {
		const px = tone(h, { ink: [0, 0, 0], mode: 'point', gamma: 1 });
		expect(Array.from(px.slice(4, 7))).toEqual([255, 0, 0]);
		expect(Array.from(px.slice(8, 11))).toEqual([0, 0, 255]);
	});
});

describe('shape matching', () => {
	const grid = (s: Setup, size = 200) => shapeGrid(render(s, size, size, 300_000)!)!;
	const tri = game(polygon(3));

	it('scores the same game near 1 whatever the seed, position or size', () => {
		const moved = game(
			polygon(3).map((p) => ({ x: 3 * p.x + 5, y: 3 * p.y - 2 })),
			0.5,
			[],
			9
		);
		expect(similarity(grid(tri), grid(moved))).toBeGreaterThan(0.9);
		expect(similarity(grid(tri, 200), grid(tri, 300))).toBeGreaterThan(0.85);
	});

	it('scores different shapes low', () => {
		expect(similarity(grid(tri), grid(game(polygon(4, true), 2 / 3)))).toBeLessThan(0.5);
		expect(similarity(grid(tri), grid(game(polygon(3), 0.6)))).toBeLessThan(0.8);
	});

	it('is null with nothing hit, and 0 between empty grids', () => {
		expect(shapeGrid(new Histogram(4, 4, { x0: 0, y0: 0, scale: 1 }))).toBeNull();
		expect(similarity(new Uint8Array(4), new Uint8Array(4))).toBe(0);
	});
});

describe('polygon', () => {
	it('puts n vertices on the unit circle, a vertex at the top for odd n', () => {
		const p = polygon(5);
		expect(p).toHaveLength(5);
		for (const q of p) expect(Math.hypot(q.x, q.y)).toBeCloseTo(1, 5);
		expect(p[0]).toEqual({ x: 0, y: 1 });
	});

	it('stands even polygons on a flat edge', () => {
		const ys = polygon(6).map((p) => p.y);
		const low = Math.min(...ys);
		expect(ys.filter((y) => Math.abs(y - low) < 1e-9)).toHaveLength(2);
		expect(polygon(4)[0].x).toBeCloseTo(Math.SQRT1_2, 5);
	});

	it('goes anticlockwise, with midpoints after their vertex and the centre last', () => {
		const p = polygon(4, true, true);
		expect(p).toHaveLength(9);
		expect(p[1].x).toBeCloseTo(0, 6);
		expect(p[1].y).toBeCloseTo(Math.SQRT1_2, 5);
		expect(p[2].x).toBeLessThan(0);
		expect(p[8]).toEqual({ x: 0, y: 0 });
	});
});

describe('optimalRatio', () => {
	it.each([
		[3, 0.5],
		[4, 0.5],
		[5, (Math.sqrt(5) - 1) / 2],
		[6, 2 / 3],
		[8, 1 - 1 / (2 + Math.SQRT2)]
	])('n = %i', (n, r) => {
		expect(optimalRatio(n)).toBeCloseTo(r, 10);
	});
});

describe('fixedPoint', () => {
	it('solves A p + t = p', () => {
		const a: Matrix = [0.2, -0.26, 0.23, 0.22];
		const t: [number, number] = [0, 1.6];
		const p = fixedPoint(a, t);
		expect(a[0] * p.x + a[1] * p.y + t[0]).toBeCloseTo(p.x, 12);
		expect(a[2] * p.x + a[3] * p.y + t[1]).toBeCloseTo(p.y, 12);
	});
});

describe('the Sierpinski triangle', () => {
	it('has box-counting dimension log 3 / log 2', () => {
		const h = render(game(polygon(3)), 512, 512, 3_000_000)!;
		expect(h.jumps).toBe(3_000_000);
		expect(BURN_IN).toBeGreaterThan(0);
		expect(boxDimension(h)).toBeCloseTo(Math.log(3) / Math.log(2), 1);
	});

	it('fills the square at ratio one half, near dimension 2 (edges pull a finite image down)', () => {
		const d = boxDimension(render(game(polygon(4)), 256, 256, 3_000_000)!);
		expect(d).toBeGreaterThan(1.85);
		expect(d).toBeLessThanOrEqual(2);
	});
});
