<script lang="ts">
	import './shared.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="nav">
	<a href="/" class="nav-link" class:active={page.url.pathname === '/'}>Homepage</a>
</nav>
{@render children()}
