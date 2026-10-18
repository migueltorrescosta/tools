<script lang="ts">
	import { tick as nextTick } from 'svelte';
	import {
		clampMargin,
		drawTrail,
		formatMoney,
		formatPercent,
		linearScale,
		logScale,
		logTicks,
		MARGIN_DOMAIN,
		nearestHit,
		percentTicks,
		resolveHit,
		tooltipPlacement,
		trailSegments,
		type DrawnTrail,
		type Hit,
		type HitSelection,
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
		/** CSS colour per company id (see assignColors). */
		colors: Map<string, string>;
		/** Revenue [min, max] for the log x axis; the margin axis is fixed. */
		domain: [number, number];
	}

	let { trails, qi, quarter, currency, colors, domain }: Props = $props();

	const W = 960;
	const H = 620;
	const M = { top: 20, right: 30, bottom: 56, left: 76 };

	const xScale = $derived(logScale(domain, [M.left, W - M.right]));
	/** Plot x of a revenue, pinned to the left edge below the axis floor. */
	const x = $derived((v: number) => xScale(Math.max(v, domain[0])));
	const y = linearScale(MARGIN_DOMAIN, [H - M.bottom, M.top]);
	const xTicks = $derived(logTicks(domain));
	const yTicks = percentTicks(MARGIN_DOMAIN);

	/** Plot y of a drawable point: its margin, pinned to the axis edge when off-scale. */
	function py(p: TrailPoint): number {
		return y(clampMargin(p.margin ?? 0).value);
	}

	function clipOf(p: TrailPoint) {
		return p.margin === null ? null : clampMargin(p.margin).clipped;
	}

	/** Outward-pointing caret with its tip on the axis edge. */
	function caret(cx: number, side: 'low' | 'high', size: number): string {
		const tip = side === 'low' ? H - M.bottom : M.top;
		const base = side === 'low' ? tip - size * 1.6 : tip + size * 1.6;
		return `M${cx - size},${base}L${cx + size},${base}L${cx},${tip}Z`;
	}

	interface Drawn extends DrawnTrail {
		color: string;
	}

	const drawn = $derived<Drawn[]>(
		trails.map((trail) => ({
			...drawTrail(trail, qi),
			color: colors.get(trail.company.id) ?? 'var(--text-muted)'
		}))
	);

	// Selections, not point objects: re-resolved against the current trails so a
	// currency, filter or quarter change never shows a stale point.
	let hovered = $state<HitSelection | null>(null);
	let pinned = $state<HitSelection | null>(null);
	const pinnedHit = $derived(resolveHit(drawn, pinned));
	const active = $derived(pinnedHit ?? resolveHit(drawn, hovered));

	function selectionOf(hit: Hit | null): HitSelection | null {
		return hit && { companyId: hit.trail.company.id, quarter: hit.point.quarter };
	}

	let svgEl: SVGSVGElement | undefined = $state();

	function nearest(event: PointerEvent | MouseEvent): Hit | null {
		if (!svgEl) return null;
		const rect = svgEl.getBoundingClientRect();
		const px = ((event.clientX - rect.left) / rect.width) * W;
		const pointerY = ((event.clientY - rect.top) / rect.height) * H;
		return nearestHit(drawn, px, pointerY, x, y);
	}

	function onMove(event: PointerEvent) {
		hovered = selectionOf(nearest(event));
	}

	function onClick(event: MouseEvent) {
		const hit = selectionOf(nearest(event));
		const same =
			hit && pinnedHit && hit.companyId === pinned?.companyId && hit.quarter === pinned.quarter;
		pinned = same ? null : hit;
	}

	let tooltipEl: HTMLDivElement | undefined = $state();
	/** The head that pinned the tooltip from the keyboard; focus returns there on close. */
	let pinnedFrom: Element | null = null;

	function unpin() {
		pinned = null;
		if (pinnedFrom instanceof SVGElement) pinnedFrom.focus();
		pinnedFrom = null;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && pinned) unpin();
	}

	function headSelection(d: Drawn): HitSelection | null {
		return d.head && { companyId: d.trail.company.id, quarter: d.head.quarter };
	}

	/** Enter or Space on a focused head pins its tooltip and moves focus into it. */
	async function onHeadKey(event: KeyboardEvent, d: Drawn) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		pinned = headSelection(d);
		pinnedFrom = event.currentTarget as Element;
		await nextTick();
		tooltipEl?.querySelector<HTMLElement>('button')?.focus();
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
		return p.margin === null ? '—' : formatPercent(p.margin, 1);
	}

	// Tooltip placement in percent of the chart box, flipped away from the edges.
	const tip = $derived(
		active ? tooltipPlacement(x(active.point.revenue), py(active.point), W, H) : null
	);
</script>

<svelte:window onkeydown={onKey} />

