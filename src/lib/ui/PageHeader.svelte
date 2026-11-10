<script lang="ts">
	import type { Snippet } from 'svelte';
	import { routes } from '#lib/routes.js';
	import { headerActions } from './header-actions.svelte.js';

	// eslint-disable-next-line svelte/no-unused-props -- children goes once every tool moved its subtitle into How it works
	let {
		path,
		actions
	}: {
		/** The tool's entry in src/lib/routes.ts; its name becomes the <title> and the h1. */
		path: string;
		/**
		 * @deprecated No longer drawn: the breadcrumb names the tool, and credits
		 * and blog links belong in How it works.
		 */
		children?: Snippet;
		/** The tool's own actions, e.g. `ShareActions`, drawn in the top bar. */
		actions?: Snippet;
	} = $props();

	const name = $derived(routes.find((route) => route.path === path)?.name ?? path);

	$effect(() => {
		const mine = actions;
		headerActions.snippet = mine;
		return () => {
			if (headerActions.snippet === mine) headerActions.snippet = undefined;
		};
	});
</script>

<svelte:head>
	<title>{name}</title>
</svelte:head>

<!-- The breadcrumb shows the name; the heading stays for screen readers and the page outline. -->
<h1 class="sr-only">{name}</h1>
