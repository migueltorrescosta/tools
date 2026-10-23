<script lang="ts">
	import { defaultParams, familyInfo } from '$lib/information-pricing/distributions';
	import { MAX_SYMBOLS, type ModelError } from '$lib/information-pricing/model';
	import type { Family, Model } from '$lib/information-pricing/types';
	import { Button, Field, InfoTip } from '$lib/ui';
	import AddInputMenu from './AddInputMenu.svelte';
	import { declaredSymbols, errorAt, freeSymbol, freshIds, inputNode, type RowIds } from './editor';
	import NumberInput from './NumberInput.svelte';
	import SymbolInput from './SymbolInput.svelte';

	let {
		model = $bindable(),
		ids = $bindable(),
		errors,
		onrename,
		selected = null
	}: {
		model: Model;
		ids: RowIds;
		errors: readonly ModelError[];
		onrename: (from: string, to: string) => void;
		/** The dataflow node picked in the graph; its row is highlighted. */
		selected?: string | null;
	} = $props();

	const declared = $derived(declaredSymbols(model));
	const full = $derived(declared.length >= MAX_SYMBOLS);
	const who = (i: number) => model.inputs[i].symbol || String(i + 1);

	function add(family: Family) {
		model.inputs.push({
			symbol: freeSymbol(model, 'X'),
			name: '',
			family,
			params: defaultParams(family)
		});
		ids.inputs.push(...freshIds(1));
	}

	function remove(i: number) {
		model.inputs.splice(i, 1);
		ids.inputs.splice(i, 1);
	}
</script>

<section class="stack section inputs" aria-labelledby="inputs-heading">
	<div class="section-head">
		<h3 id="inputs-heading">Inputs</h3>
		<InfoTip label="inputs"
			>The things you're unsure about, each with a distribution. Pick Fixed for a number you already
			know.</InfoTip
		>
	</div>
	{#if model.inputs.length}
		<div class="cols input-cols" aria-hidden="true">
			<span>Distribution</span><span>Name</span><span>Symbol</span><span class="params-head"
				>Parameters</span
			>
		</div>
	{/if}
	{#each model.inputs as input, i (ids.inputs[i])}
		{@const family = familyInfo(input.family)}
		{@const familyError = errorAt(errors, {
			kind: 'input',
			index: i,
			field: 'params',
			param: -1
		})}
		<div
			class="row input-cols"
			class:selected={selected === inputNode(ids.inputs[i])}
			data-node={inputNode(ids.inputs[i])}
			data-testid="input-row"
		>
			<span class="family" data-testid="family">{family.name}</span>
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
			<SymbolInput
				hideLabel
				name="Symbol of input {who(i)}"
				symbol={input.symbol}
				{declared}
				{onrename}
				error={errorAt(errors, { kind: 'input', index: i, field: 'symbol' })?.message}
			/>
			<div class="params">
				{#each family.params as p, k (`${input.family}-${k}`)}
					<NumberInput
						label={p.label}
						name="{p.label} of input {who(i)}"
						value={input.params[k]}
						onchange={(v) => (input.params[k] = v)}
						error={errorAt(errors, { kind: 'input', index: i, field: 'params', param: k })?.message}
					/>
				{/each}
			</div>
			<Button variant="ghost" size="sm" class="remove" onclick={() => remove(i)}
				><span aria-hidden="true">✕</span><span class="sr-only">Remove input {who(i)}</span></Button
			>
			{#if familyError}<p class="row-error">{familyError.message}</p>{/if}
		</div>
	{/each}
	<div><AddInputMenu onadd={add} disabled={full} /></div>
</section>

<style>
	.family {
		padding-top: 6px;
		font-size: var(--text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.params {
		display: flex;
		gap: var(--sp-1);
		min-width: 0;
	}
	/* A short label left of each parameter field, its error below both. */
	.params > :global(.ui-field) {
		flex: 1 1 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--sp-0) 3px;
	}
	.params :global(.ui-field > label) {
		font-size: var(--text-xs);
		font-weight: 400;
		color: var(--text-muted);
	}
	.params :global(.ui-field > .ui-error) {
		grid-column: 1 / -1;
	}
	.params :global(input) {
		padding-inline: 5px;
	}
	.row-error {
		grid-column: 1 / -1;
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger-text);
	}
</style>
