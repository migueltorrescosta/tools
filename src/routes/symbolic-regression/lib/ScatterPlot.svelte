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
		identityLine = false,
		zeroLine = false,
		connect = false,
		logY = false,
		selectedId = null,
		recommendedId = null,
		onSelect,
		testId,
		pointsLabel = 'Data',
		overlayLabel = 'Overlay'
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

	/** A diamond centred on (x, y), so the recommended point differs by shape, not only colour. */
	const diamond = (x: number, y: number, r: number) =>
		`M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
</script>

<figure class="plot" data-testid={testId}>
	<figcaption>
		<span>{title}</span>
		{#if onSelect}
			<span class="plot-legend" aria-hidden="true">
				<span
					><svg viewBox="0 0 12 12"><path class="recommended" d={diamond(6, 6, 5)} /></svg
					>best</span
				>
				<span
					><svg viewBox="0 0 12 12"><circle class="ring" cx="6" cy="6" r="4.5" /></svg
					>selected</span
				>
			</span>
		{:else if overlay.length > 0}
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
	<svg
		viewBox="0 0 {W} {H}"
		role={onSelect ? 'group' : 'img'}
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
			{@const cx = sx(p.x)}
			{@const cy = sy(p.y)}
			{#if onSelect && p.id !== undefined}
				{@const id = p.id}
				<g
					class="target"
					role="button"
					tabindex="0"
					aria-label="Select complexity {p.x}{recommended ? ' (best)' : ''}"
					aria-pressed={selected}
					data-id={id}
					onclick={() => onSelect(id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onSelect(id);
						}
					}}
				>
					<circle class="hit" {cx} {cy} r={12} />
					{#if selected}<circle class="ring" {cx} {cy} r={9} />{/if}
					{#if recommended}
						<path class="recommended" d={diamond(cx, cy, 6.5)} />
					{:else}
						<circle class="point clickable" {cx} {cy} r={4.5} />
					{/if}
				</g>
			{:else}
				<circle class="point" {cx} {cy} r={2.5} />
			{/if}
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
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
		font-size: var(--text-sm);
		font-weight: 500;
		margin-bottom: var(--sp-1);
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
	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}
	.grid line {
		stroke: var(--border);
	}
	.grid text,
	.label {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.ref {
		stroke: var(--text-muted);
		stroke-dasharray: 4 4;
	}
	.front {
		fill: none;
		stroke: var(--data-1);
		stroke-width: 1.5;
	}
	.point {
		fill: var(--data-1);
		fill-opacity: 0.7;
	}
	.point.clickable {
		fill-opacity: 1;
	}
	.overlay {
		fill: var(--data-4);
		fill-opacity: 0.85;
	}
	.recommended {
		fill: var(--data-2);
		stroke: var(--surface);
		stroke-width: 1;
	}
	.ring {
		fill: none;
		stroke: var(--text);
		stroke-width: 2;
	}
	.target {
		cursor: pointer;
		outline: none;
	}
	.hit {
		fill: transparent;
	}
	.target:hover .hit {
		fill: var(--surface-2);
	}
	.target:focus-visible .hit {
		fill: none;
		stroke: var(--focus-ring);
		stroke-width: 2;
	}
</style>
