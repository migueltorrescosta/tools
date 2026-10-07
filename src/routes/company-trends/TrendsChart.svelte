<script lang="ts">
	import {
		formatMoney,
		logScale,
		logTicks,
		trailSegments,
		trailUpTo,
		typeSlot,
		type Trail,
		type TrailPoint
	} from '$lib/company-trends/chart';
	import type { Currency } from '$lib/company-trends/fx';

	interface Props {
		trails: Trail[];
		/** Current quarter index (2000Q1 = 0). */
		qi: number;
		quarter: string;
		currency: Currency;
		/** Shared [min, max] for both axes so the break-even diagonal is 45°. */
		domain: [number, number];
	}

	let { trails, qi, quarter, currency, domain }: Props = $props();

	const W = 960;
	const H = 620;
	const M = { top: 20, right: 30, bottom: 56, left: 76 };

	const x = $derived(logScale(domain, [M.left, W - M.right]));
	const y = $derived(logScale(domain, [H - M.bottom, M.top]));
	const ticks = $derived(logTicks(domain));

	interface Drawn {
		trail: Trail;
		color: string;
		points: TrailPoint[];
		head: TrailPoint | null;
		/** True once the company's dataset has ended before the current quarter. */
		ended: boolean;
	}

	const drawn = $derived<Drawn[]>(
		trails.map((trail) => {
			const points = trailUpTo(trail, qi).filter((p) => p.revenue > 0 && p.expenses > 0);
			const last = trail.points[trail.points.length - 1];
			return {
				trail,
				color: `var(--series-${typeSlot(trail.company.type) + 1})`,
				points,
				head: points.length > 0 ? points[points.length - 1] : null,
				ended: last !== undefined && last.qi < qi
			};
		})
	);

	interface Hit {
		trail: Trail;
		point: TrailPoint;
	}

	let hovered = $state<Hit | null>(null);
	let pinned = $state<Hit | null>(null);
	const active = $derived(pinned ?? hovered);

	let svgEl: SVGSVGElement | undefined = $state();

	function nearest(event: PointerEvent | MouseEvent): Hit | null {
		if (!svgEl) return null;
		const rect = svgEl.getBoundingClientRect();
		const px = ((event.clientX - rect.left) / rect.width) * W;
		const py = ((event.clientY - rect.top) / rect.height) * H;
		let best: Hit | null = null;
		let bestDist = 14 * 14;
		for (const d of drawn) {
			for (const p of d.points) {
				const dx = x(p.revenue) - px;
				const dy = y(p.expenses) - py;
				const dist = dx * dx + dy * dy;
				// Prefer anchors and heads over faint interpolated points at equal distance.
				const bias = p.quality === 'interpolated' && p !== d.head ? 4 : 0;
				if (dist + bias < bestDist) {
					bestDist = dist + bias;
					best = { trail: d.trail, point: p };
				}
			}
		}
		return best;
	}

	function onMove(event: PointerEvent) {
		hovered = nearest(event);
	}

	function onClick(event: MouseEvent) {
		const hit = nearest(event);
		pinned = hit && pinned && hit.point === pinned.point ? null : hit;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') pinned = null;
	}

	function anchorAt(trail: Trail, q: string | undefined): TrailPoint | undefined {
		return q === undefined ? undefined : trail.points.find((p) => p.quarter === q);
	}

	const QUALITY_LABEL = {
		reported: 'Reported',
		estimated: 'Estimated',
		interpolated: 'Interpolated'
	};

	function margin(p: TrailPoint): string {
		if (p.revenue <= 0) return '—';
		return `${((p.operatingIncome / p.revenue) * 100).toFixed(1)}%`;
	}

	// Tooltip placement in percent of the chart box, flipped away from the edges.
	const tip = $derived.by(() => {
		if (!active) return null;
		const px = x(active.point.revenue);
		const py = y(active.point.expenses);
		return {
			left: (px / W) * 100,
			top: (py / H) * 100,
			flipX: px > W * 0.6,
			flipY: py > H * 0.55
		};
	});

	// Low on the diagonal, where trails rarely run.
	const breakEvenLabelAt = $derived(domain[0] * (domain[1] / domain[0]) ** 0.08);
</script>

<svelte:window onkeydown={onKey} />

