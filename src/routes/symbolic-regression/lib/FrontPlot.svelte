<script lang="ts">
	import type { Snippet } from 'svelte';
	import { niceTicks, formatTick } from '$lib/plot';
	import type { FrontEntry } from '$lib/symbolic-regression/types';

	interface Props {
		front: FrontEntry[];
		/** Colour of each entry, matching the equation list. */
		colors: string[];
		selected: number;
		recommended: number;
		/** The entry hovered in the equation list, highlighted here. */
		highlighted?: number | null;
		onSelect: (index: number) => void;
		/** Called with the entry hovered or focused here, and null when it leaves. */
		onHover?: (index: number | null) => void;
		/** viewBox height; the width is fixed, so this sets the aspect ratio. */
		height?: number;
		/** Tooltip body for one entry. */
		tooltip: Snippet<[number]>;
	}

	let {
		front,
		colors,
		selected,
		recommended,
		highlighted = null,
		onSelect,
		onHover,
		height = 280,
		tooltip
	}: Props = $props();

	const W = 420;
	const H = $derived(height);
	const M = { top: 12, right: 14, bottom: 44, left: 52 };
	const innerW = W - M.left - M.right;
	const innerH = $derived(H - M.top - M.bottom);

	const shown = $derived(
		front.map((f, i) => ({ f, i })).filter(({ f }) => Number.isFinite(f.valR2))
	);

	const domain = $derived.by(() => {
		if (shown.length === 0) return { x0: 0, x1: 2, y0: 0, y1: 1 };
		let x0 = Infinity;
		let x1 = -Infinity;
		let y1 = 0;
		for (const { f } of shown) {
			x0 = Math.min(x0, f.complexity);
			x1 = Math.max(x1, f.complexity);
			y1 = Math.max(y1, f.valR2);
		}
		// R² below 0 (worse than the mean) sits on the floor
		return { x0: x0 - 1, x1: x1 + 1, y0: 0, y1: Math.min(1, y1) + 0.05 };
	});

	const sx = (x: number) => M.left + ((x - domain.x0) / (domain.x1 - domain.x0)) * innerW;
	const sy = (y: number) =>
		M.top + innerH - ((Math.max(y, 0) - domain.y0) / (domain.y1 - domain.y0)) * innerH;

	/** Whole-number ticks only: complexity is a node count. */
	const xTicks = $derived.by(() => {
		const ticks = niceTicks(domain.x0, domain.x1, 6).filter(Number.isInteger);
		const lo = Math.ceil(domain.x0);
		const hi = Math.floor(domain.x1);
		return ticks.length >= 2 ? ticks : Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
	});
	const yTicks = $derived(niceTicks(domain.y0, domain.y1, 5).filter((t) => t <= 1));

	const path = $derived(
		shown
			.map(
				({ f }, k) =>
					`${k === 0 ? 'M' : 'L'}${sx(f.complexity).toFixed(1)},${sy(f.valR2).toFixed(1)}`
			)
			.join('')
	);

	/** A diamond centred on (x, y), so the best point differs by shape, not only colour. */
	const diamond = (x: number, y: number, r: number) =>
		`M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;

	let hovered = $state<number | null>(null);
	function hover(i: number | null) {
		hovered = i;
		onHover?.(i);
	}
	const tipPos = $derived.by(() => {
		if (hovered === null || !front[hovered]) return null;
		const f = front[hovered];
		const left = (sx(f.complexity) / W) * 100;
		const top = (sy(f.valR2) / H) * 100;
		return { left, top, flip: left > 55, below: top < 45 };
	});
</script>

<figure class="plot" data-testid="pareto-plot">
	<figcaption>
		<span>Complexity against validation R²</span>
		<span class="plot-legend" aria-hidden="true">
			<span
				><svg viewBox="0 0 12 12"><path class="recommended" d={diamond(6, 6, 5)} /></svg>best</span
			>
			<span
				><svg viewBox="0 0 12 12"><circle class="ring" cx="6" cy="6" r="4.5" /></svg>selected</span
			>
			<span
				><svg viewBox="0 0 12 12"><circle class="floor" cx="6" cy="6" r="3.5" /></svg>R² &lt; 0</span
			>
		</span>
	</figcaption>
	<div class="canvas">
		<svg
			viewBox="0 0 {W} {H}"
			role="group"
			aria-label="Pareto front: complexity against validation R²"
		>
			<g class="grid">
				{#each xTicks as t (t)}
					<line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
					<text x={sx(t)} y={M.top + innerH + 16} text-anchor="middle">{t}</text>
				{/each}
				{#each yTicks as t (t)}
					<line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
					<text x={M.left - 6} y={sy(t) + 4} text-anchor="end">{formatTick(t)}</text>
				{/each}
			</g>
			<path class="front" d={path} />
			{#each shown as { f, i } (f.complexity)}
				{@const cx = sx(f.complexity)}
				{@const cy = sy(f.valR2)}
				{@const isBest = i === recommended}
				<g
					class="target"
					class:highlighted={i === highlighted}
					role="button"
					tabindex="0"
					aria-label="Select the equation of complexity {f.complexity}{isBest ? ' (best)' : ''}"
					aria-pressed={i === selected}
					data-id={i}
					data-complexity={f.complexity}
					data-r2={f.valR2}
					style:--c={colors[i]}
					onclick={() => onSelect(i)}
					onmouseenter={() => hover(i)}
					onmouseleave={() => hover(null)}
					onfocus={() => hover(i)}
					onblur={() => hover(null)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onSelect(i);
						} else if (e.key === 'Escape') hover(null);
					}}
				>
					<circle class="hit" {cx} {cy} r={12} />
					{#if i === selected}<circle class="ring" {cx} {cy} r={9} />{/if}
					{#if isBest}
						<path class="recommended" d={diamond(cx, cy, 6.5)} />
					{:else if f.valR2 < 0}
						<circle class="floor" {cx} {cy} r={4.5} />
					{:else}
						<circle class="point" {cx} {cy} r={4.5} />
					{/if}
				</g>
			{/each}
			<text class="label" x={M.left + innerW / 2} y={H - 6} text-anchor="middle"
				>Complexity (nodes)</text
			>
			<text
				class="label"
				x={14}
				y={M.top + innerH / 2}
				text-anchor="middle"
				transform="rotate(-90 14 {M.top + innerH / 2})">Validation R²</text
			>
		</svg>
		{#if tipPos && hovered !== null}
			<div
				class="tip"
				class:flip={tipPos.flip}
				class:below={tipPos.below}
				role="tooltip"
				data-testid="front-tooltip"
				style:left="{tipPos.left}%"
				style:top="{tipPos.top}%"
			>
				{@render tooltip(hovered)}
			</div>
		{/if}
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
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
		font-size: var(--text-sm);
		font-weight: 500;
		margin-bottom: var(--sp-1);
	}
	.plot-legend {
		display: inline-flex;
		flex-wrap: wrap;
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
		--c: var(--data-1);
	}
	.canvas {
		position: relative;
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
	.front {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.5;
	}
	.point {
		fill: var(--c);
	}
	.floor {
		fill: var(--surface);
		stroke: var(--c, var(--text-muted));
		stroke-width: 2;
	}
	.recommended {
		fill: var(--c, var(--data-2));
		stroke: var(--text);
		stroke-width: 1.5;
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
	.target:hover .hit,
	.target.highlighted .hit {
		fill: var(--surface-2);
		stroke: var(--c);
		stroke-width: 1.5;
	}
	.target:focus-visible .hit {
		fill: none;
		stroke: var(--focus-ring);
		stroke-width: 2;
	}
	.tip {
		position: absolute;
		z-index: 10;
		width: max-content;
		max-width: min(22rem, 90vw);
		padding: var(--sp-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
		font-size: var(--text-xs);
		pointer-events: none;
		transform: translate(12px, calc(-100% - 8px));
	}
	.tip.below {
		transform: translate(12px, 12px);
	}
	.tip.flip {
		transform: translate(calc(-100% - 12px), calc(-100% - 8px));
	}
	.tip.flip.below {
		transform: translate(calc(-100% - 12px), 12px);
	}
</style>
