<script lang="ts">
	import { onMount } from 'svelte';
	import { initTheme, setMode, theme, type Mode } from '#lib/theme.svelte.js';

	onMount(initTheme);

	const options: { mode: Mode; label: string; name: string }[] = [
		{ mode: 'light', label: 'Light theme', name: 'Light' },
		{ mode: 'system', label: 'Match device theme', name: 'Match device' },
		{ mode: 'dark', label: 'Dark theme', name: 'Dark' }
	];
	const current = $derived(options.find((o) => o.mode === theme.mode) ?? options[1]);

	// On a phone the three buttons fold into one that opens them (owner, 2026-11-11),
	// so the breadcrumb keeps room for the tool's name.
	let open = $state(false);
	let compact: HTMLDivElement | undefined = $state();
	function pick(mode: Mode) {
		setMode(mode);
		open = false;
	}
	function onPointer(e: PointerEvent) {
		if (open && compact && !compact.contains(e.target as Node)) open = false;
	}
	function onKey(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			open = false;
			compact?.querySelector<HTMLButtonElement>('.compact-toggle')?.focus();
		}
	}
</script>

<svelte:window onpointerdown={onPointer} onkeydown={onKey} />

{#snippet icon(mode: Mode)}
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
		{#if mode === 'light'}
			<circle cx="12" cy="12" r="4.5" />
			<path
				d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
			/>
		{:else if mode === 'system'}
			<rect x="3" y="4" width="18" height="12" rx="2" />
			<path d="M8 20h8M12 16v4" />
		{:else}
			<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
		{/if}
	</svg>
{/snippet}

<div class="theme-switch" role="group" aria-label="Theme">
	{#each options as o (o.mode)}
		<button
			type="button"
			aria-label={o.label}
			title={o.label}
			aria-pressed={theme.mode === o.mode}
			onclick={() => setMode(o.mode)}
		>
			{@render icon(o.mode)}
		</button>
	{/each}
</div>

<div class="theme-compact" bind:this={compact}>
	<button
		type="button"
		class="compact-toggle"
		aria-label="Theme: {current.name}"
		aria-expanded={open}
		aria-controls="theme-options"
		onclick={() => (open = !open)}
	>
		{@render icon(current.mode)}
	</button>
	{#if open}
		<div class="compact-options" id="theme-options" role="group" aria-label="Theme">
			{#each options as o (o.mode)}
				<button type="button" aria-pressed={theme.mode === o.mode} onclick={() => pick(o.mode)}>
					{@render icon(o.mode)}<span>{o.name}</span>
				</button>
			{/each}
		</div>
	{/if}
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
	.theme-switch button,
	.compact-toggle {
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
	.theme-switch button:hover,
	.compact-toggle:hover {
		color: var(--text);
	}
	.theme-switch button[aria-pressed='true'] {
		background: var(--accent-bg);
		border-color: var(--accent);
		color: var(--text);
	}
	.theme-compact {
		display: none;
		position: relative;
		flex: none;
	}
	.compact-toggle {
		border-color: var(--border);
		color: var(--text);
	}
	.compact-options {
		position: absolute;
		right: 0;
		top: calc(100% + var(--sp-1));
		z-index: 60;
		display: flex;
		flex-direction: column;
		min-width: 11rem;
		padding: var(--sp-1);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--box-shadow);
	}
	.compact-options button {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: 44px;
		padding: 0 var(--sp-2);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.compact-options button[aria-pressed='true'] {
		background: var(--accent-bg);
		border-color: var(--accent);
	}
	@media (pointer: coarse) {
		.theme-switch button,
		.compact-toggle {
			width: 44px;
			height: 44px;
		}
	}
	/* Phones: one button that opens the three choices. */
	@media (max-width: 40rem) {
		.theme-switch {
			display: none;
		}
		.theme-compact {
			display: block;
		}
	}
</style>
