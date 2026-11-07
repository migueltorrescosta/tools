<!--
	The chaos game's plot: the density image on a canvas (millions of hits are
	too many for SVG), a faint challenge target under it, and an SVG layer on top
	for the points' handles and the step-through walk.
-->
<script module lang="ts">
	import type { Box } from '#lib/chaos-game/types.js';

	export interface Frame {
		pixels: Uint8ClampedArray;
		width: number;
		height: number;
		box: Box | null;
	}
	export interface TargetImage {
		pixels: Uint8ClampedArray;
		width: number;
		height: number;
		box: Box;
	}
	export interface StepView {
		/** Earlier positions, oldest first. */
		trail: [number, number][];
		/** Where the last jump started, the point it jumped to, and where it landed. */
		from: [number, number] | null;
		to: number | null;
		at: [number, number];
	}
</script>

<script lang="ts">
	import { toPixel, toWorld } from '#lib/chaos-game/engine.js';
	import type { GamePoint, View } from '#lib/chaos-game/types.js';

	let {
		points,
		selected = $bindable(null),
		view,
		width,
		height,
		frame,
		target = null,
		steps = null,
		label,
		onadd,
		onmove,
		onremove,
		onresize
	}: {
		points: GamePoint[];
		selected?: number | null;
		view: View;
		/** Canvas size in device pixels. */
		width: number;
		height: number;
		frame: Frame | null;
		target?: TargetImage | null;
		steps?: StepView | null;
		/** Describes the image for screen readers. */
		label: string;
		onadd: (x: number, y: number) => void;
		/** `done` is false while dragging and true on release. */
		onmove: (i: number, x: number, y: number, done: boolean) => void;
		onremove: (i: number) => void;
		/** The plot's CSS width changed. */
		onresize: (cssWidth: number) => void;
	} = $props();

	let wrap = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let targetCanvas = $state<HTMLCanvasElement>();
	let svg = $state<SVGSVGElement>();
	let cssWidth = $state(0);

	/** Device pixels per CSS pixel, so handles keep their on-screen size. */
	const k = $derived(cssWidth > 0 ? width / cssWidth : 1);

	$effect(() => {
		if (!wrap) return;
		const ro = new ResizeObserver(([entry]) => {
			cssWidth = entry.contentRect.width;
			onresize(cssWidth);
		});
		ro.observe(wrap);
		return () => ro.disconnect();
	});

	$effect(() => {
		const ctx = canvas?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);
		if (frame && frame.width === width && frame.height === height)
			ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), width, height), 0, 0);
	});

	/** `src` fitted into `dst` with its aspect kept and centred, as the score compares them. */
	function fitInto(src: Box, dst: Box): Box {
		const sw = src.maxX - src.minX;
		const sh = src.maxY - src.minY;
		const dw = dst.maxX - dst.minX;
		const dh = dst.maxY - dst.minY;
		const s = Math.max(dw, dh) / Math.max(sw, sh);
		const cx = (dst.minX + dst.maxX) / 2;
		const cy = (dst.minY + dst.maxY) / 2;
		return {
			minX: cx - (sw * s) / 2,
			minY: cy - (sh * s) / 2,
			maxX: cx + (sw * s) / 2,
			maxY: cy + (sh * s) / 2
		};
	}

	$effect(() => {
		const ctx = targetCanvas?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);
		if (!target) return;
		const src = document.createElement('canvas');
		src.width = target.width;
		src.height = target.height;
		src
			.getContext('2d')
			?.putImageData(
				new ImageData(new Uint8ClampedArray(target.pixels), target.width, target.height),
				0,
				0
			);
		const t = target.box;
		const into = fitInto(t, frame?.box ?? { minX: 0, minY: 0, maxX: width, maxY: height });
		ctx.drawImage(
			src,
			t.minX,
			t.minY,
			t.maxX - t.minX,
			t.maxY - t.minY,
			into.minX,
			into.minY,
			into.maxX - into.minX,
			into.maxY - into.minY
		);
	});

	function devicePoint(e: PointerEvent): [number, number] {
		const rect = svg!.getBoundingClientRect();
		return [
			((e.clientX - rect.left) * width) / rect.width,
			((e.clientY - rect.top) * height) / rect.height
		];
	}

	const round = (v: number) => Math.round(v * 1000) / 1000;

	function world(px: number, py: number): [number, number] {
		const [x, y] = toWorld(view, px, py);
		return [round(x), round(y)];
	}

	let dragging: number | null = null;
	let moved = false;
	let downAt: [number, number] | null = null;
	let pending: [number, number] | null = null;
	let raf = 0;

	function handleDown(e: PointerEvent, i: number) {
		e.stopPropagation();
		selected = i;
		dragging = i;
		moved = false;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function handleMove(e: PointerEvent) {
		if (dragging === null) return;
		moved = true;
		pending = world(...devicePoint(e));
		if (!raf)
			raf = requestAnimationFrame(() => {
				raf = 0;
				if (dragging !== null && pending) onmove(dragging, pending[0], pending[1], false);
			});
	}

	function handleUp(e: PointerEvent) {
		if (dragging === null) return;
		const i = dragging;
		dragging = null;
		cancelAnimationFrame(raf);
		raf = 0;
		if (moved) {
			const [x, y] = world(...devicePoint(e));
			onmove(i, x, y, true);
		}
	}

	function backgroundDown(e: PointerEvent) {
		downAt = devicePoint(e);
	}

	function backgroundUp(e: PointerEvent) {
		if (!downAt) return;
		const [px, py] = devicePoint(e);
		const far = Math.hypot(px - downAt[0], py - downAt[1]) > 6 * k;
		downAt = null;
		if (far) return;
		onadd(...world(px, py));
		selected = points.length;
	}

	function handleKey(e: KeyboardEvent, i: number) {
		const span = Math.max(width, height) / view.scale;
		const step = (e.shiftKey ? 0.05 : 0.01) * span;
		const p = points[i];
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step]
		};
		if (e.key in moves) {
			e.preventDefault();
			const [dx, dy] = moves[e.key];
			onmove(i, round(p.x + dx), round(p.y + dy), true);
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			onremove(i);
			selected = null;
		}
	}

	const handles = $derived(points.map((p) => toPixel(view, p.x, p.y)));
	const fmt = (v: number) => v.toFixed(2).replace('-', '−');
