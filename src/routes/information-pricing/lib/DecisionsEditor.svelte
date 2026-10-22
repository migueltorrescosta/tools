<script lang="ts">
	import { decisionLabels, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Button, Field } from '$lib/ui';
	import { declaredSymbols, errorAt, freshIds, type RowIds } from './editor';
	import FormulaInput from './FormulaInput.svelte';
	import NumberInput from './NumberInput.svelte';
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

	const d = $derived(model.decisions);
	const declared = $derived(declaredSymbols(model));
	const labels = $derived(decisionLabels(d));

	let draft = $state(NaN);
	const draftProblem = $derived(
		Number.isFinite(draft) && d.values.includes(draft)
			? `${draft} is already a decision.`
			: undefined
	);
	const canAdd = $derived(Number.isFinite(draft) && !draftProblem && d.values.length < 100);

	function add() {
		if (!canAdd) return;
		model.decisions.values.push(draft);
		ids.values.push(...freshIds(1));
		draft = NaN;
	}

	function remove(i: number) {
		model.decisions.values.splice(i, 1);
		ids.values.splice(i, 1);
	}

	const valuesError = $derived(
		errors.find((e) => e.where.kind === 'decisions' && e.where.field === 'values')
	);
</script>

<section class="stack section" aria-labelledby="decisions-heading">
	<h3 id="decisions-heading">Decisions</h3>
	<div class="fields">
		<SymbolInput
			label="Decision symbol"
			symbol={d.symbol}
			{declared}
			{onrename}
			error={errorAt(errors, { kind: 'decisions', field: 'symbol' })?.message}
		/>
		<Field label="Unit" hint="Like €, $ or M€.">
			{#snippet children(props)}
				<input class="control" type="text" bind:value={model.decisions.unit} {...props} />
			{/snippet}
		</Field>
	</div>
	<div class="stack" style="--gap: var(--sp-1)">
		<span class="sublabel" id="values-label">Values</span>
		<ul class="chips" aria-labelledby="values-label" data-testid="decision-values">
			{#each d.values as v, i (ids.values[i])}
				{@const bad = errorAt(errors, { kind: 'decisions', field: 'values', index: i })}
				<li class="chip" class:bad>
					<span class="mono">{v}</span>
					<button
						type="button"
						class="chip-remove"
						aria-label="Remove decision value {v}"
						onclick={() => remove(i)}><span aria-hidden="true">✕</span></button
					>
				</li>
			{/each}
		</ul>
		{#if valuesError}<p class="error" role="status">{valuesError.message}</p>{/if}
		<form
			class="add-value"
			onsubmit={(e) => {
				e.preventDefault();
				add();
			}}
		>
			<NumberInput
				label="New decision value"
				optional
				value={draft}
				onchange={(v) => (draft = v)}
				error={draftProblem}
			/>
			<Button size="sm" type="submit" disabled={!canAdd}>Add decision value</Button>
		</form>
	</div>
	<Field
		label="Label template"
		hint={labels.length
			? `Shows as: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}`
			: undefined}
		error={errorAt(errors, { kind: 'decisions', field: 'label' })?.message}
	>
		{#snippet children(props)}
			<input class="control" type="text" bind:value={model.decisions.label} {...props} />
		{/snippet}
	</Field>
	<FormulaInput
		label="Reward formula"
		value={d.reward}
		onchange={(v) => (model.decisions.reward = v)}
		symbols={declared}
		error={errorAt(errors, { kind: 'reward' })}
		testId="reward"
	/>
</section>

<style>
	.sublabel {
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		padding: 0 0 0 var(--sp-2);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--surface-2);
		font-size: var(--text-sm);
	}
	.chip.bad {
		border-color: var(--danger);
	}
	.chip-remove {
		min-width: 28px;
		min-height: 28px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.chip-remove:hover {
		color: var(--danger-text);
	}
	.mono {
		font-family: var(--font-mono);
	}
	.add-value {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.add-value :global(.ui-field) {
		flex: 1 1 9rem;
	}
	.add-value :global(button) {
		margin-top: 22px;
	}
	.error {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger-text);
	}
</style>
