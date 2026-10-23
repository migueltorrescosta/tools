<script lang="ts">
	/** A wrapping legend of coloured line or swatch keys. */
	let {
		items,
		label
	}: {
		items: readonly { key: string | number; label: string; colour: string; dashed?: boolean }[];
		/** What the legend keys, read by screen readers. */
		label: string;
	} = $props();
</script>

<ul class="legend" aria-label={label}>
	{#each items as item (item.key)}
		<li>
			<svg viewBox="0 0 18 10" aria-hidden="true"
				><line
					x1="1"
					y1="5"
					x2="17"
					y2="5"
					stroke={item.colour}
					stroke-width="3"
					stroke-dasharray={item.dashed ? '4 3' : undefined}
				/></svg
			>{item.label}
		</li>
	{/each}
</ul>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	svg {
		width: 18px;
		height: 10px;
		flex: none;
	}
</style>
