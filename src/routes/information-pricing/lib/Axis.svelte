<script lang="ts">
	/** Ticks, grid lines and a title for one side of a plot (SVG `<g>`). */
	let {
		side,
		ticks,
		scale,
		at,
		from,
		to,
		format,
		title,
		grid
	}: {
		side: 'bottom' | 'left';
		ticks: readonly number[];
		/** Data value → pixel along the axis. */
		scale: (v: number) => number;
		/** Pixel position of the axis line (y for bottom, x for left). */
		at: number;
		/** Extent of the axis line, in pixels along the axis. */
		from: number;
		to: number;
		format: (v: number) => string;
		title?: string;
		/** Grid lines across the plot, from one pixel to the other (perpendicular to the axis). */
		grid?: [number, number];
	} = $props();
</script>

<g class="axis">
	{#each ticks as t (t)}
		{@const p = scale(t)}
		{#if side === 'bottom'}
			{#if grid}<line class="grid" x1={p} x2={p} y1={grid[0]} y2={grid[1]} />{/if}
			<line class="tick" x1={p} x2={p} y1={at} y2={at + 4} />
			<text x={p} y={at + 16} text-anchor="middle">{format(t)}</text>
		{:else}
			{#if grid}<line class="grid" x1={grid[0]} x2={grid[1]} y1={p} y2={p} />{/if}
			<line class="tick" x1={at - 4} x2={at} y1={p} y2={p} />
			<text x={at - 7} y={p + 4} text-anchor="end">{format(t)}</text>
		{/if}
	{/each}
	{#if side === 'bottom'}
		<line class="base" x1={from} x2={to} y1={at} y2={at} />
		{#if title}<text class="title" x={(from + to) / 2} y={at + 34} text-anchor="middle"
				>{title}</text
			>{/if}
	{:else}
		<line class="base" x1={at} x2={at} y1={from} y2={to} />
		{#if title}<text
				class="title"
				x={12}
				y={(from + to) / 2}
				text-anchor="middle"
				transform="rotate(-90 12 {(from + to) / 2})">{title}</text
			>{/if}
	{/if}
</g>

<style>
	.grid {
		stroke: var(--border);
	}
	.tick,
	.base {
		stroke: var(--border-strong);
	}
	text {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.title {
		font-family: var(--font-sans);
		font-size: 12px;
	}
</style>
