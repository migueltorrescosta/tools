<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import '$lib/styles/utilities.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { routes, TOOL_GROUPS } from '$lib/routes';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';

	let { children } = $props();

	// e2e waits on this before using the switcher, whose handler only exists once hydrated.
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const current = $derived(
		routes.find((route) => page.url.pathname === `${base}${route.path}`)?.path ?? ''
	);

	function jumpTo(event: Event & { currentTarget: HTMLSelectElement }) {
		const path = event.currentTarget.value;
		if (path) goto(`${base}${path}`);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

<header class="topbar">
	<nav class="topbar-inner" aria-label="Site" data-hydrated={hydrated || undefined}>
		<a
			class="home"
			href="{base}/"
			aria-current={page.url.pathname === `${base}/` ? 'page' : undefined}>Tools</a
		>
		<label class="sr-only" for="tool-switcher">Jump to tool</label>
		<select id="tool-switcher" class="control switcher" value={current} onchange={jumpTo}>
			<option value="" disabled>Jump to tool…</option>
			{#each TOOL_GROUPS as group (group)}
				<optgroup label={group}>
					{#each routes.filter((route) => route.group === group) as route (route.path)}
						<option value={route.path}>{route.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		<span class="spacer"></span>
		<ThemeToggle />
	</nav>
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<footer class="footer">
	<p>
		Everything runs in your browser. No guarantees of correctness; use at your own risk.
		Suggestions:
		<a href="mailto:tools-feedback@mptc.uk">tools-feedback@mptc.uk</a>
	</p>
</footer>

<style>
	.skip-link {
		position: absolute;
		left: var(--sp-2);
		top: -100px;
		z-index: 100;
		padding: var(--sp-2) var(--sp-3);
		background: var(--accent);
		color: var(--on-accent);
		border-radius: var(--radius);
	}

	.skip-link:focus {
		top: var(--sp-2);
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.topbar-inner {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		max-width: var(--content-max);
		height: var(--topbar-h);
		margin: 0 auto;
		padding: 0 var(--sp-4);
	}

	.home {
		font-weight: 700;
		font-size: var(--text-lg);
		color: var(--text);
		text-decoration: none;
	}

	.home:hover {
		color: var(--accent);
	}

	.switcher {
		width: auto;
		max-width: 16rem;
		min-height: var(--control-h-sm);
	}

	.spacer {
		flex: 1;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	main:focus {
		outline: none;
	}

	.footer {
		padding: var(--sp-3) var(--sp-4);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: var(--text-xs);
		text-align: center;
	}

	.footer p {
		margin: 0;
	}
</style>
