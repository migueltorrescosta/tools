<script lang="ts">
	import './shared.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	let { children } = $props();

	function navigate(path: string) {
		goto(path);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="nav">
	<button
		class="nav-link"
		class:active={page.url.pathname === '/'}
		onclick={() => navigate(`${base}/`)}>Homepage</button>
</nav>
{@render children()}

<footer class="footer">
	<p>
		Collection of Developer Utilities. Everything runs exclusively on your browser. No guarantees of correctness are provided. Use at your own risk. Contact <a href="mailto:tools-feedback@mptc.uk">tools-feedback@mptc.uk</a> for improvement suggestions
	</p>
</footer>
