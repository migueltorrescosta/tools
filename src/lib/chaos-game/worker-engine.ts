/**
 * The Chaos Game worker's logic, DOM-free so specs drive it in-process: runs
 * the game in chunks, posting toned frames, and scores the shape against a
 * challenge target.
 */
import {
	BURN_IN,
	Histogram,
	Walker,
	bounds,
	compile,
	fitView,
	shapeGrid,
	similarity,
	tone,
	validate
} from './engine';
import type { Box, ColourMode, Rgb, Setup, View } from './types';

export interface RunRequest {
	type: 'run';
	id: number;
	setup: Setup;
	width: number;
	height: number;
	/** Keep this view (while dragging) instead of fitting the attractor. */
	view: View | null;
	ink: Rgb;
	/** Colours per point for 'point' mode (cycled). */
	palette: Rgb[];
	mode: ColourMode;
	gamma: number;
	/** Jumps to make before stopping. */
	cap: number;
}

export type ToWorker =
	| RunRequest
	| { type: 'tone'; mode: ColourMode; gamma: number }
	| { type: 'stop' }
	| { type: 'continue' }
	| { type: 'target'; id: number; setup: Setup | null; width: number; height: number; ink: Rgb };

export type FromWorker =
	| {
			type: 'frame';
			id: number;
			jumps: number;
			width: number;
			height: number;
			view: View;
			pixels: Uint8ClampedArray;
			/** Pixel box of the hit pixels. */
			box: Box | null;
			/** Shape similarity to the target, 0–1, when one is set. */
			score: number | null;
			running: boolean;
	  }
	| {
			type: 'target';
			id: number;
			width: number;
			height: number;
			pixels: Uint8ClampedArray;
			box: Box;
	  }
	| { type: 'error'; id: number; message: string };

/** Jumps per chunk between checks for new messages. */
export const CHUNK = 250_000;
/** Least time between frames, ms. */
export const FRAME_MS = 100;
/** Jumps behind a challenge's target image and shape. */
export const TARGET_JUMPS = 2_000_000;

interface Run {
	req: RunRequest;
	hist: Histogram;
	walker: Walker;
	running: boolean;
}

export class ChaosRunner {
	private run: Run | null = null;
	private target: Uint8Array | null = null;
	private lastPost = -Infinity;
	private scheduled = false;
	private readonly post: (msg: FromWorker, transfer?: Transferable[]) => void;
	private readonly schedule: (fn: () => void) => void;
	private readonly now: () => number;

	constructor(
		post: (msg: FromWorker, transfer?: Transferable[]) => void,
		schedule: (fn: () => void) => void,
		now: () => number = () => performance.now()
	) {
		this.post = post;
		this.schedule = schedule;
		this.now = now;
	}

	handle(msg: ToWorker): void {
		switch (msg.type) {
			case 'run':
				return this.start(msg);
			case 'tone':
				if (!this.run) return;
				this.run.req = { ...this.run.req, mode: msg.mode, gamma: msg.gamma };
				return this.frame();
			case 'stop':
				if (this.run?.running) {
					this.run.running = false;
					this.frame();
				}
				return;
			case 'continue':
				if (this.run && !this.run.running && this.run.hist.jumps < this.run.req.cap) {
					this.run.running = true;
					this.tick();
				}
				return;
			case 'target':
				return this.setTarget(msg);
		}
	}

	private start(req: RunRequest): void {
		const error = validate(req.setup);
		const c = error ? null : compile(req.setup);
		const box = c && bounds(c, req.setup.seed);
		if (!c || !box) {
			this.run = null;
			this.post({
				type: 'error',
				id: req.id,
				message:
					error ??
					'The points run off to infinity: keep jump ratios between 0 and 1 and matrices shrinking.'
			});
			return;
		}
		const view = req.view ?? fitView(box, req.width, req.height);
		const hist = new Histogram(req.width, req.height, view, req.palette);
		const walker = new Walker(c, req.setup.seed);
		for (let i = 0; i < BURN_IN; i++) walker.step();
		this.run = { req, hist, walker, running: true };
		this.lastPost = -Infinity;
		this.tick();
	}

	private tick(): void {
		if (this.scheduled) return;
		this.scheduled = true;
		this.schedule(() => {
			this.scheduled = false;
			const run = this.run;
			if (!run || !run.running) return;
			const left = run.req.cap - run.hist.jumps;
			run.hist.accumulate(run.walker, Math.min(CHUNK, left));
			if (run.hist.jumps >= run.req.cap) run.running = false;
			if (!run.running || this.now() - this.lastPost >= FRAME_MS) this.frame();
			if (run.running) this.tick();
		});
	}

	private frame(): void {
		const run = this.run;
		if (!run) return;
		const { hist, req } = run;
		this.lastPost = this.now();
		const pixels = tone(hist, { ink: req.ink, mode: req.mode, gamma: req.gamma });
		const grid = this.target ? shapeGrid(hist) : null;
		this.post(
			{
				type: 'frame',
				id: req.id,
				jumps: hist.jumps,
				width: hist.width,
				height: hist.height,
				view: hist.view,
				pixels,
				box: hist.occupiedBox(),
				score: this.target ? (grid ? similarity(grid, this.target) : 0) : null,
				running: run.running
			},
			[pixels.buffer]
		);
	}

	private setTarget(msg: Extract<ToWorker, { type: 'target' }>): void {
		this.target = null;
		if (msg.setup) {
			const c = compile(msg.setup);
			const box = bounds(c, msg.setup.seed);
			if (box) {
				const fitted = new Histogram(msg.width, msg.height, fitView(box, msg.width, msg.height));
				const w = new Walker(c, msg.setup.seed);
				for (let i = 0; i < BURN_IN; i++) w.step();
				fitted.accumulate(w, TARGET_JUMPS);
				this.target = shapeGrid(fitted);
				const pixels = tone(fitted, { ink: msg.ink, mode: 'density', gamma: 2 });
				const occupied = fitted.occupiedBox();
				if (occupied)
					this.post(
						{
							type: 'target',
							id: msg.id,
							width: fitted.width,
							height: fitted.height,
							pixels,
							box: occupied
						},
						[pixels.buffer]
					);
			}
		}
		// Rescore the current run against the new target
		this.frame();
	}
}
