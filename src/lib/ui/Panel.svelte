<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		level = 2,
		actions,
		children
	}: {
		title?: string;
		/** Heading level of the title, to keep the page outline in order. */
		level?: 2 | 3 | 4;
		/** Buttons shown at the right of the header, e.g. Copy. */
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="panel">
	{#if title || actions}
		<div class="panel-head">
			{#if title}<svelte:element this={`h${level}`} class="panel-heading">{title}</svelte:element
				>{/if}
			{#if actions}<div class="panel-actions">{@render actions()}</div>{/if}
		</div>
	{/if}
	<div class="panel-body">{@render children()}</div>
</section>

<style>
	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 0;
	}

	.panel-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: 36px;
		padding: var(--sp-1) var(--sp-3);
		border-bottom: 1px solid var(--border);
	}

	.panel-heading {
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.panel-actions {
		display: flex;
		gap: var(--sp-1);
		margin-left: auto;
	}

	.panel-body {
		padding: var(--sp-3);
	}
</style>
