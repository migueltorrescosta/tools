<script lang="ts" module>
	export type Series = {
		name: string;
		/** A --data-* token, e.g. 'var(--data-1)'. */
		color: string;
		/** Percentages, one per category. */
		values: number[];
	};
</script>

<script lang="ts">
	import { DataTable, type Column } from '$lib/ui';

	let {
		categories,
		series,
		xLabel,
		yLabel = '% of duels',
		label,
		summary,
		testId
	}: {
		categories: string[];
		series: Series[];
		xLabel: string;
		yLabel?: string;
		/** Accessible name of the chart and caption of its data table. */
		label: string;
		/** One sentence describing what the chart shows; visible below it. */
		summary: string;
		testId?: string;
	} = $props();

	const uid = $props.id();

	const W = 420;
	const H = 220;
	const M = { top: 10, right: 8, bottom: 36, left: 40 };
	const innerW = W - M.left - M.right;
	const innerH = H - M.top - M.bottom;

	/** Round tick step so the axis has about four lines. */
	const yMax = $derived.by(() => {
		const max = Math.max(1, ...series.flatMap((s) => s.values));
		const raw = max / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
		return { top: Math.ceil(max / step) * step, step };
	});
	const yTicks = $derived(
		Array.from({ length: Math.round(yMax.top / yMax.step) + 1 }, (_, i) => i * yMax.step)
	);
	const sy = (v: number) => M.top + innerH - (v / yMax.top) * innerH;

	const band = $derived(innerW / Math.max(categories.length, 1));
	const groupPad = $derived(Math.min(band * 0.2, 12));
	const barW = $derived((band - groupPad) / series.length);
	/** Label every category when they fit, else every n-th. */
	const labelEvery = $derived(Math.ceil(categories.length / 16));

	const fmt = (v: number) => `${v.toFixed(1)}%`;

	type Row = Record<string, string | number>;
	const columns = $derived<Column<Row>[]>([
		{ key: 'category', label: xLabel },
		...series.map((s, i) => ({
			key: `s${i}`,
			label: series.length > 1 ? s.name : yLabel,
			align: 'right' as const,
			format: (v: unknown) => fmt(v as number)
		}))
	]);
	const rows = $derived<Row[]>(
		categories.map((category, c) => ({
			category,
			...Object.fromEntries(series.map((s, i) => [`s${i}`, s.values[c] ?? 0]))
		}))
	);
</script>

<figure class="wh-chart" data-testid={testId}>
	{#if series.length > 1}
		<figcaption class="wh-chart-legend">
			{#each series as s (s.name)}
				<span><span class="wh-swatch" style:background={s.color}></span>{s.name}</span>
			{/each}
		</figcaption>
	{/if}
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={label} aria-describedby="{uid}-summary">
		<g class="wh-grid">
			{#each yTicks as t (t)}
				<line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
				<text x={M.left - 6} y={sy(t) + 4} text-anchor="end">{t}</text>
			{/each}
		</g>
		{#each categories as category, c (category)}
			{#each series as s, i (s.name)}
				{@const v = s.values[c] ?? 0}
				<rect
					x={M.left + c * band + groupPad / 2 + i * barW + 0.5}
					y={sy(v)}
					width={Math.max(barW - 1, 1)}
					height={M.top + innerH - sy(v)}
					rx="1.5"
					fill={s.color}><title>{s.name}, {xLabel} {category}: {fmt(v)}</title></rect
				>
			{/each}
			{#if c % labelEvery === 0}
				<text
					class="wh-tick"
					x={M.left + c * band + band / 2}
					y={M.top + innerH + 14}
					text-anchor="middle">{category}</text
				>
			{/if}
		{/each}
		<line class="wh-axis" x1={M.left} x2={M.left + innerW} y1={sy(0)} y2={sy(0)} />
		<text class="wh-tick" x={M.left + innerW / 2} y={H - 4} text-anchor="middle">{xLabel}</text>
		<text
			class="wh-tick"
			x={10}
			y={M.top + innerH / 2}
			text-anchor="middle"
			transform="rotate(-90 10 {M.top + innerH / 2})">{yLabel}</text
		>
	</svg>
	<p id="{uid}-summary" class="wh-summary">{summary}</p>
	<details class="wh-data">
		<summary>Show data</summary>
		<DataTable caption={label} hideCaption {columns} {rows} rowKey={(r) => String(r.category)} />
	</details>
</figure>

<style>
	.wh-chart {
		margin: 0;
		min-width: 0;
	}
	.wh-chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-bottom: var(--sp-1);
	}
	.wh-chart-legend > span {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.wh-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.wh-grid line {
		stroke: var(--border);
	}
	.wh-axis {
		stroke: var(--text-muted);
	}
	.wh-grid text,
	.wh-tick {
		fill: var(--text-muted);
		font-size: 12px;
		font-family: var(--font-mono);
	}
	.wh-summary {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-sm);
	}
	.wh-data {
		margin-top: var(--sp-2);
		font-size: var(--text-sm);
	}
	.wh-data > summary {
		min-height: 24px;
		cursor: pointer;
		color: var(--text-muted);
	}
	.wh-data[open] > summary {
		margin-bottom: var(--sp-2);
	}
</style>
