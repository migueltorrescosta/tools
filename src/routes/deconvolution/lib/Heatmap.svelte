<script lang="ts">
	import { Axis } from '$lib/ui';
	import { formatTick, linear, niceTicks } from '$lib/plot';
	import type { Grid2 } from '$lib/deconvolution/dist2';

	/**
	 * A 2D density as shaded cells (at most 48 × 48, averaged from the grid),
	 * darker where denser relative to its own peak, with an optional scatter.
	 */
	let {
		title,
		grid,
		values,
		colour = 'var(--data-1)',
		points,
		box,
		summary,
		testId
	}: {
		title: string;
		grid: Grid2;
		/** Non-negative values on the grid, row-major by y. */
		values: ArrayLike<number>;
		colour?: string;
		/** Sample points drawn over the cells (thinned to 1500). */
		points?: { xs: ArrayLike<number>; ys: ArrayLike<number> };
		/** [xlo, xhi, ylo, yhi] to show; defaults to the grid. */
		box?: [number, number, number, number];
		/** Text alternative read by screen readers. */
		summary: string;
		testId?: string;
	} = $props();

	const MAX_CELLS = 48;
	let width = $state(320);
	const W = $derived(Math.max(220, width));
	const M = { top: 8, right: 10, bottom: 40, left: 46 };
	const H = $derived(Math.round(Math.min(340, Math.max(200, W * 0.8))));

	const extent = $derived<[number, number, number, number]>(
		box ?? [grid.x0, grid.x0 + (grid.mx - 1) * grid.hx, grid.y0, grid.y0 + (grid.my - 1) * grid.hy]
	);
	const sx = $derived(linear(extent[0], extent[1], M.left, W - M.right));
	const sy = $derived(linear(extent[2], extent[3], H - M.bottom, M.top));

	/** Cells: blocks of grid nodes averaged, with opacity relative to the largest. */
	const cells = $derived.by(() => {
		const bx = Math.max(1, Math.ceil(grid.mx / MAX_CELLS));
		const by = Math.max(1, Math.ceil(grid.my / MAX_CELLS));
		const out: { x: number; y: number; w: number; h: number; v: number }[] = [];
		let top = 0;
		for (let j0 = 0; j0 < grid.my; j0 += by) {
			for (let i0 = 0; i0 < grid.mx; i0 += bx) {
				let s = 0;
				let count = 0;
				for (let j = j0; j < Math.min(grid.my, j0 + by); j++)
					for (let i = i0; i < Math.min(grid.mx, i0 + bx); i++) {
						s += values[j * grid.mx + i];
						count++;
					}
				const v = s / count;
				top = Math.max(top, v);
				const xa = grid.x0 + (i0 - 0.5) * grid.hx;
				const xb = grid.x0 + (Math.min(grid.mx, i0 + bx) - 0.5) * grid.hx;
				const ya = grid.y0 + (j0 - 0.5) * grid.hy;
				const yb = grid.y0 + (Math.min(grid.my, j0 + by) - 0.5) * grid.hy;
				out.push({ x: xa, y: yb, w: xb - xa, h: yb - ya, v });
			}
		}
		return out
			.filter((c) => c.v > top * 0.01)
			.map((c) => ({
				x: sx(c.x),
				y: sy(c.y),
				w: Math.max(0.5, sx(c.x + c.w) - sx(c.x)) + 0.4,
				h: Math.max(0.5, sy(c.y - c.h) - sy(c.y)) + 0.4,
				o: Math.sqrt(c.v / top)
			}));
	});

	const dots = $derived.by(() => {
		if (!points) return [];
		const n = points.xs.length;
		const step = Math.max(1, Math.ceil(n / 1500));
		const out: { x: number; y: number }[] = [];
		for (let i = 0; i < n; i += step) {
			const x = points.xs[i];
			const y = points.ys[i];
			if (x >= extent[0] && x <= extent[1] && y >= extent[2] && y <= extent[3])
				out.push({ x: sx(x), y: sy(y) });
		}
		return out;
	});

	const xTicks = $derived(niceTicks(extent[0], extent[1], Math.max(4, Math.floor(W / 70))));
	const yTicks = $derived(niceTicks(extent[2], extent[3], 4));
</script>

<figure class="heatmap" bind:clientWidth={width} data-testid={testId}>
	<figcaption>{title}</figcaption>
	<svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label={summary}>
		<clipPath id="clip-{testId}">
			<rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
		</clipPath>
		<g clip-path="url(#clip-{testId})">
			{#each cells as c, i (i)}
				<rect
					class="cell"
					x={c.x}
					y={c.y}
					width={c.w}
					height={c.h}
					fill={colour}
					fill-opacity={c.o}
				/>
			{/each}
			{#each dots as d, i (i)}
				<circle class="dot" cx={d.x} cy={d.y} r="1.2" />
			{/each}
		</g>
		<Axis
			side="bottom"
			ticks={xTicks}
			scale={sx}
			at={H - M.bottom}
			from={M.left}
			to={W - M.right}
			format={formatTick}
			title="x"
		/>
		<Axis
			side="left"
			ticks={yTicks}
			scale={sy}
			at={M.left}
			from={M.top}
			to={H - M.bottom}
			format={formatTick}
			title="y"
		/>
	</svg>
</figure>

<style>
	.heatmap {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		min-width: 0;
	}
	figcaption {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	svg {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.dot {
		fill: var(--text);
		opacity: 0.3;
	}
</style>
