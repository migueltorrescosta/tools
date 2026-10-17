<script lang="ts">
	import type { Snippet } from 'svelte';

	const uid = $props.id();

	type ControlProps = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: 'true' };

	let {
		label,
		hint,
		error,
		hideLabel = false,
		id = `field-${uid}`,
		children
	}: {
		label: string;
		hint?: string;
		error?: string;
		/** Keep the label for screen readers only, when the context already names the control. */
		hideLabel?: boolean;
		id?: string;
		/** Render the control and spread `props` on it, e.g. `<input class="control" {...props} />`. */
		children: Snippet<[ControlProps]>;
	} = $props();

	const describedBy = $derived(
		[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="ui-field">
	<label for={id} class:sr-only={hideLabel}>{label}</label>
	{@render children({
		id,
		'aria-describedby': describedBy,
		'aria-invalid': error ? 'true' : undefined
	})}
	{#if hint}<p id="{id}-hint" class="ui-hint">{hint}</p>{/if}
	{#if error}<p id="{id}-error" class="ui-error">{error}</p>{/if}
</div>

<style>
	.ui-field {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		min-width: 0;
	}

	label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text);
	}

	.ui-hint,
	.ui-error {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.ui-error {
		color: var(--danger-text);
	}
</style>
