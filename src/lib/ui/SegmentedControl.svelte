<!--
	The single-choice picker for a few short options (Format, language, view mode).
	Pickers: SegmentedControl for one of a few; a Select for one of many long options;
	pressed Buttons (aria-pressed) only for independent toggles, many of many (verb chips).
	One of many short chips (Volt's country filter) is a radio group styled as chips.
-->
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
		/** `icon` is decorative (e.g. an emoji) and hidden from screen readers; `title` explains a disabled option. */
		options: readonly {
			value: T;
			label: string;
			icon?: string;
			disabled?: boolean;
			title?: string;
		}[];
		value: T;
		hideLegend?: boolean;
		name?: string;
	} = $props();
</script>

<fieldset class="ui-segmented">
	<legend class:sr-only={hideLegend}>{legend}</legend>
	<div class="ui-options">
		{#each options as option (option.value)}
			<label
				class:checked={value === option.value}
				class:disabled={option.disabled}
				title={option.title}
			>
				<input
					type="radio"
					{name}
					value={option.value}
					disabled={option.disabled}
					bind:group={value}
				/>
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

	/* The 1px gap shows the border colour between segments, also between wrapped rows */
	.ui-options {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 1px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--border-strong);
		overflow: hidden;
	}

	/* Segments grow, so a wrapped row fills the width instead of leaving a gap */
	label {
		position: relative;
		flex: 1 1 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--control-h);
		padding: 0 var(--sp-3);
		background: var(--surface);
		cursor: pointer;
		user-select: none;
	}

	label:hover {
		background: var(--surface-2);
	}

	label.disabled {
		color: var(--text-muted);
		cursor: not-allowed;
	}

	label.disabled:hover {
		background: var(--surface);
	}

	label.disabled input {
		cursor: not-allowed;
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
