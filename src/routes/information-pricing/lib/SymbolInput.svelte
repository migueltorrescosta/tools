<script lang="ts">
	import { untrack } from 'svelte';
	import { symbolProblem } from '$lib/information-pricing/model';
	import { Field } from '$lib/ui';

	let {
		label = 'Symbol',
		name,
		symbol,
		declared,
		onrename,
		error
	}: {
		label?: string;
		/** Accessible name, e.g. "Symbol of input X". */
		name?: string;
		/** The committed symbol. */
		symbol: string;
		/** Every symbol the model declares, this one included. */
		declared: readonly string[];
		/** Rename the symbol (and the formulas that use it). */
		onrename: (from: string, to: string) => void;
		error?: string;
	} = $props();

	let text = $state(untrack(() => symbol));
	$effect(() => {
		const s = symbol;
		untrack(() => (text = s));
	});

	const taken = (t: string) => t !== symbol && declared.includes(t);
	const local = $derived(
		text === symbol
			? null
			: (symbolProblem(text) ?? (taken(text) ? `"${text}" is already declared` : null))
	);

	/** Valid new names apply as you type; anything else waits for Enter or leaving the field. */
	function oninput(e: Event & { currentTarget: HTMLInputElement }) {
		text = e.currentTarget.value;
		if (text !== symbol && local === null) onrename(symbol, text);
	}
	function onchange() {
		if (text !== symbol) onrename(symbol, text);
	}
</script>

<Field {label} error={local ?? error}>
	{#snippet children(props)}
		<input
			class="control mono"
			type="text"
			autocomplete="off"
			spellcheck="false"
			aria-label={name}
			value={text}
			{oninput}
			{onchange}
			{...props}
		/>
	{/snippet}
</Field>

<style>
	.mono {
		font-family: var(--font-mono);
	}
</style>
