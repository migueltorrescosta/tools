<script lang="ts">
	import type { Snippet } from 'svelte';
	import { niceTicks, formatTick, type Point } from '$lib/plot';

	interface Props {
		points: Point[];
		/** A second series drawn on top (model predictions). */
		overlay?: Point[];
		xLabel: string;
		yLabel: string;
		title: string;
		/** Replaces the title in the caption, e.g. to hold a control; `title` still labels the plot. */
		caption?: Snippet;
		/** Chart height at 420 px wide; it scales with the width, within bounds. */
		height?: number;
		/** Draw y = x across the plot (predicted vs actual). */
		identityLine?: boolean;
		/** Draw y = 0 (residuals). */
		zeroLine?: boolean;
		testId?: string;
		/** Legend names for the two series; shown when there is an overlay. */
		pointsLabel?: string;
		overlayLabel?: string;
	}

	let {
		points,
		overlay = [],
		xLabel,
		yLabel,
		title,
		caption,
		height = 280,
		identityLine = false,
		zeroLine = false,
		testId,
		pointsLabel = 'Data',
		overlayLabel = 'Overlay'
	}: Props = $props();

	/** The SVG is drawn at its rendered width, so its text stays at the CSS px size. */
	let width = $state(420);
	const W = $derived(Math.max(240, width));
	/** `height` is the height at 420 px wide; the chart keeps that aspect ratio within bounds. */
	const H = $derived(Math.round(Math.min(height * 1.25, Math.max(200, (W * height) / 420))));
	const M = { top: 12, right: 16, bottom: 44, left: 62 };
	const innerW = $derived(W - M.left - M.right);
	const innerH = $derived(H - M.top - M.bottom);

	const shown = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
	const visible = $derived(points.filter(shown));
	const visibleOverlay = $derived(overlay.filter(shown));

	const domain = $derived.by(() => {
		if (visible.length === 0) return { x0: 0, x1: 1, y0: 0, y1: 1 };
		let x0 = Infinity;
		let x1 = -Infinity;
		let y0 = Infinity;
		let y1 = -Infinity;
		for (const p of [...visible, ...visibleOverlay]) {
			const y = p.y;
			if (p.x < x0) x0 = p.x;
			if (p.x > x1) x1 = p.x;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
		}
		if (identityLine) {
			x0 = y0 = Math.min(x0, y0);
			x1 = y1 = Math.max(x1, y1);
		}
		if (zeroLine) {
			y0 = Math.min(y0, 0);
			y1 = Math.max(y1, 0);
		}
		const padX = x1 > x0 ? (x1 - x0) * 0.05 : 1;
		const padY = y1 > y0 ? (y1 - y0) * 0.05 : 1;
		return { x0: x0 - padX, x1: x1 + padX, y0: y0 - padY, y1: y1 + padY };
	});

	const sx = (x: number) => M.left + ((x - domain.x0) / (domain.x1 - domain.x0)) * innerW;
	const sy = (y: number) => M.top + innerH - ((y - domain.y0) / (domain.y1 - domain.y0)) * innerH;

	const xTicks = $derived(niceTicks(domain.x0, domain.x1, 5));
	const yTicks = $derived(niceTicks(domain.y0, domain.y1, 5));
</script>

<figure class="plot" data-testid={testId}>
	<figcaption>
		<span class="title"
			>{#if caption}{@render caption()}{:else}{title}{/if}</span
		>
		{#if overlay.length > 0}
			<span class="plot-legend" aria-hidden="true">
				<span
					><svg viewBox="0 0 12 12"><circle class="point" cx="6" cy="6" r="3" /></svg
					>{pointsLabel}</span
				>
				<span
					><svg viewBox="0 0 12 12"><rect class="overlay" x="3" y="3" width="6" height="6" /></svg
					>{overlayLabel}</span
				>
			</span>
		{/if}
	</figcaption>
	<div class="fit-chart" bind:clientWidth={width}>
		<svg
			viewBox="0 0 {W} {H}"
			width={W}
			height={H}
			role="img"
			aria-label={overlay.length > 0
				? `${title}: ${pointsLabel} as dots, ${overlayLabel} as squares`
				: title}
		>
			<g class="grid">
				{#each xTicks as t (t)}
					<line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
					<text x={sx(t)} y={M.top + innerH + 16} text-anchor="middle">{formatTick(t)}</text>
				{/each}
				{#each yTicks as t (t)}
					<line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
					<text x={M.left - 6} y={sy(t) + 4} text-anchor="end">{formatTick(t)}</text>
				{/each}
			</g>
			{#if identityLine}
				<line
					class="ref"
					x1={sx(domain.x0)}
					y1={sy(domain.x0)}
					x2={sx(domain.x1)}
					y2={sy(domain.x1)}
				/>
			{/if}
			{#if zeroLine}
				<line class="ref" x1={M.left} x2={M.left + innerW} y1={sy(0)} y2={sy(0)} />
			{/if}
			{#each visible as p, i (i)}
				<circle class="point" cx={sx(p.x)} cy={sy(p.y)} r={2.5} />
			{/each}
			{#each visibleOverlay as p, i (i)}
				<rect class="overlay" x={sx(p.x) - 2} y={sy(p.y) - 2} width={4} height={4} />
			{/each}
			<text class="label" x={M.left + innerW / 2} y={H - 6} text-anchor="middle">{xLabel}</text>
			<text
				class="label"
				x={14}
				y={M.top + innerH / 2}
				text-anchor="middle"
				transform="rotate(-90 14 {M.top + innerH / 2})">{yLabel}</text
			>
		</svg>
	</div>
</figure>

<style>
	.plot {
		margin: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--sp-2);
		min-width: 0;
	}
	figcaption {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
		font-size: var(--text-sm);
		font-weight: 500;
		margin-bottom: var(--sp-1);
	}
	.title {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.plot-legend {
		display: inline-flex;
		gap: var(--sp-3);
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.plot-legend > span {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.plot-legend svg {
		width: 12px;
		height: 12px;
	}
	.grid line {
		stroke: var(--border);
	}
	.grid text,
	.label {
		fill: var(--text-muted);
		font-size: 12px;
		font-family: var(--font-mono);
	}
	.ref {
		stroke: var(--text-muted);
		stroke-dasharray: 4 4;
	}
	.point {
		fill: var(--data-1);
		fill-opacity: 0.7;
	}
	.overlay {
		fill: var(--data-4);
		fill-opacity: 0.85;
	}
</style>
