<script lang="ts">
	import { MAX_SYMBOLS, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Button, Field, InfoTip } from '$lib/ui';
	import { declaredSymbols, errorAt, freeSymbol, freshIds, type RowIds } from './editor';
	import FormulaInput from './FormulaInput.svelte';
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
	const who = (i: number) => model.intermediates[i].symbol || String(i + 1);

	function add() {
		model.intermediates.push({ symbol: freeSymbol(model, 'm'), name: '', formula: '' });
		ids.intermediates.push(...freshIds(1));
	}

	function remove(i: number) {
		model.intermediates.splice(i, 1);
		ids.intermediates.splice(i, 1);
	}
</script>

<section class="stack section" aria-labelledby="intermediates-heading">
	<div class="section-head">
		<h3 id="intermediates-heading">Intermediates</h3>
		<InfoTip label="intermediates"
			>Named formulas that reuse inputs, other intermediates or the decision. Use them to break up a
			long reward.</InfoTip
		>
	</div>
	{#if model.intermediates.length}
		<div class="cols intermediate-cols" aria-hidden="true">
			<span>Symbol</span><span>Name</span>
		</div>
	{/if}
	{#each model.intermediates as m, i (ids.intermediates[i])}
		<div class="row intermediate-cols" data-testid="intermediate-row">
			<SymbolInput
				hideLabel
				name="Symbol of intermediate {who(i)}"
				symbol={m.symbol}
				{declared}
				{onrename}
				error={errorAt(errors, { kind: 'intermediate', index: i, field: 'symbol' })?.message}
			/>
			<Field label="Name" hideLabel>
				{#snippet children(props)}
					<input
						class="control"
						type="text"
						aria-label="Name of intermediate {who(i)}"
						bind:value={m.name}
						{...props}
					/>
				{/snippet}
			</Field>
			<Button variant="ghost" size="sm" class="remove" onclick={() => remove(i)}
				><span aria-hidden="true">✕</span><span class="sr-only">Remove intermediate {who(i)}</span
				></Button
			>
			<div class="formula">
				<FormulaInput
					hideLabel
					name="Formula for {who(i)}"
					value={m.formula}
					onchange={(v) => (m.formula = v)}
					symbols={declared.filter((s) => s !== m.symbol)}
					error={errorAt(errors, { kind: 'intermediate', index: i, field: 'formula' })}
				/>
			</div>
		</div>
	{:else}
		<p class="muted">None yet. Add one to name a step of the reward.</p>
	{/each}
	<div><Button size="sm" onclick={add} disabled={full}>Add intermediate</Button></div>
</section>
