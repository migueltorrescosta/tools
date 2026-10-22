<script lang="ts">
	import { FAMILIES, defaultParams } from '$lib/information-pricing/distributions';
	import { MAX_SYMBOLS, type ModelError } from '$lib/information-pricing/model';
	import type { Family, Model } from '$lib/information-pricing/types';
	import { Button, Field, InfoTip } from '$lib/ui';
	import { declaredSymbols, errorAt, freeSymbol, freshIds, type RowIds } from './editor';
	import SymbolInput from './SymbolInput.svelte';

	let {
		model = $bindable(),
		ids = $bindable(),
		errors,
		onrename
	}: {
		model: Model;
		ids: RowIds;
		errors: readonly ModelError[];
		onrename: (from: string, to: string) => void;
	} = $props();

	const declared = $derived(declaredSymbols(model));
	const full = $derived(declared.length >= MAX_SYMBOLS);
	const who = (i: number) => model.inputs[i].symbol || String(i + 1);

	function add() {
		model.inputs.push({
			symbol: freeSymbol(model, 'X'),
			name: '',
			family: 'normal',
			params: defaultParams('normal')
		});
		ids.inputs.push(...freshIds(1));
	}

	function remove(i: number) {
		model.inputs.splice(i, 1);
		ids.inputs.splice(i, 1);
	}

	function setFamily(i: number, family: Family) {
		model.inputs[i].family = family;
		model.inputs[i].params = defaultParams(family);
	}
</script>

<section class="stack section" aria-labelledby="inputs-heading">
	<div class="section-head">
		<h3 id="inputs-heading">Inputs</h3>
		<InfoTip label="inputs"
			>The things you're unsure about, each with a distribution. Pick Fixed for a number you already
			know.</InfoTip
		>
	</div>
	{#if model.inputs.length}
		<div class="cols input-cols" aria-hidden="true">
			<span>Symbol</span><span>Name</span><span>Distribution</span>
		</div>
	{/if}
	{#each model.inputs as input, i (ids.inputs[i])}
		<div class="row input-cols" data-testid="input-row">
			<SymbolInput
				hideLabel
				name="Symbol of input {who(i)}"
				symbol={input.symbol}
				{declared}
				{onrename}
				error={errorAt(errors, { kind: 'input', index: i, field: 'symbol' })?.message}
			/>
			<Field label="Name" hideLabel>
				{#snippet children(props)}
					<input
						class="control"
						type="text"
						aria-label="Name of input {who(i)}"
						bind:value={input.name}
						{...props}
					/>
				{/snippet}
			</Field>
			<Field label="Distribution" hideLabel>
				{#snippet children(props)}
					<select
						class="control"
						aria-label="Distribution of input {who(i)}"
						value={input.family}
						onchange={(e) => setFamily(i, e.currentTarget.value as Family)}
						{...props}
					>
						{#each FAMILIES as f (f.family)}
							<option value={f.family}>{f.name}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
			<Button variant="ghost" size="sm" class="remove" onclick={() => remove(i)}
				><span aria-hidden="true">✕</span><span class="sr-only">Remove input {who(i)}</span></Button
			>
		</div>
	{/each}
	<div><Button size="sm" onclick={add} disabled={full}>Add input</Button></div>
</section>
