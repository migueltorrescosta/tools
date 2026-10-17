<script lang="ts">
	import { niceTicks, formatTick, type Point } from './plot';

	interface Props {
		points: Point[];
		/** A second series drawn on top (model predictions). */
		overlay?: Point[];
		xLabel: string;
		yLabel: string;
		title: string;
		/** Draw y = x across the plot (predicted vs actual). */
		identityLine?: boolean;
		/** Draw y = 0 (residuals). */
		zeroLine?: boolean;
		/** Join the points in x order (Pareto front). */
		connect?: boolean;
		logY?: boolean;
		selectedId?: number | null;
		recommendedId?: number | null;
		/** Makes points clickable. */
		onSelect?: (id: number) => void;
		testId?: string;
	}

	let {
		points,
		overlay = [],
		xLabel,
		yLabel,
		title,
		identityLine = false,
		zeroLine = false,
		connect = false,
		logY = false,
		selectedId = null,
		recommendedId = null,
		onSelect,
		testId
	}: Props = $props();

	const W = 420;
	const H = 280;
	const M = { top: 12, right: 14, bottom: 44, left: 62 };
	const innerW = W - M.left - M.right;
	const innerH = H - M.top - M.bottom;

	const ty = (v: number) => (logY ? Math.log10(Math.max(v, Number.MIN_VALUE)) : v);

	const shown = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!logY || p.y > 0);
	const visible = $derived(points.filter(shown));
	const visibleOverlay = $derived(overlay.filter(shown));

	const domain = $derived.by(() => {
		if (visible.length === 0) return { x0: 0, x1: 1, y0: 0, y1: 1 };
		let x0 = Infinity;
		let x1 = -Infinity;
		let y0 = Infinity;
		let y1 = -Infinity;
		for (const p of [...visible, ...visibleOverlay]) {
			const y = ty(p.y);
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
	const sy = (v: number) =>
		M.top + innerH - ((ty(v) - domain.y0) / (domain.y1 - domain.y0)) * innerH;
	const syRaw = (y: number) =>
		M.top + innerH - ((y - domain.y0) / (domain.y1 - domain.y0)) * innerH;

	const xTicks = $derived(niceTicks(domain.x0, domain.x1, 5));
	const yTicks = $derived(niceTicks(domain.y0, domain.y1, 5));

	const path = $derived(
		connect
			? [...visible]
					.sort((a, b) => a.x - b.x)
					.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
					.join('')
			: ''
	);
</script>

<figure class="plot" data-testid={testId}>
	<figcaption>{title}</figcaption>
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
		<g class="grid">
			{#each xTicks as t (t)}
				<line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
				<text x={sx(t)} y={M.top + innerH + 16} text-anchor="middle">{formatTick(t)}</text>
			{/each}
			{#each yTicks as t (t)}
				<line x1={M.left} x2={M.left + innerW} y1={syRaw(t)} y2={syRaw(t)} />
				<text x={M.left - 6} y={syRaw(t) + 4} text-anchor="end"
					>{logY ? `1e${formatTick(t)}` : formatTick(t)}</text
				>
			{/each}
		</g>
		{#if identityLine}
			<line
				class="ref"
				x1={sx(domain.x0)}
				y1={syRaw(domain.x0)}
				x2={sx(domain.x1)}
				y2={syRaw(domain.x1)}
			/>
		{/if}
		{#if zeroLine}
			<line class="ref" x1={M.left} x2={M.left + innerW} y1={syRaw(0)} y2={syRaw(0)} />
		{/if}
		{#if connect}
			<path class="front" d={path} />
		{/if}
		{#each visible as p, i (p.id ?? i)}
			{@const selected = p.id !== undefined && p.id === selectedId}
			{@const recommended = p.id !== undefined && p.id === recommendedId}
			{#if onSelect && p.id !== undefined}
				{@const id = p.id}
				<circle
					class="point clickable"
					class:selected
					class:recommended
					cx={sx(p.x)}
					cy={sy(p.y)}
					r={selected ? 7 : 5}
					role="button"
					tabindex="0"
					aria-label="Select complexity {p.x}"
					data-id={id}
					onclick={() => onSelect(id)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(id)}
				/>
			{:else}
				<circle class="point" cx={sx(p.x)} cy={sy(p.y)} r={2.5} />
			{/if}
		{/each}
		{#each visibleOverlay as p, i (i)}
			<circle class="overlay" cx={sx(p.x)} cy={sy(p.y)} r={2} />
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
</figure>

<style>
	.plot {
		margin: 0;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		padding: 0.5rem;
	}
	figcaption {
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
		margin-bottom: 0.25rem;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.grid line {
		stroke: rgba(255, 255, 255, 0.08);
	}
	.grid text,
	.label {
		fill: var(--futuristic-text-dim);
		font-size: 11px;
		font-family: 'JetBrains Mono', monospace;
	}
	.ref {
		stroke: var(--futuristic-magenta);
		stroke-dasharray: 4 4;
		opacity: 0.7;
	}
	.front {
		fill: none;
		stroke: var(--futuristic-blue);
		stroke-width: 1.5;
	}
	.point {
		fill: var(--futuristic-cyan);
		opacity: 0.75;
	}
	.overlay {
		fill: var(--futuristic-magenta);
		opacity: 0.8;
	}
	.clickable {
		cursor: pointer;
		opacity: 1;
	}
	.recommended {
		fill: #ffd84d;
	}
	.selected {
		stroke: #fff;
		stroke-width: 2;
	}
</style>
