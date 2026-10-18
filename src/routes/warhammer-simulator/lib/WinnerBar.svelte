<script lang="ts">
	import type { SimulationResults } from '$lib/warhammer-simulator/types';
	import { DataTable, type Column } from '$lib/ui';

	let {
		results,
		nameA,
		nameB,
		summary
	}: { results: SimulationResults; nameA: string; nameB: string; summary: string } = $props();

	const uid = $props.id();
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

	// Stacked in reading order: A, then mutual kill / draw, then B.
	const segments = $derived([
		{ name: nameA, value: results.winRateA, color: 'var(--data-1)' },
		{
			name: 'Mutual kill / draw',
			value: results.mutualKillRate + results.drawRate,
			color: 'var(--data-8)'
		},
		{ name: nameB, value: results.winRateB, color: 'var(--data-2)' }
	]);
	const W = 400;
	const GAP = 2;
	const bars = $derived.by(() => {
		let x = 0;
		return segments.map((s) => {
			const w = s.value * W;
			const bar = { ...s, x: x + (x > 0 ? GAP / 2 : 0), w: Math.max(w - GAP, 0) };
			x += w;
			return bar;
		});
	});

	type Row = { outcome: string; share: number };
	const columns: Column<Row>[] = [
		{ key: 'outcome', label: 'Outcome' },
		{ key: 'share', label: 'Share of duels', align: 'right', format: (v) => pct(v as number) }
	];
	const rows = $derived<Row[]>([
		{ outcome: `${nameA} wins`, share: results.winRateA },
		{ outcome: `${nameB} wins`, share: results.winRateB },
		{ outcome: 'Mutual kill', share: results.mutualKillRate },
		{ outcome: 'Draw (50-round cap)', share: results.drawRate }
	]);
</script>

<figure class="wh-winner">
	<svg
		viewBox="0 0 {W} 24"
		preserveAspectRatio="none"
		role="img"
		aria-label="Winner share"
		aria-describedby="{uid}-summary"
	>
		{#each bars as b (b.name)}
			<rect x={b.x} y="0" width={b.w} height="24" rx="2" fill={b.color}
				><title>{b.name}: {pct(b.value)}</title></rect
			>
		{/each}
	</svg>
	<ul class="wh-winner-list">
		{#each segments as s (s.name)}
			<li>
				<span class="wh-swatch" style:background={s.color}></span>
				<span class="wh-winner-name" data-testid="winner-label">{s.name}</span>
				<span class="wh-winner-value" data-testid="winner-value">{pct(s.value)}</span>
			</li>
		{/each}
	</ul>
	<p id="{uid}-summary" class="wh-winner-summary">{summary}</p>
	<p class="wh-winner-note">
		Mutual kill: both fall in the same round. Draw: the 50-round cap is reached.
	</p>
	<details class="wh-data">
		<summary>Show data</summary>
		<DataTable caption="Winner share" hideCaption {columns} {rows} rowKey={(r) => r.outcome} />
	</details>
</figure>

<style>
	.wh-winner {
		margin: 0;
		min-width: 0;
	}
	svg {
		display: block;
		width: 100%;
		height: 24px;
	}
	.wh-winner-list {
		list-style: none;
		margin: var(--sp-2) 0 0;
		padding: 0;
		display: grid;
		gap: var(--sp-1);
		font-size: var(--text-sm);
	}
	.wh-winner-list li {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.wh-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.wh-winner-name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.wh-winner-value {
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.wh-winner-summary {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-sm);
	}
	.wh-winner-note {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
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
