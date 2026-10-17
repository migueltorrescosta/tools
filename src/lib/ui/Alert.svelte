<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'info',
		children
	}: {
		/** danger is announced immediately (role=alert); the others politely (role=status). */
		tone?: 'info' | 'success' | 'warning' | 'danger';
		children: Snippet;
	} = $props();

	// A symbol alongside the colour, so the tone never depends on colour alone.
	const icons = { info: 'ℹ', success: '✓', warning: '!', danger: '✕' } as const;
</script>

<div class="ui-alert {tone}" role={tone === 'danger' ? 'alert' : 'status'}>
	<span class="ui-icon" aria-hidden="true">{icons[tone]}</span>
	<div>{@render children()}</div>
</div>

<style>
	.ui-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid;
		border-radius: var(--radius);
	}

	.ui-icon {
		font-weight: 700;
		min-width: 1ch;
	}

	.info {
		background: var(--info-bg);
		border-color: var(--info);
		color: var(--info-text);
	}

	.success {
		background: var(--success-bg);
		border-color: var(--success);
		color: var(--success-text);
	}

	.warning {
		background: var(--warning-bg);
		border-color: var(--warning);
		color: var(--warning-text);
	}

	.danger {
		background: var(--danger-bg);
		border-color: var(--danger);
		color: var(--danger-text);
	}
</style>
