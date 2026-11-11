<script lang="ts">
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';
	import '#lib/styles/utilities.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { routes } from '#lib/routes.js';
	import ThemeSwitch from '#lib/ui/ThemeSwitch.svelte';
	import { headerActions } from '#lib/ui/header-actions.svelte.js';

	let { children } = $props();

	// e2e waits on this before using the bar's controls, whose handlers only exist once hydrated.
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const current = $derived(routes.find((route) => page.url.pathname === resolve(route.path)));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

<header class="topbar">
	<nav class="topbar-inner" aria-label="Site" data-hydrated={hydrated || undefined}>
		<a
			class="home"
			href={resolve('/')}
			aria-current={page.url.pathname === resolve('/') ? 'page' : undefined}
			><svg
				class="home-icon"
				viewBox="0 0 24 24"
				width="20"
				height="20"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10" /></svg
			><span class="home-text">Tools</span></a
		>
		{#if current}<span class="crumb" aria-hidden="true">/</span><span class="crumb-name"
				>{current.name}</span
			>{/if}
		<span class="spacer"></span>
		{#if headerActions.snippet}<div class="bar-actions">{@render headerActions.snippet()}</div>{/if}
		<ThemeSwitch />
	</nav>
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<footer class="footer">
	<p>
		Runs in your browser · No guarantees · <a href="mailto:tools-feedback@mptc.uk">Feedback</a>
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
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}

	.topbar-inner {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
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

	.home-icon {
		display: none;
	}

	/* Phones: a home icon instead of "Tools /", so the tool's name keeps its room (owner, 2026-11-11). */
	@media (max-width: 40rem) {
		.home {
			display: grid;
			place-items: center;
			min-width: 44px;
			min-height: 44px;
		}
		.home-icon {
			display: block;
		}
		.home-text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.crumb {
			display: none;
		}
	}

	.crumb {
		color: var(--text-muted);
	}
	.crumb-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-lg);
	}
	.bar-actions {
		flex: none;
		display: flex;
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
		color: var(--text-muted);
		font-size: var(--text-xs);
		text-align: center;
	}

	.footer p {
		margin: 0;
	}
</style>
