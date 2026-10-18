<script lang="ts" generics="T extends string">
	const uid = $props.id();

	let {
		legend,
		options,
		value = $bindable(),
		hideLegend = false,
		name = `seg-${uid}`
	}: {
		legend: string;
		/** `icon` is decorative (e.g. an emoji) and hidden from screen readers. */
		options: readonly { value: T; label: string; icon?: string }[];
		value: T;
		hideLegend?: boolean;
		name?: string;
	} = $props();
</script>

<fieldset class="ui-segmented">
	<legend class:sr-only={hideLegend}>{legend}</legend>
	<div class="ui-options">
		{#each options as option (option.value)}
			<label class:checked={value === option.value}>
				<input type="radio" {name} value={option.value} bind:group={value} />
				{#if option.icon}<span class="ui-seg-icon" aria-hidden="true">{option.icon}</span>{/if}
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.ui-segmented {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.ui-options {
		display: inline-flex;
		flex-wrap: wrap;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		overflow: hidden;
	}

	label {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: var(--control-h);
		padding: 0 var(--sp-3);
		background: var(--surface);
		cursor: pointer;
		user-select: none;
	}

	label + label {
		border-left: 1px solid var(--border-strong);
	}

	label:hover {
		background: var(--surface-2);
	}

	label.checked {
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}

	.ui-seg-icon {
		margin-right: var(--sp-1);
	}

	input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}

	label:has(input:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: -4px;
	}

	label.checked:has(input:focus-visible) {
		outline-color: var(--on-accent);
	}
</style>
