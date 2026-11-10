<script lang="ts">
	import type { Snippet } from 'svelte';

	/** One closed line, "Label: what it holds · change", that opens onto its settings. */
	let {
		label,
		value,
		note,
		change = false,
		open = $bindable(false),
		testId,
		children
	}: {
		label: string;
		/** The current choice, after "Label:". */
		value?: string;
		/** Muted text in brackets after the label, saying what's inside. */
		note?: string;
		/** Ends the line with "· change", for a line that holds a choice. */
		change?: boolean;
		open?: boolean;
		testId?: string;
		children: Snippet;
	} = $props();
</script>

<details class="fold" bind:open data-testid={testId}>
	<summary>
		<strong>{label}{value ? ':' : ''}</strong>{value ? ` ${value}` : ''}
		{#if note}<span class="note">({note})</span>{/if}
		{#if change}<span class="change">· change</span>{/if}
	</summary>
	<div class="fold-body">{@render children()}</div>
</details>

<style>
	.fold > summary {
		min-height: var(--control-h-sm);
		display: list-item;
		padding-block: var(--sp-1);
		cursor: pointer;
	}
	.note {
		color: var(--text-muted);
	}
	.change {
		color: var(--accent);
	}
	.fold > summary:hover .change {
		color: var(--accent-hover);
		text-decoration: underline;
	}
	.fold-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		margin-top: var(--sp-2);
	}
</style>
