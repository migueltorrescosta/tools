<script lang="ts">
	import { untrack } from 'svelte';
	import { Field } from '$lib/ui';

	let {
		label,
		name,
		value,
		onchange,
		error,
		hideLabel = false,
		optional = false
	}: {
		/** Visible label. */
		label: string;
		/** Accessible name when it should say more than the label, e.g. "μ of input X". */
		name?: string;
		value: number;
		/** Called on every edit; NaN while the text is not a number. */
		onchange: (value: number) => void;
		error?: string;
		/** Keep the label for screen readers only (a column header names the field). */
		hideLabel?: boolean;
		/** An empty field is not an error (e.g. a "new value" box). */
		optional?: boolean;
	} = $props();

	const show = (v: number) => (Number.isFinite(v) ? String(v) : '');
	const read = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(/[\s,_]/g, '')));

	let text = $state(untrack(() => show(value)));

	// Follow outside changes (a preset, a restore) without fighting the user's typing.
	$effect(() => {
		const v = value;
		untrack(() => {
			if (!Object.is(read(text), v)) text = show(v);
		});
	});

	const own = $derived(
		Number.isFinite(read(text)) || (optional && text.trim() === '') ? undefined : 'Enter a number.'
	);
</script>

<Field {label} {hideLabel} error={own ?? error}>
	{#snippet children(props)}
		<input
			class="control num"
			type="text"
			inputmode="decimal"
			autocomplete="off"
			spellcheck="false"
			aria-label={name}
			value={text}
			oninput={(e) => {
				text = e.currentTarget.value;
				onchange(read(text));
			}}
			{...props}
		/>
	{/snippet}
</Field>

<style>
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
