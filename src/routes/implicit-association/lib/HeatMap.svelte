<script lang="ts">
	import type { HeatMap } from '#lib/implicit-association/history.js';

	let { map }: { map: HeatMap } = $props();

	/** Blue for positive D, orange for negative, fading to the surface at 0; full at |D| = 1. */
	function fill(d: number): string {
		const share = Math.round(Math.min(1, Math.abs(d)) * 55);
		const hue = d >= 0 ? 'var(--data-1)' : 'var(--data-4)';
		return `color-mix(in oklab, ${hue} ${share}%, var(--surface-2))`;
	}
	const fmt = (d: number) => (d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2));
</script>

<div class="scroll">
	<table class="heat">
		<caption class="sr-only">Mean D-score per pair of groups and pair of attributes</caption>
		<thead>
			<tr>
				<td></td>
				{#each map.columns as c (c)}<th scope="col">{c}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each map.rows as r, i (r)}
				<tr>
					<th scope="row">{r}</th>
					{#each map.columns as c, j (c)}
						{@const cell = map.cells[i][j]}
						{#if cell}
							<td
								style:background={fill(cell.mean)}
								title="{r} × {c}: mean D {fmt(cell.mean)} over {cell.n} run{cell.n === 1
									? ''
									: 's'}"
							>
								<span class="value">{fmt(cell.mean)}</span>
								<span class="n">{cell.n}×</span>
							</td>
						{:else}
							<td class="empty"><span class="sr-only">Not taken</span></td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="note">
	<span class="key"
		><span class="swatch" style:background={fill(1)}></span> first group with first attribute</span
	>
	<span class="key"
		><span class="swatch" style:background={fill(-1)}></span> second group with first attribute</span
	>
</p>

<style>
	.scroll {
		overflow-x: auto;
	}
	.heat {
		border-collapse: separate;
		border-spacing: 2px;
		font-size: var(--text-sm);
	}
	th {
		font-weight: 600;
		text-align: left;
		padding: var(--sp-1) var(--sp-2);
		white-space: nowrap;
	}
	thead th {
		text-align: center;
	}
	td {
		min-width: 88px;
		height: 44px;
		padding: var(--sp-1) var(--sp-2);
		border-radius: var(--radius-sm);
		text-align: center;
		color: var(--text);
	}
	td.empty {
		border: 1px dashed var(--border);
	}
	.value {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.n {
		color: var(--text-muted);
		margin-left: var(--sp-1);
	}
	.note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-1) var(--sp-2);
		margin-top: var(--sp-2);
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