</script>

<div class="plot" bind:this={wrap} style:aspect-ratio="{width} / {height}">
	<canvas class="target" bind:this={targetCanvas} {width} {height} aria-hidden="true"></canvas>
	<canvas bind:this={canvas} {width} {height} aria-hidden="true" data-testid="canvas"></canvas>
	<svg
		bind:this={svg}
		role="group"
		aria-label={label}
		viewBox="0 0 {width} {height}"
		data-testid="plot-overlay"
		onpointermove={handleMove}
		onpointerup={handleUp}
	>
		<!-- Clicking the background adds a point; the points table is the keyboard route -->
		<rect
			class="bg"
			{width}
			{height}
			onpointerdown={backgroundDown}
			onpointerup={backgroundUp}
			data-testid="plot-background"
			role="presentation"
		/>
		{#if steps}
			{@const [ax, ay] = toPixel(view, ...steps.at)}
			<g class="walk" data-testid="walk">
				{#each steps.trail as [x, y], j (j)}
					{@const [px, py] = toPixel(view, x, y)}
					<circle class="trail" cx={px} cy={py} r={2.5 * k} />
				{/each}
				{#if steps.from && steps.to !== null}
					{@const [fx, fy] = toPixel(view, ...steps.from)}
					{@const [tx, ty] = handles[steps.to] ?? [fx, fy]}
					<line class="jump" x1={fx} y1={fy} x2={tx} y2={ty} stroke-width={1.5 * k} />
				{/if}
				<circle class="current" cx={ax} cy={ay} r={5 * k} data-testid="current-point" />
			</g>
		{/if}
		{#each handles as [px, py], i (i)}
			<g
				class="handle"
				class:selected={selected === i}
				class:chosen={steps?.to === i}
				transform="translate({px} {py})"
				tabindex="0"
				role="button"
				aria-label="Point {i + 1} at ({fmt(points[i].x)}, {fmt(
					points[i].y
				)}). Drag or use the arrow keys to move it, Delete to remove it."
				data-testid="handle"
				onpointerdown={(e) => handleDown(e, i)}
				onkeydown={(e) => handleKey(e, i)}
				onfocus={() => (selected = i)}
			>
				<circle class="hit" r={14 * k} />
				<circle class="dot" r={6 * k} stroke-width={2 * k} />
			</g>
		{/each}
	</svg>
</div>

<style>
	.plot {
		position: relative;
		width: min(100%, 80vh);
		margin: 0 auto;
		background: var(--sunken);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		touch-action: none;
	}

	canvas,
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.target {
		opacity: 0.3;
	}

	.bg {
		fill: transparent;
		cursor: crosshair;
	}

	.handle {
		cursor: grab;
		outline: none;
	}

	.hit {
		fill: transparent;
	}

	.dot {
		fill: var(--text);
		stroke: var(--surface);
	}

	.handle.selected .dot,
	.handle:focus-visible .dot {
		fill: var(--accent);
		stroke: var(--text);
	}

	.handle.chosen .dot {
		fill: var(--data-4);
	}

	.trail {
		fill: var(--data-4);
		opacity: 0.5;
	}

	.jump {
		stroke: var(--data-4);
		stroke-dasharray: 4 3;
	}

	.current {
		fill: var(--data-4);
		stroke: var(--surface);
		stroke-width: 2;
	}
</style>
