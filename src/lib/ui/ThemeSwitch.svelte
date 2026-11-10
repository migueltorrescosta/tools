<script lang="ts">
	import { onMount } from 'svelte';
	import { initTheme, setMode, theme, type Mode } from '#lib/theme.svelte.js';

	onMount(initTheme);

	const options: { mode: Mode; label: string }[] = [
		{ mode: 'light', label: 'Light theme' },
		{ mode: 'system', label: 'Match device theme' },
		{ mode: 'dark', label: 'Dark theme' }
	];
</script>

<div class="theme-switch" role="group" aria-label="Theme">
	{#each options as o (o.mode)}
		<button
			type="button"
			aria-label={o.label}
			title={o.label}
			aria-pressed={theme.mode === o.mode}
			onclick={() => setMode(o.mode)}
		>
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#if o.mode === 'light'}
					<circle cx="12" cy="12" r="4.5" />
					<path
						d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
					/>
				{:else if o.mode === 'system'}
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path d="M8 20h8M12 16v4" />
				{:else}
					<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
				{/if}
			</svg>
		</button>
	{/each}
</div>

<style>
	.theme-switch {
		flex: none;
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	button {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	button:hover {
		color: var(--text);
	}
	button[aria-pressed='true'] {
		background: var(--accent-bg);
		border-color: var(--accent);
		color: var(--text);
	}
	@media (pointer: coarse) {
		button {
			width: 44px;
			height: 44px;
		}
	}
</style>
