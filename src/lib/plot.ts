/** A plotted point; `id` makes it selectable. */
export interface Point {
	x: number;
	y: number;
	id?: number;
}

/** Round tick positions covering [lo, hi], about `count` of them. */
export function niceTicks(lo: number, hi: number, count: number): number[] {
	if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return [lo];
	const raw = (hi - lo) / count;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	const ticks: number[] = [];
	for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
		ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
	}
	return ticks;
}

export function formatTick(v: number): string {
	if (v === 0) return '0';
	const a = Math.abs(v);
	if (a >= 1e5 || a < 1e-3) return v.toExponential(1);
	return String(Number(v.toPrecision(4)));
}

/** At most `max` evenly spaced points, so a 50k-row plot stays light. */
export function thin(points: Point[], max: number): Point[] {
	if (points.length <= max) return points;
	const step = points.length / max;
	const out: Point[] = [];
	for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
	return out;
}

/** A linear map from [d0, d1] onto [r0, r1]; a flat domain maps to the middle. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	if (!(d1 !== d0) || !Number.isFinite(d0) || !Number.isFinite(d1)) return () => (r0 + r1) / 2;
	const k = (r1 - r0) / (d1 - d0);
	return (v) => r0 + (v - d0) * k;
}

/**
 * Order of the data tokens for decisions. Light --data-1 and --data-5 are both blue, so the sky
 * blue (--data-5) moves to slot 8 and pink (--data-6) takes slot 5: up to seven decisions never
 * show both blues.
 */
const DATA_ORDER = [1, 2, 3, 4, 6, 7, 8, 5, 9, 10, 11, 12];

/** CSS colour of decision `i` (0-based), cycling through the 12 data colours. */
export function dataColour(i: number): string {
	return `var(--data-${DATA_ORDER[((i % 12) + 12) % 12]})`;
}

/** SVG path through points, skipping non-finite ones (a gap starts a new segment). */
export function linePath(xs: ArrayLike<number>, ys: ArrayLike<number>): string {
	let d = '';
	let pen = false;
	for (let i = 0; i < xs.length; i++) {
		const x = xs[i];
		const y = ys[i];
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
		pen = true;
	}
	return d;
}
