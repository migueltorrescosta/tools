import { describe, expect, it } from 'vitest';
import { polygon } from './engine';
import type { Setup } from './types';
import { CHUNK, ChaosRunner, FRAME_MS, type FromWorker, type RunRequest } from './worker-engine';

/** A runner whose scheduled chunks run only when the spec drains them, on a fake clock. */
function harness() {
	const posts: FromWorker[] = [];
	const queue: (() => void)[] = [];
	let now = 0;
	const runner = new ChaosRunner(
		(m) => posts.push(m),
		(fn) => queue.push(fn),
		() => now
	);
	return {
		runner,
		posts,
		frames: () => posts.filter((m) => m.type === 'frame'),
		/** Run queued chunks, advancing the clock `ms` per chunk, until idle or `limit` chunks. */
		drain(ms = 0, limit = 1000) {
			for (let i = 0; i < limit && queue.length; i++) {
				now += ms;
				queue.shift()!();
			}
		},
		pending: () => queue.length
	};
}

const setup: Setup = { points: polygon(3), ratio: 0.5, rule: { forbid: [] }, seed: 1 };
const request = (over: Partial<RunRequest> = {}): RunRequest => ({
	type: 'run',
	id: 1,
	setup,
	width: 64,
	height: 64,
	view: null,
	ink: [0, 0, 255],
	palette: [[255, 0, 0]],
	mode: 'density',
	gamma: 2,
	cap: CHUNK * 3,
	...over
});

describe('ChaosRunner', () => {
	it('runs to the cap in chunks and posts a final, stopped frame', () => {
		const h = harness();
		h.runner.handle(request());
		h.drain();
		const frames = h.frames();
		const last = frames.at(-1)!;
		expect(last.type === 'frame' && last.jumps).toBe(CHUNK * 3);
		expect(last.type === 'frame' && last.running).toBe(false);
		expect(h.pending()).toBe(0);
	});

	it('posts at most one frame per FRAME_MS while running', () => {
		const h = harness();
		h.runner.handle(request({ cap: CHUNK * 10 }));
		h.drain(FRAME_MS / 2);
		// The first chunk always posts, then every other chunk, then the final one
		expect(h.frames().length).toBe(6);
	});

	it('sends toned pixels of the canvas size, and a fitted view', () => {
		const h = harness();
		h.runner.handle(request());
		h.drain();
		const f = h.frames().at(-1)!;
		if (f.type !== 'frame') throw new Error('no frame');
		expect(f.pixels).toHaveLength(64 * 64 * 4);
		expect(f.pixels.some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
		expect(f.box).not.toBeNull();
		expect(f.view.scale).toBeGreaterThan(0);
		expect(f.score).toBeNull();
	});

	it('keeps a given view while dragging', () => {
		const h = harness();
		const view = { x0: -5, y0: 5, scale: 3 };
		h.runner.handle(request({ view }));
		h.drain();
		const f = h.frames()[0];
		expect(f.type === 'frame' && f.view).toEqual(view);
	});

	it('reports an invalid or diverging setup instead of running', () => {
		const h = harness();
		h.runner.handle(request({ id: 7, setup: { ...setup, points: [] } }));
		expect(h.posts).toEqual([{ type: 'error', id: 7, message: 'Add at least one point.' }]);
		h.runner.handle(
			request({
				id: 8,
				setup: { ...setup, points: polygon(3).map((p) => ({ ...p, matrix: [2, 0, 0, 2] })) }
			})
		);
		expect(h.posts[1]).toMatchObject({ type: 'error', id: 8 });
		expect(h.pending()).toBe(0);
	});

	it('stops and continues where it left off', () => {
		const h = harness();
		h.runner.handle(request());
		h.drain(0, 1);
		h.runner.handle({ type: 'stop' });
		h.drain();
		const stopped = h.frames().at(-1)!;
		expect(stopped.type === 'frame' && [stopped.jumps, stopped.running]).toEqual([CHUNK, false]);
		h.runner.handle({ type: 'continue' });
		h.drain();
		const done = h.frames().at(-1)!;
		expect(done.type === 'frame' && done.jumps).toBe(CHUNK * 3);
		// Nothing left to continue
		const count = h.frames().length;
		h.runner.handle({ type: 'continue' });
		h.drain();
		expect(h.frames().length).toBe(count);
	});

	it('retones the current run without jumping more', () => {
		const h = harness();
		h.runner.handle(request());
		h.drain();
		const before = h.frames().at(-1)!;
		h.runner.handle({ type: 'tone', mode: 'point', gamma: 1 });
		const after = h.frames().at(-1)!;
		if (before.type !== 'frame' || after.type !== 'frame') throw new Error('no frame');
		expect(after.jumps).toBe(before.jumps);
		const lit = after.pixels.findIndex((v, i) => i % 4 === 3 && v > 0) - 3;
		expect(Array.from(after.pixels.slice(lit, lit + 3))).toEqual([255, 0, 0]);
	});

	it('posts the target and scores frames against it', () => {
		const h = harness();
		h.runner.handle(request());
		h.drain();
		h.runner.handle({ type: 'target', id: 3, setup, width: 64, height: 64, ink: [9, 9, 9] });
		const target = h.posts.find((m) => m.type === 'target');
		expect(target).toMatchObject({ type: 'target', id: 3, width: 64, height: 64 });
		const scored = h.frames().at(-1)!;
		expect(scored.type === 'frame' && scored.score).toBeGreaterThan(0.9);
		h.runner.handle({ type: 'target', id: 4, setup: null, width: 64, height: 64, ink: [9, 9, 9] });
		const cleared = h.frames().at(-1)!;
		expect(cleared.type === 'frame' && cleared.score).toBeNull();
	});

	it('drops the old run when a new one starts', () => {
		const h = harness();
		h.runner.handle(request({ id: 1, cap: CHUNK * 5 }));
		h.drain(0, 1);
		h.runner.handle(request({ id: 2 }));
		h.drain();
		const ids = new Set(
			h
				.frames()
				.slice(1)
				.map((f) => f.id)
		);
		expect(ids).toEqual(new Set([2]));
	});
});
