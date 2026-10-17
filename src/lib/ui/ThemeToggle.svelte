<script lang="ts">
	import { onMount } from 'svelte';
	import { initTheme, theme, toggleTheme } from '$lib/theme.svelte';

	onMount(initTheme);

	const next = $derived(theme.current === 'dark' ? 'light' : 'dark');
</script>

<button
	type="button"
	class="theme-toggle"
	aria-label="Switch to {next} theme"
	title="Switch to {next} theme"
	onclick={toggleTheme}
>
	{#if theme.current === 'dark'}
		<!-- sun: shown in dark mode, switches to light -->
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2" />
			<path
				d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<!-- moon: shown in light mode, switches to dark -->
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<path
				d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-h);
		height: var(--control-h);
		padding: 0;
		background: transparent;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		color: var(--text);
		cursor: pointer;
	}

	.theme-toggle:hover {
		background: var(--surface-2);
	}
</style>
