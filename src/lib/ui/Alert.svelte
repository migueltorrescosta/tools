<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'info',
		live = true,
		children
	}: {
		/** danger is announced immediately (role=alert); the others politely (role=status). */
		tone?: 'info' | 'success' | 'warning' | 'danger';
		/** false drops the role, for a message inside an existing live region or one that is not news. */
		live?: boolean;
		children: Snippet;
	} = $props();

	// A symbol alongside the colour, so the tone never depends on colour alone.
	const icons = { info: 'ℹ', success: '✓', warning: '!', danger: '✕' } as const;
</script>

<div class="ui-alert {tone}" role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
	<span class="ui-icon" aria-hidden="true">{icons[tone]}</span>
	<div class="ui-alert-text">{@render children()}</div>
</div>

<style>
	/* A message is its symbol and coloured text, no box (owner, 2026-11 redesign). */
	.ui-alert {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
	}
	.ui-alert-text {
		min-width: 0;
		overflow-wrap: break-word;
	}
	.ui-icon {
		font-weight: 700;
		min-width: 1ch;
	}
	.info {
		color: var(--info-text);
	}
	.success {
		color: var(--success-text);
	}
	.warning {
		color: var(--warning-text);
	}
	.danger {
		color: var(--danger-text);
	}
</style>
