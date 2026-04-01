<script lang="ts">
	import './shared.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let { children } = $props();

	function navigate(path: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(path);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="nav">
	<button
		class="nav-link"
		class:active={page.url.pathname === '/'}
		onclick={() => navigate(`${base}/`)}>Homepage</button
	>
</nav>
{@render children()}
