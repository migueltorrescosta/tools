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

<section class="ui-panel">
	{#if title || actions}
		<div class="ui-panel-head">
			{#if title}<svelte:element this={`h${level}`} class="ui-panel-heading">{title}</svelte:element
				>{/if}
			{#if actions}<div class="ui-panel-actions">{@render actions()}</div>{/if}
		</div>
	{/if}
	<div class="ui-panel-body">{@render children()}</div>
</section>

<style>
	/* A box on the paper: its title in body size over a short accent rule, no header band. */
	.ui-panel {
		background: var(--box-bg);
		border: 1px solid var(--box-edge);
		border-radius: var(--radius);
		box-shadow: var(--box-shadow);
		-webkit-backdrop-filter: var(--box-blur);
		backdrop-filter: var(--box-blur);
		position: relative;
		min-width: 0;
	}
	/* The blur makes each box its own stacking layer, so a menu or tooltip that spills out
	   would sit under the next box: lift the box the pointer or focus is in. */
	.ui-panel:is(:hover, :focus-within) {
		z-index: 1;
	}
	.ui-panel-head {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-3) 0;
	}
	.ui-panel-heading {
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.ui-panel-heading::after {
		content: '';
		display: block;
		width: 24px;
		height: 2px;
		margin-top: 6px;
		background: var(--accent);
	}
	.ui-panel-actions {
		display: flex;
		gap: var(--sp-1);
		margin-left: auto;
	}
	.ui-panel-body {
		padding: var(--sp-3);
	}
</style>
