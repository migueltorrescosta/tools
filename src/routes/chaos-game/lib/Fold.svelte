<!--
	A closed line that opens a group of settings: a teal summary with a small
	triangle, quieter than a Panel and louder than How it works.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		open = $bindable(false),
		testid,
		children
	}: {
		label: string;
		open?: boolean;
		testid?: string;
		children: Snippet;
	} = $props();
</script>

<details class="fold" bind:open data-testid={testid}>
	<summary>{label}</summary>
	<div class="fold-body">{@render children()}</div>
</details>

<style>
	.fold > summary {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h-sm);
		color: var(--accent);
		cursor: pointer;
		list-style: none;
	}

	.fold > summary::-webkit-details-marker {
		display: none;
	}

	.fold > summary::before {
		content: '▶';
		font-size: 0.7em;
		transition: transform 0.15s;
	}

	.fold[open] > summary::before {
		transform: rotate(90deg);
	}

	.fold > summary:hover {
		color: var(--accent-hover);
	}

	.fold-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin-top: var(--sp-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.fold > summary::before {
			transition: none;
		}
	}
</style>
