<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Common = {
		/** primary: the one main action; secondary: everything else; ghost: low emphasis; danger: destructive. */
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'md' | 'sm';
		/** Set for toggle buttons; renders aria-pressed. */
		pressed?: boolean;
		children: Snippet;
	};
	type Props = Common &
		((HTMLButtonAttributes & { href?: undefined }) | (HTMLAnchorAttributes & { href: string }));

	let {
		variant = 'secondary',
		size = 'md',
		pressed,
		children,
		class: className = '',
		...rest
	}: Props = $props();
</script>

{#if rest.href !== undefined}
	<a class="btn {variant} {size} {className}" {...rest as HTMLAnchorAttributes}
		>{@render children()}</a
	>
{:else}
	<button
		type="button"
		class="btn {variant} {size} {className}"
		aria-pressed={pressed}
		{...rest as HTMLButtonAttributes}>{@render children()}</button
	>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
		padding: 0 var(--sp-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.btn.sm {
		min-height: var(--control-h-sm);
		padding: 0 var(--sp-2);
		font-size: var(--text-sm);
	}

	.btn:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}

	.primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
		color: var(--on-accent);
	}

	.ghost {
		background: transparent;
		border-color: transparent;
	}

	.danger {
		color: var(--danger-text);
		border-color: var(--danger);
	}

	.danger:hover:not(:disabled) {
		background: var(--danger-bg);
		color: var(--danger-text);
	}

	.btn[aria-pressed='true'] {
		background: var(--accent-bg);
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
