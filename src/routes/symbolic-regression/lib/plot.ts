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
