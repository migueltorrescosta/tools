<script lang="ts">
	import type { Snippet } from 'svelte';
	import { routes } from '$lib/routes';

	let {
		path,
		children,
		actions
	}: {
		/** The tool's entry in src/lib/routes.ts; its name becomes the <title> and the h1. */
		path: string;
		/** Optional one-line subtitle under the h1, e.g. a blog link. */
		children?: Snippet;
		/** Optional controls at the end of the header, e.g. `ShareActions`. */
		actions?: Snippet;
	} = $props();

	const name = $derived(routes.find((route) => route.path === path)?.name ?? path);
</script>

<svelte:head>
	<title>{name}</title>
</svelte:head>

<header class="page-header">
	<h1>{name}</h1>
	{#if children}<p class="page-subtitle">{@render children()}</p>{/if}
	{#if actions}<div class="page-actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-1) var(--sp-3);
		margin-bottom: var(--sp-3);
	}

	.page-actions {
		margin-left: auto;
		align-self: center;
	}

	.page-subtitle {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
</style>