<div class="chart-box">
	<!-- Pointer pinning is a mouse shortcut: keyboard users focus a company's head (Tab) and
	press Enter, which pins the same tooltip (onHeadKey). -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgEl}
		viewBox="0 0 {W} {H}"
		role="group"
		aria-label="Revenue (log scale) versus operating margin at {quarter}, {trails.length} {trails.length ===
		1
			? 'company'
			: 'companies'}. Tab to a company and press Enter for its figures and sources."
		data-testid="trends-chart"
		onpointermove={onMove}
		onpointerleave={() => (hovered = null)}
		onclick={onClick}
	>
		<g aria-hidden="true">
			<text class="watermark" x={W - M.right - 10} y={H - M.bottom - 16} text-anchor="end"
				>{quarter}</text
			>

			{#each xTicks as tick (tick.value)}
				<line
					class="grid"
					class:major={tick.major}
					x1={x(tick.value)}
					x2={x(tick.value)}
					y1={M.top}
					y2={H - M.bottom}
				/>
				<text class="tick" x={x(tick.value)} y={H - M.bottom + 18} text-anchor="middle"
					>{formatMoney(tick.value, currency)}</text
				>
			{/each}
			{#each yTicks as tick (tick.value)}
				<line
					class="grid"
					class:major={tick.major}
					x1={M.left}
					x2={W - M.right}
					y1={y(tick.value)}
					y2={y(tick.value)}
				/>
				<text class="tick" x={M.left - 8} y={y(tick.value) + 4} text-anchor="end"
					>{formatPercent(tick.value)}</text
				>
			{/each}

			<line
				class="breakeven"
				x1={M.left}
				y1={y(0)}
				x2={W - M.right}
				y2={y(0)}
				data-testid="breakeven"
			/>
			<text class="breakeven-label" x={M.left + 8} y={y(0) + 16}
				>break-even · below = operating loss</text
			>

			<text class="axis-title" x={(M.left + W - M.right) / 2} y={H - 12} text-anchor="middle"
				>Revenue (trailing 12 months, {currency}, log scale)</text
			>
			<text
				class="axis-title"
				transform="translate(18,{(M.top + H - M.bottom) / 2}) rotate(-90)"
				text-anchor="middle"
				data-testid="y-axis-title">Operating margin (operating income / revenue)</text
			>

			{#each drawn as d (d.trail.company.id)}
				<g
					class="company"
					style="--c: {d.color}"
					data-company={d.trail.company.id}
					data-type={d.trail.company.type}
				>
					{#each trailSegments(d.path, x, y) as seg, i (i)}
						<path class="trail {seg.kind}" d={seg.d} />
					{/each}
					{#each d.points as p (p.qi)}
						{@const clip = clipOf(p)}
						{#if p !== d.head}
							{#if clip}
								<path
									class="pt offscale"
									class:interp={p.quality === 'interpolated'}
									d={caret(x(p.revenue), clip, p.quality === 'interpolated' ? 2 : 3)}
								/>
							{:else if p.quality === 'interpolated'}
								<circle class="pt interp" cx={x(p.revenue)} cy={py(p)} r="1.6" />
							{:else}
								<circle
									class="pt {p.quality}"
									cx={x(p.revenue)}
									cy={py(p)}
									r={p.quality === 'estimated' ? 3.2 : 2.8}
								/>
							{/if}
						{/if}
					{/each}
				</g>
			{/each}
		</g>

		{#each drawn as d (d.trail.company.id)}
			{#if d.head}
				{@const flip = x(d.head.revenue) > W * 0.82}
				{@const clip = clipOf(d.head)}
				{@const hy = clip === 'low' ? H - M.bottom - 14 : clip === 'high' ? M.top + 14 : py(d.head)}
				<g
					class="head"
					style="--c: {d.color}"
					role="button"
					tabindex="0"
					aria-label="{d.trail.company.name}, {d.head.quarter}"
					aria-expanded={pinned?.companyId === d.trail.company.id}
					onkeydown={(event) => onHeadKey(event, d)}
					onfocus={() => (hovered = headSelection(d))}
					onblur={() => (hovered = null)}
				>
					{#if clip}
						<path
							class="head-caret"
							class:ended={d.ended}
							d={caret(x(d.head.revenue), clip, 6)}
							data-testid="offscale-head"
						/>
					{:else}
						<circle
							class="head-dot {d.head.quality}"
							data-testid="head-dot"
							class:ended={d.ended}
							cx={x(d.head.revenue)}
							cy={py(d.head)}
							r="6"
						/>
					{/if}
					<text
						class="head-label"
						x={x(d.head.revenue) + (flip ? -9 : 9)}
						y={hy + 4}
						text-anchor={flip ? 'end' : 'start'}>{d.trail.company.name}</text
					>
				</g>
			{/if}
		{/each}

		{#if active}
			<circle
				aria-hidden="true"
				class="focus-ring"
				cx={x(active.point.revenue)}
				cy={py(active.point)}
				r="9"
			/>
		{/if}
	</svg>

	{#if active && tip}
		{@const p = active.point}
		{@const c = active.trail.company}
		<div
			class="tooltip"
			class:pinned={pinnedHit !== null}
			class:flip-x={tip.flipX}
			class:flip-y={tip.flipY}
			style="left: {tip.left}%; top: {tip.top}%"
			bind:this={tooltipEl}
			role="dialog"
			aria-label="{c.name} {p.quarter}"
			data-testid="trends-tooltip"
		>
			<div class="tt-head">
				<strong>{c.name}</strong>
				<span>{p.quarter}</span>
				{#if pinnedHit}
					<button class="tt-close" aria-label="Close" onclick={unpin}>×</button>
				{/if}
			</div>
			<div class="tt-badges">
				<span class="badge {p.quality}">{QUALITY_LABEL[p.quality]}</span>
				{#if p.gap}<span class="badge gap">data gap</span>{/if}
				{#if clipOf(p)}<span class="badge offscale">off-scale</span>{/if}
				{#if p.revenue < domain[0]}<span class="badge offscale">below axis</span>{/if}
			</div>
			<dl>
				<dt>Op. margin</dt>
				<dd>{margin(p)}</dd>
				<dt>Revenue</dt>
				<dd>{formatMoney(p.revenue, currency)}</dd>
				<dt>Op. expenses</dt>
				<dd>{formatMoney(p.expenses, currency)}</dd>
				<dt>Op. income</dt>
				<dd>{formatMoney(p.operatingIncome, currency)}</dd>
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
			{#if !pinnedHit}<div class="dim tt-hint">
					Click, or press Enter on a company, to pin and follow links
				</div>{/if}
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
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: crosshair;
		font-family: var(--font-sans);
	}

	.watermark {
		font-family: var(--font-sans);
		font-size: 64px;
		font-weight: 700;
		fill: var(--text-muted);
		opacity: 0.15;
	}

	.grid {
		stroke: var(--border);
		stroke-width: 1;
		opacity: 0.5;
	}

	.grid.major {
		opacity: 1;
	}

	.tick {
		fill: var(--text-muted);
		font-size: 12px;
		font-family: var(--font-mono);
	}

	.axis-title {
		fill: var(--text-muted);
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

	.trail.clipped {
		stroke-dasharray: 2 4;
		opacity: 0.45;
	}

	.pt.offscale {
		fill: var(--c);
	}

	.pt.offscale.interp {
		opacity: 0.35;
	}

	.head-caret {
		fill: var(--c);
		stroke: var(--surface);
		stroke-width: 1.5;
	}

	.head-caret.ended {
		opacity: 0.6;
	}

	.pt.reported {
		fill: var(--c);
	}

	.pt.estimated {
		fill: var(--surface);
		stroke: var(--c);
		stroke-width: 1.5;
	}

	.pt.interp {
		fill: var(--c);
		opacity: 0.35;
	}

	.head-dot {
		fill: var(--c);
		stroke: var(--surface);
		stroke-width: 2;
	}

	.head-dot.interpolated {
		fill-opacity: 0.55;
	}

	.head-dot.estimated {
		fill: var(--surface);
		stroke: var(--c);
		stroke-width: 2.5;
	}

	.head-dot.ended {
		opacity: 0.6;
	}

	.head-label {
		fill: var(--text);
		font-size: 12px;
		font-weight: 500;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
		pointer-events: none;
	}

	.head {
		cursor: pointer;
		outline: none;
	}

	/* SVG groups get no outline ring: draw one round the head instead. */
	.head:focus-visible .head-dot,
	.head:focus-visible .head-caret {
		stroke: var(--focus-ring);
		stroke-width: 3;
	}

	.focus-ring {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.5;
		pointer-events: none;
	}

	.tooltip {
		position: absolute;
		transform: translate(14px, 14px);
		max-width: 340px;
		min-width: 220px;
		padding: 0.6rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--text) 25%, transparent);
		font-size: var(--text-sm);
		line-height: 1.4;
		color: var(--text);
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
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.tt-close {
		margin-left: auto;
		min-width: 24px;
		min-height: 24px;
		background: none;
		border: none;
		color: var(--text-muted);
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
		color: var(--text-muted);
	}

	.badge.reported {
		border-color: var(--text);
		color: var(--text);
	}

	.badge.estimated {
		border-style: dashed;
	}

	.badge.offscale {
		border-style: dotted;
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
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		font-family: var(--font-mono);
		text-align: right;
	}

	.tt-source a {
		color: var(--accent);
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
