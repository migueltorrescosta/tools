<!--
	A closed line, "Label · what it holds", that opens onto its settings or detail.
	`boxed` gives it Panel chrome, for a whole panel that starts closed.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLDetailsAttributes } from 'svelte/elements';

	let {
		label,
		summary,
		open = $bindable(false),
		boxed = false,
		class: className = '',
		children,
		...rest
	}: Omit<HTMLDetailsAttributes, 'open'> & {
		label: string;
		/** What the line holds or its current values, muted after a dot. */
		summary?: string;
		open?: boolean;
		boxed?: boolean;
		children: Snippet;
	} = $props();
</script>

<details class="ui-fold {className}" class:boxed bind:open {...rest}>
	<summary
		><span class="ui-fold-label">{label}</span>
		{#if summary}<span class="ui-fold-summary">· {summary}</span>{/if}</summary
	>
	<div class="ui-fold-body">{@render children()}</div>
</details>

<style>
	.ui-fold {
		min-width: 0;
	}
	/* Block, not flex, so a long summary wraps as text under the label. */
	.ui-fold > summary {
		display: block;
		width: fit-content;
		max-width: 100%;
		min-height: var(--control-h-sm);
		padding-block: var(--sp-1);
		color: var(--accent);
		cursor: pointer;
		list-style: none;
	}
	.ui-fold > summary::-webkit-details-marker {
		display: none;
	}
	.ui-fold > summary::before {
		content: '▸';
		display: inline-block;
		width: 1em;
	}
	.ui-fold[open] > summary::before {
		content: '▾';
	}
	.ui-fold > summary:hover {
		color: var(--accent-hover);
	}
	.ui-fold-summary {
		color: var(--text-muted);
	}
	.ui-fold-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		margin-top: var(--sp-2);
	}

	.boxed {
		background: var(--box-bg);
		border: 1px solid var(--box-edge);
		border-radius: var(--radius);
		box-shadow: var(--box-shadow);
		-webkit-backdrop-filter: var(--box-blur);
		backdrop-filter: var(--box-blur);
		position: relative;
	}
	/* The blur makes each box its own stacking layer, so a menu or tooltip that spills out
	   would sit under the next box: lift the box the pointer or focus is in. */
	.boxed:is(:hover, :focus-within) {
		z-index: 1;
	}
	.boxed > summary {
		width: auto;
		min-height: var(--control-h);
		padding: var(--sp-2) var(--sp-3);
		color: var(--text);
	}
	.boxed > .ui-fold-body {
		gap: var(--sp-3);
		margin-top: 0;
		padding: 0 var(--sp-3) var(--sp-3);
	}
</style>