<div class="chart-box">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgEl}
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="Revenue versus operating expenses, log-log, at {quarter}"
		data-testid="trends-chart"
		onpointermove={onMove}
		onpointerleave={() => (hovered = null)}
		onclick={onClick}
	>
		<text class="watermark" x={W - M.right - 10} y={H - M.bottom - 16} text-anchor="end"
			>{quarter}</text
		>

		{#each ticks as tick (tick.value)}
			<line
				class="grid"
				class:major={tick.major}
				x1={x(tick.value)}
				x2={x(tick.value)}
				y1={M.top}
				y2={H - M.bottom}
			/>
			<line
				class="grid"
				class:major={tick.major}
				x1={M.left}
				x2={W - M.right}
				y1={y(tick.value)}
				y2={y(tick.value)}
			/>
			<text class="tick" x={x(tick.value)} y={H - M.bottom + 18} text-anchor="middle"
				>{formatMoney(tick.value, currency)}</text
			>
			<text class="tick" x={M.left - 8} y={y(tick.value) + 4} text-anchor="end"
				>{formatMoney(tick.value, currency)}</text
			>
		{/each}

		<line
			class="breakeven"
			x1={x(domain[0])}
			y1={y(domain[0])}
			x2={x(domain[1])}
			y2={y(domain[1])}
		/>
		<text
			class="breakeven-label"
			transform="translate({x(breakEvenLabelAt)},{y(breakEvenLabelAt) - 8}) rotate(-{(Math.atan2(
				H - M.top - M.bottom,
				W - M.left - M.right
			) *
				180) /
				Math.PI})"
		>
			break-even · above = operating loss
		</text>

		<text class="axis-title" x={(M.left + W - M.right) / 2} y={H - 12} text-anchor="middle"
			>Revenue (trailing 12 months, {currency})</text
		>
		<text
			class="axis-title"
			transform="translate(18,{(M.top + H - M.bottom) / 2}) rotate(-90)"
			text-anchor="middle">Operating expenses (revenue − operating income, {currency})</text
		>

		{#each drawn as d (d.trail.company.id)}
			<g class="company" style="--c: {d.color}" data-company={d.trail.company.id}>
				{#each trailSegments(d.points, x, y) as seg, i (i)}
					<path class="trail {seg.kind}" d={seg.d} />
				{/each}
				{#each d.points as p (p.qi)}
					{#if p !== d.head}
						{#if p.quality === 'interpolated'}
							<circle class="pt interp" cx={x(p.revenue)} cy={y(p.expenses)} r="1.6" />
						{:else}
							<circle
								class="pt {p.quality}"
								cx={x(p.revenue)}
								cy={y(p.expenses)}
								r={p.quality === 'estimated' ? 3.2 : 2.8}
							/>
						{/if}
					{/if}
				{/each}
			</g>
		{/each}

		{#each drawn as d (d.trail.company.id)}
			{#if d.head}
				{@const flip = x(d.head.revenue) > W * 0.82}
				<g class="head" style="--c: {d.color}">
					<circle
						class="head-dot {d.head.quality}"
						class:ended={d.ended}
						cx={x(d.head.revenue)}
						cy={y(d.head.expenses)}
						r="6"
					/>
					<text
						class="head-label"
						x={x(d.head.revenue) + (flip ? -9 : 9)}
						y={y(d.head.expenses) + 4}
						text-anchor={flip ? 'end' : 'start'}>{d.trail.company.name}</text
					>
				</g>
			{/if}
		{/each}

		{#if active}
			<circle class="focus-ring" cx={x(active.point.revenue)} cy={y(active.point.expenses)} r="9" />
		{/if}
	</svg>

	{#if active && tip}
		{@const p = active.point}
		{@const c = active.trail.company}
		<div
			class="tooltip"
			class:pinned={pinned !== null}
			class:flip-x={tip.flipX}
			class:flip-y={tip.flipY}
			style="left: {tip.left}%; top: {tip.top}%"
			role="dialog"
			aria-label="{c.name} {p.quarter}"
			data-testid="trends-tooltip"
		>
			<div class="tt-head">
				<strong>{c.name}</strong>
				<span>{p.quarter}</span>
				{#if pinned}
					<button class="tt-close" aria-label="Close" onclick={() => (pinned = null)}>×</button>
				{/if}
			</div>
			<div class="tt-badges">
				<span class="badge {p.quality}">{QUALITY_LABEL[p.quality]}</span>
				{#if p.gap}<span class="badge gap">data gap</span>{/if}
			</div>
			<dl>
				<dt>Revenue</dt>
				<dd>{formatMoney(p.revenue, currency)}</dd>
				<dt>Op. expenses</dt>
				<dd>{formatMoney(p.expenses, currency)}</dd>
				<dt>Op. income</dt>
				<dd>{formatMoney(p.operatingIncome, currency)} ({margin(p)})</dd>
			</dl>
			<div class="tt-source">
				{#if p.quality === 'interpolated'}
					{@const a = anchorAt(active.trail, p.from)}
					{@const b = anchorAt(active.trail, p.to)}
					Log-interpolated between
					{#each [a, b] as anchor, i (i)}
						{#if anchor}
							{#if i === 1}and{/if}
							<a href={anchor.sourceUrl} target="_blank" rel="noreferrer">{anchor.quarter}</a>
							<span class="dim">({anchor.source})</span>
						{/if}
					{/each}
				{:else}
					Source:
					<a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.source}</a>
				{/if}
			</div>
			{#if c.notes}<div class="tt-notes dim">{c.notes}</div>{/if}
			{#if !pinned}<div class="dim tt-hint">Click to pin and follow links</div>{/if}
		</div>
	{/if}
</div>

<style>
	.chart-box {
		position: relative;
		min-width: 820px;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		background: var(--chart-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		cursor: crosshair;
		font-family: 'Inter', sans-serif;
	}

	.watermark {
		font-family: 'Orbitron', sans-serif;
		font-size: 64px;
		font-weight: 700;
		fill: var(--text-muted);
		opacity: 0.18;
	}

	.grid {
		stroke: var(--grid);
		stroke-width: 1;
	}

	.grid.major {
		stroke: var(--grid-major);
	}

	.tick {
		fill: var(--text-muted);
		font-size: 12px;
		font-family: 'JetBrains Mono', monospace;
	}

	.axis-title {
		fill: var(--text-secondary);
		font-size: 13px;
	}

	.breakeven {
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-dasharray: 6 5;
	}

	.breakeven-label {
		fill: var(--text-muted);
		font-size: 12px;
	}

	.trail {
		fill: none;
		stroke: var(--c);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
		opacity: 0.8;
	}

	.trail.gap {
		stroke-dasharray: 3 5;
		opacity: 0.4;
	}

	.pt.reported {
		fill: var(--c);
	}

	.pt.estimated {
		fill: var(--chart-surface);
		stroke: var(--c);
		stroke-width: 1.5;
	}

	.pt.interp {
		fill: var(--c);
		opacity: 0.35;
	}

	.head-dot {
		fill: var(--c);
		stroke: var(--chart-surface);
		stroke-width: 2;
	}

	.head-dot.interpolated {
		fill-opacity: 0.55;
	}

	.head-dot.estimated {
		fill: var(--chart-surface);
		stroke: var(--c);
		stroke-width: 2.5;
	}

	.head-dot.ended {
		opacity: 0.6;
	}

	.head-label {
		fill: var(--text-primary);
		font-size: 12px;
		font-weight: 500;
		paint-order: stroke;
		stroke: var(--chart-surface);
		stroke-width: 3px;
		pointer-events: none;
	}

	.focus-ring {
		fill: none;
		stroke: var(--text-primary);
		stroke-width: 1.5;
		pointer-events: none;
	}

	.tooltip {
		position: absolute;
		transform: translate(14px, 14px);
		max-width: 340px;
		min-width: 220px;
		padding: 0.6rem 0.75rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
		font-size: 0.8rem;
		line-height: 1.4;
		color: var(--text-primary);
		pointer-events: none;
		z-index: 2;
	}

	.tooltip.pinned {
		pointer-events: auto;
	}

	.tooltip.flip-x {
		transform: translate(calc(-100% - 14px), 14px);
	}

	.tooltip.flip-y {
		transform: translate(14px, calc(-100% - 14px));
	}

	.tooltip.flip-x.flip-y {
		transform: translate(calc(-100% - 14px), calc(-100% - 14px));
	}

	.tt-head {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}

	.tt-head span {
		color: var(--text-secondary);
		font-family: 'JetBrains Mono', monospace;
	}

	.tt-close {
		margin-left: auto;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.1rem;
		cursor: pointer;
		line-height: 1;
	}

	.tt-badges {
		margin: 0.25rem 0;
		display: flex;
		gap: 0.35rem;
	}

	.badge {
		font-size: 0.7rem;
		padding: 0 0.4rem;
		border-radius: 4px;
		border: 1px solid var(--text-muted);
		color: var(--text-secondary);
	}

	.badge.reported {
		border-color: var(--text-primary);
		color: var(--text-primary);
	}

	.badge.estimated {
		border-style: dashed;
	}

	.badge.interpolated,
	.badge.gap {
		opacity: 0.75;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 0.75rem;
		margin: 0.25rem 0;
	}

	dt {
		color: var(--text-secondary);
	}

	dd {
		margin: 0;
		font-family: 'JetBrains Mono', monospace;
		text-align: right;
	}

	.tt-source a {
		color: var(--futuristic-cyan);
	}

	.dim {
		color: var(--text-muted);
	}

	.tt-notes,
	.tt-hint {
		margin-top: 0.25rem;
		font-size: 0.72rem;
	}
</style>
