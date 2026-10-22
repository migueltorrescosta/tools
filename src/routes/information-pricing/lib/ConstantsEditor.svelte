<script lang="ts">
	import { MAX_SYMBOLS, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Button, Field } from '$lib/ui';
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
	const who = (i: number) => model.constants[i].symbol || String(i + 1);

	function add() {
		model.constants.push({ symbol: freeSymbol(model, 'c'), value: 1, name: '' });
		ids.constants.push(...freshIds(1));
	}

	function remove(i: number) {
		model.constants.splice(i, 1);
		ids.constants.splice(i, 1);
	}
</script>

<section class="stack section" aria-labelledby="constants-heading">
	<h3 id="constants-heading">Constants</h3>
	{#if model.constants.length}
		<div class="cols constant-cols" aria-hidden="true"><span>Symbol</span><span>Name</span></div>
	{/if}
	{#each model.constants as c, i (ids.constants[i])}
		<div class="row constant-cols" data-testid="constant-row">
			<SymbolInput
				hideLabel
				name="Symbol of constant {who(i)}"
				symbol={c.symbol}
				{declared}
				{onrename}
				error={errorAt(errors, { kind: 'constant', index: i, field: 'symbol' })?.message}
			/>
			<Field label="Name" hideLabel>
				{#snippet children(props)}
					<input
						class="control"
						type="text"
						aria-label="Name of constant {who(i)}"
						bind:value={c.name}
						{...props}
					/>
				{/snippet}
			</Field>
			<Button variant="ghost" size="sm" class="remove" onclick={() => remove(i)}
				><span aria-hidden="true">✕</span><span class="sr-only">Remove constant {who(i)}</span
				></Button
			>
		</div>
	{:else}
		<p class="muted">No constants yet.</p>
	{/each}
	<div><Button size="sm" onclick={add} disabled={full}>Add constant</Button></div>
</section>
