<script lang="ts">
	import type { ControlEntry } from './controls';

	let {
		entries,
		values,
		saturated,
		testId
	}: {
		entries: ControlEntry[];
		/** The full control vector of the best result. */
		values: number[];
		saturated: boolean[];
		testId?: string;
	} = $props();

	const ROW = 22;
	/** The SVG is drawn at its rendered width, so its text stays at the CSS px sizes below. */
	let width = $state(520);
	const W = $derived(Math.max(240, width));
	const M = { top: 24, right: 84, bottom: 8, left: 56 };
	const innerW = $derived(W - M.left - M.right);
	const H = $derived(M.top + M.bottom + Math.max(1, entries.length) * ROW);
	const mid = $derived(M.left + innerW / 2);
	/** Value over its bound, in [-1, 1], to x. */
	const sx = (f: number) => mid + (Math.max(-1, Math.min(1, f)) * innerW) / 2;
	const fmt = (v: number) => String(Number(v.toPrecision(3)));
	const satCount = $derived(entries.filter((e) => saturated[e.index]).length);
</script>

<figure class="plot" data-testid={testId}>
	<figcaption>
		<span>Best controls against their bounds</span>
		<span class="note">{satCount} of {entries.length} at a bound (marked ⚑)</span>
		<span class="legend" aria-hidden="true">
			<span><span class="swatch coupling"></span>Coupling α</span>
			<span><span class="swatch field"></span>Fields b, c</span>
			<span><span class="swatch pulse"></span>Pulses v</span>
		</span>
	</figcaption>
	{#if entries.length === 0}
		<p class="note">This setup has no controls.</p>
	{:else}
		<div class="chart-box" bind:clientWidth={width}>
			<svg
				viewBox="0 0 {W} {H}"
				width={W}
				height={H}
				role="img"
				aria-label="Best control values: {entries
					.map(
						(e) =>
							`${e.symbol} ${e.sub} ${fmt(values[e.index] ?? 0)} of ±${fmt(e.bound)}${saturated[e.index] ? ' (at bound)' : ''}`
					)
					.join('; ')}"
			>
				<text class="axis" x={M.left} y={14} text-anchor="middle">−bound</text>
				<text class="axis" x={mid} y={14} text-anchor="middle">0</text>
				<text class="axis" x={M.left + innerW} y={14} text-anchor="middle">+bound</text>
				<line class="edge" x1={M.left} x2={M.left} y1={M.top - 4} y2={H - M.bottom} />
				<line
					class="edge"
					x1={M.left + innerW}
					x2={M.left + innerW}
					y1={M.top - 4}
					y2={H - M.bottom}
				/>
				<line class="zero" x1={mid} x2={mid} y1={M.top - 4} y2={H - M.bottom} />
				{#each entries as e, i (e.index)}
					{@const v = values[e.index] ?? 0}
					{@const f = v / e.bound}
					{@const y = M.top + i * ROW}
					{@const sat = saturated[e.index] ?? false}
					<text class="name" x={M.left - 8} y={y + ROW / 2 + 3} text-anchor="end"
						>{e.symbol}<tspan class="sub" dy="3">{e.sub}</tspan></text
					>
					<rect
						class="bar {e.group}"
						class:sat
						x={Math.min(sx(f), mid)}
						y={y + 3}
						width={Math.max(1, Math.abs(sx(f) - mid))}
						height={ROW - 6}
						rx="2"
					/>
					<text class="value" x={M.left + innerW + 6} y={y + ROW / 2 + 4}
						>{fmt(v)}{sat ? ' ⚑' : ''}</text
					>
				{/each}
			</svg>
		</div>
	{/if}
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
	.note {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		width: 100%;
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.legend > span {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.swatch.coupling {
		background: var(--data-1);
	}
	.swatch.field {
		background: var(--data-2);
	}
	.swatch.pulse {
		background: var(--data-3);
	}
	.chart-box {
		min-width: 0;
	}
	.chart-box svg {
		display: block;
		max-width: none;
		overflow: visible;
	}
	.axis,
	.name,
	.value {
		fill: var(--text-muted);
		font-size: 12px;
		font-family: var(--font-mono);
	}
	.name {
		fill: var(--text);
	}
	.sub {
		font-size: 11px;
	}
	.edge {
		stroke: var(--border-strong);
		stroke-dasharray: 3 3;
	}
	.zero {
		stroke: var(--border-strong);
	}
	.bar.coupling {
		fill: var(--data-1);
	}
	.bar.field {
		fill: var(--data-2);
	}
	.bar.pulse {
		fill: var(--data-3);
	}
	.bar.sat {
		stroke: var(--text);
		stroke-width: 1.5;
	}
</style>
