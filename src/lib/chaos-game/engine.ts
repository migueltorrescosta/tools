import { Prng } from '#lib/prng.ts';
import type { Box, GamePoint, Matrix, Rgb, Setup, View } from './types';

/** Most points a game may have. */
export const MAX_POINTS = 32;
/** Jumps skipped before plotting, so the starting point's transient never shows. */
export const BURN_IN = 32;

/** A setup turned into maps and choice tables, ready to iterate. */
export interface Compiled {
	n: number;
	/** Fixed points, as [x0, y0, x1, y1, …]. */
	px: Float64Array;
	/** Linear parts, as [a, b, c, d] per point. */
	m: Float64Array;
	/**
	 * For each last index (and n for "no point yet"): the allowed indices and
	 * their cumulative weights, normalised so the last one is 1.
	 */
	allowed: Int32Array[];
	cumulative: Float64Array[];
}

/** The linear part of a point's map. */
export function linearPart(point: GamePoint, ratio: number): Matrix {
	if (point.matrix) return point.matrix;
	const s = 1 - (point.ratio ?? ratio);
	const t = ((point.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(t);
	const sin = Math.sin(t);
	return [s * cos, -s * sin, s * sin, s * cos];
}

/** Why a setup can't run, or null. */
export function validate(setup: Setup): string | null {
	const n = setup.points.length;
	if (n === 0) return 'Add at least one point.';
	if (n > MAX_POINTS) return `Use at most ${MAX_POINTS} points.`;
	if (!(setup.ratio > 0 && setup.ratio < 1)) return 'The jump ratio must be between 0 and 1.';
	for (const [i, p] of setup.points.entries()) {
		const name = `Point ${i + 1}`;
		if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return `${name} needs numeric coordinates.`;
		if (p.weight !== undefined && !(p.weight >= 0 && Number.isFinite(p.weight)))
			return `${name}'s weight must be zero or more.`;
		if (p.ratio !== undefined && !(p.ratio > 0 && p.ratio < 1))
			return `${name}'s jump ratio must be between 0 and 1.`;
		if (p.rotation !== undefined && !Number.isFinite(p.rotation))
			return `${name}'s rotation must be a number.`;
		if (p.matrix && !p.matrix.every(Number.isFinite)) return `${name}'s matrix needs numbers.`;
	}
	const c = compile(setup);
	if (c.allowed[n].length === 0) return 'Give at least one point a weight above zero.';
	for (let last = 0; last < n; last++)
		if (c.allowed[last].length === 0)
			return `The rule leaves nothing to pick after point ${last + 1}.`;
	return null;
}

/** Offsets normalised into 0..n−1, deduplicated. */
export function forbiddenOffsets(forbid: readonly number[], n: number): Set<number> {
	return new Set(forbid.map((k) => ((Math.round(k) % n) + n) % n));
}

export function compile(setup: Setup): Compiled {
	const n = setup.points.length;
	const px = new Float64Array(2 * n);
	const m = new Float64Array(4 * n);
	const weights = setup.points.map((p) => p.weight ?? 1);
	for (const [i, p] of setup.points.entries()) {
		px[2 * i] = p.x;
		px[2 * i + 1] = p.y;
		m.set(linearPart(p, setup.ratio), 4 * i);
	}
	const forbid = n > 0 ? forbiddenOffsets(setup.rule.forbid, n) : new Set<number>();
	const allowed: Int32Array[] = [];
	const cumulative: Float64Array[] = [];
	for (let last = 0; last <= n; last++) {
		const ids: number[] = [];
		for (let k = 0; k < n; k++) {
			if (weights[k] <= 0) continue;
			if (last < n && forbid.has((k - last + n) % n)) continue;
			ids.push(k);
		}
		const cum = new Float64Array(ids.length);
		let total = 0;
		for (const [j, k] of ids.entries()) cum[j] = total += weights[k];
		for (let j = 0; j < cum.length; j++) cum[j] /= total;
		allowed.push(Int32Array.from(ids));
		cumulative.push(cum);
	}
	return { n, px, m, allowed, cumulative };
}

/** The chaos game's current point; `step` jumps once and returns the chosen index. */
export class Walker {
	x: number;
	y: number;
	/** Index of the last point jumped to, or n before the first jump. */
	last: number;
	private readonly rng: Prng;
	private readonly c: Compiled;

	constructor(c: Compiled, seed: number, start?: { x: number; y: number }) {
		this.c = c;
		this.rng = new Prng(seed);
		this.last = c.n;
		if (start) {
			this.x = start.x;
			this.y = start.y;
		} else {
			// The centroid of the points, so the first jumps stay on screen
			let sx = 0;
			let sy = 0;
			for (let i = 0; i < c.n; i++) {
				sx += c.px[2 * i];
				sy += c.px[2 * i + 1];
			}
			this.x = c.n ? sx / c.n : 0;
			this.y = c.n ? sy / c.n : 0;
		}
	}

	step(): number {
		const ids = this.c.allowed[this.last];
		const cum = this.c.cumulative[this.last];
		let j = 0;
		if (ids.length > 1) {
			const u = this.rng.next();
			while (j < cum.length - 1 && u >= cum[j]) j++;
		}
		const k = ids[j];
		const m = this.c.m;
		const ax = this.c.px[2 * k];
		const ay = this.c.px[2 * k + 1];
		const dx = this.x - ax;
		const dy = this.y - ay;
		this.x = ax + m[4 * k] * dx + m[4 * k + 1] * dy;
		this.y = ay + m[4 * k + 2] * dx + m[4 * k + 3] * dy;
		this.last = k;
		return k;
	}
}

/**
 * Bounding box of the attractor (sampled) and the points. Null when the walk
 * runs off to infinity, i.e. the maps don't contract.
 */
export function bounds(c: Compiled, seed: number, samples = 20000): Box | null {
	const w = new Walker(c, seed);
	for (let i = 0; i < BURN_IN; i++) w.step();
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < samples; i++) {
		w.step();
		if (w.x < minX) minX = w.x;
		if (w.x > maxX) maxX = w.x;
		if (w.y < minY) minY = w.y;
		if (w.y > maxY) maxY = w.y;
	}
	for (let i = 0; i < c.n; i++) {
		minX = Math.min(minX, c.px[2 * i]);
		maxX = Math.max(maxX, c.px[2 * i]);
		minY = Math.min(minY, c.px[2 * i + 1]);
		maxY = Math.max(maxY, c.px[2 * i + 1]);
	}
	const span = Math.max(maxX - minX, maxY - minY);
	if (!Number.isFinite(span) || span > 1e6) return null;
	return { minX, minY, maxX, maxY };
}

/** The view that fits `box` into a width × height canvas with a margin, centred. */
export function fitView(box: Box, width: number, height: number, margin = 0.05): View {
	const w = Math.max(box.maxX - box.minX, 1e-9);
	const h = Math.max(box.maxY - box.minY, 1e-9);
	const scale = Math.min((width * (1 - 2 * margin)) / w, (height * (1 - 2 * margin)) / h);
	return {
		x0: (box.minX + box.maxX) / 2 - width / 2 / scale,
		y0: (box.minY + box.maxY) / 2 + height / 2 / scale,
		scale
	};
}

export function toPixel(view: View, x: number, y: number): [number, number] {
	return [(x - view.x0) * view.scale, (view.y0 - y) * view.scale];
}

export function toWorld(view: View, px: number, py: number): [number, number] {
	return [view.x0 + px / view.scale, view.y0 - py / view.scale];
}

/** Hit counts per pixel and, when colouring by point, the summed colours of the points that led there. */
export class Histogram {
	readonly counts: Uint32Array;
	/** RGB sums per pixel: each hit adds the colour of the point just jumped to (palette[k mod length]). */
	readonly colours: Float32Array | null;
	readonly width: number;
	readonly height: number;
	readonly view: View;
	private readonly palette: Rgb[] | null;
	jumps = 0;
	max = 0;

	constructor(width: number, height: number, view: View, palette: Rgb[] | null = null) {
		this.width = width;
		this.height = height;
		this.view = view;
		this.palette = palette;
		this.counts = new Uint32Array(width * height);
		this.colours = palette?.length ? new Float32Array(width * height * 3) : null;
	}

	/** Make `jumps` jumps with `walker` and count where each lands. */
	accumulate(walker: Walker, jumps: number): void {
		const { width, height, counts, colours } = this;
		const palette = this.palette ?? [];
		const { x0, y0, scale } = this.view;
		let max = this.max;
		for (let i = 0; i < jumps; i++) {
			const k = walker.step();
			const px = Math.floor((walker.x - x0) * scale);
			const py = Math.floor((y0 - walker.y) * scale);
			if (px < 0 || py < 0 || px >= width || py >= height) continue;
			const at = py * width + px;
			const c = ++counts[at];
			if (c > max) max = c;
			if (colours) {
				const col = palette[k % palette.length];
				colours[3 * at] += col[0];
				colours[3 * at + 1] += col[1];
				colours[3 * at + 2] += col[2];
			}
		}
		this.max = max;
		this.jumps += jumps;
	}

	/** Pixel box of every hit pixel, or null when nothing landed. */
	occupiedBox(): Box | null {
		const { width, height, counts } = this;
		let minX = width;
		let minY = height;
		let maxX = -1;
		let maxY = -1;
		for (let y = 0; y < height; y++) {
			const row = y * width;
			for (let x = 0; x < width; x++) {
				if (counts[row + x] === 0) continue;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
		return maxX < 0 ? null : { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
	}
}

export interface ToneOptions {
	/** Colour for density mode, or when the histogram has no colours. */
	ink: Rgb;
	mode: 'density' | 'point';
	/** Brightness exponent: alpha = (log(1 + c) / log(1 + max))^(1/gamma). */
	gamma: number;
}

/**
 * RGBA pixels on a transparent background: log density sets the alpha, so the
 * page's surface shows through in either theme (the fractal-flame mapping).
 */
export function tone(h: Histogram, opts: ToneOptions, out?: Uint8ClampedArray): Uint8ClampedArray {
	const n = h.width * h.height;
	const rgba = out ?? new Uint8ClampedArray(4 * n);
	const logMax = Math.log1p(h.max) || 1;
	const inv = 1 / opts.gamma;
	const colours = opts.mode === 'point' ? h.colours : null;
	for (let i = 0; i < n; i++) {
		const c = h.counts[i];
		const o = 4 * i;
		if (c === 0) {
			rgba[o + 3] = 0;
			continue;
		}
		const a = Math.pow(Math.log1p(c) / logMax, inv);
		if (colours) {
			rgba[o] = colours[3 * i] / c;
			rgba[o + 1] = colours[3 * i + 1] / c;
			rgba[o + 2] = colours[3 * i + 2] / c;
		} else {
			rgba[o] = opts.ink[0];
			rgba[o + 1] = opts.ink[1];
			rgba[o + 2] = opts.ink[2];
		}
		// A floor keeps single hits visible
		rgba[o + 3] = 40 + 215 * a;
	}
	return rgba;
}

/**
 * The hit pixels on a size × size grid over their own bounding box (longer side
 * spanning the grid, centred), so shapes compare regardless of position and scale.
 */
export function shapeGrid(h: Histogram, size = 48): Uint8Array | null {
	const box = h.occupiedBox();
	if (!box) return null;
	const grid = new Uint8Array(size * size);
	const w = box.maxX - box.minX;
	const hh = box.maxY - box.minY;
	const span = Math.max(w, hh);
	const offX = (span - w) / 2;
	const offY = (span - hh) / 2;
	for (let y = box.minY; y < box.maxY; y++) {
		const gy = Math.min(size - 1, Math.floor(((y - box.minY + offY + 0.5) / span) * size));
		for (let x = box.minX; x < box.maxX; x++) {
			if (h.counts[y * h.width + x] === 0) continue;
			const gx = Math.min(size - 1, Math.floor(((x - box.minX + offX + 0.5) / span) * size));
			grid[gy * size + gx] = 1;
		}
	}
	return grid;
}

/** Intersection over union of two occupancy grids, 0–1. */
export function similarity(a: Uint8Array, b: Uint8Array): number {
	let both = 0;
	let either = 0;
	for (let i = 0; i < a.length; i++) {
		if (a[i] && b[i]) both++;
		if (a[i] || b[i]) either++;
	}
	return either === 0 ? 0 : both / either;
}

/** Render a setup to a histogram of the given size, fitted to its own bounds. */
export function render(
	setup: Setup,
	width: number,
	height: number,
	jumps: number,
	palette: Rgb[] | null = null
): Histogram | null {
	const c = compile(setup);
	const box = bounds(c, setup.seed);
	if (!box) return null;
	const h = new Histogram(width, height, fitView(box, width, height), palette);
	const w = new Walker(c, setup.seed);
	for (let i = 0; i < BURN_IN; i++) w.step();
	h.accumulate(w, jumps);
	return h;
}

/**
 * The jump ratio at which an n-gon's copies just touch (Wikipedia's "optimal"
 * contraction s = 1 / (2 (1 + Σ_{k=1}^{⌊n/4⌋} cos(2πk/n))), as r = 1 − s).
 */
export function optimalRatio(n: number): number {
	let sum = 0;
	for (let k = 1; k <= Math.floor(n / 4); k++) sum += Math.cos((2 * Math.PI * k) / n);
	return 1 - 1 / (2 * (1 + sum));
}

/**
 * A regular n-gon of radius 1 standing on a flat edge, listed anticlockwise from
 * the top; each edge's midpoint follows its first vertex, the centre comes last.
 */
export function polygon(n: number, midpoints = false, centre = false): GamePoint[] {
	const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
	const at = (t: number, r = 1): GamePoint => ({
		x: round(r * Math.sin(t)),
		y: round(r * Math.cos(t))
	});
	// Odd n has a vertex at the top; even n is turned half a step so its bottom edge is flat
	const start = n % 2 === 0 ? Math.PI / n : 0;
	const angle = (i: number) => start - (2 * Math.PI * i) / n;
	const points: GamePoint[] = [];
	for (let i = 0; i < n; i++) {
		points.push(at(angle(i)));
		if (midpoints) {
			const a = at(angle(i));
			const b = at(angle(i + 1));
			points.push({ x: round((a.x + b.x) / 2), y: round((a.y + b.y) / 2) });
		}
	}
	if (centre) points.push({ x: 0, y: 0 });
	return points;
}

/** The fixed point p of x ↦ A x + t, i.e. (I − A)⁻¹ t. */
export function fixedPoint(a: Matrix, t: [number, number]): { x: number; y: number } {
	const [p, q, r, s] = [1 - a[0], -a[1], -a[2], 1 - a[3]];
	const det = p * s - q * r;
	return { x: (s * t[0] - q * t[1]) / det, y: (-r * t[0] + p * t[1]) / det };
}
