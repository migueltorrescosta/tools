<script lang="ts">
	import { DECISION_NODE, REWARD_NODE } from '$lib/information-pricing/dataflow';
	import { decisionLabels, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Button, Field, InfoTip } from '$lib/ui';
	import { declaredSymbols, errorAt, freshIds, type RowIds } from './editor';
	import FormulaInput from './FormulaInput.svelte';
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
		/** The dataflow node picked in the graph; its fields are highlighted. */
		selected?: string | null;
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

	function addValue() {
		if (!canAdd) return;
		model.decisions.values.push(draft);
		ids.values.push(...freshIds(1));
		draft = NaN;
	}

	function removeValue(i: number) {
		model.decisions.values.splice(i, 1);
		ids.values.splice(i, 1);
	}

	const valuesError = $derived(
		errors.find((e) => e.where.kind === 'decisions' && e.where.field === 'values')
	);
</script>

<section class="stack section" aria-labelledby="decisions-heading">
	<div class="section-head">
		<h3 id="decisions-heading">Decisions</h3>
		<InfoTip label="decisions"
			>The options you choose between, how each one is labelled, and the reward to maximise.</InfoTip
		>
	</div>
	<div
		class="stack decision"
		class:selected={selected === DECISION_NODE}
		data-node={DECISION_NODE}
		style="--gap: var(--sp-2)"
	>
		<div class="decision-fields">
			<SymbolInput
				label="Decision symbol"
				symbol={d.symbol}
				{declared}
				{onrename}
				error={errorAt(errors, { kind: 'decisions', field: 'symbol' })?.message}
			/>
			<Field label="Unit">
				{#snippet children(props)}
					<input
						class="control"
						type="text"
						placeholder="€"
						bind:value={model.decisions.unit}
						{...props}
					/>
				{/snippet}
			</Field>
			<Field
				label="Label template"
				error={errorAt(errors, { kind: 'decisions', field: 'label' })?.message}
			>
				{#snippet children(props)}
					<input class="control" type="text" bind:value={model.decisions.label} {...props} />
				{/snippet}
			</Field>
		</div>
		<div class="values">
			<span class="values-label" id="values-heading">Values</span>
			<ul class="chips" aria-labelledby="values-heading" data-testid="decision-values">
				{#each d.values as v, i (ids.values[i])}
					{@const bad = errorAt(errors, { kind: 'decisions', field: 'values', index: i })}
					<li class="chip" class:bad title={labels[i]}>
						<span class="mono">{v}</span>
						<button
							type="button"
							class="chip-remove"
							aria-label="Remove decision value {v}"
							onclick={() => removeValue(i)}><span aria-hidden="true">✕</span></button
						>
					</li>
				{/each}
				<li class="add-value">
					<form
						onsubmit={(e) => {
							e.preventDefault();
							addValue();
						}}
					>
						<NumberInput
							label="New decision value"
							hideLabel
							optional
							value={draft}
							onchange={(v) => (draft = v)}
							error={draftProblem}
						/>
						<Button size="sm" type="submit" disabled={!canAdd}
							><span aria-hidden="true">+</span><span class="sr-only">Add decision value</span
							></Button
						>
					</form>
				</li>
			</ul>
		</div>
		{#if valuesError}<p class="error" role="status">{valuesError.message}</p>{/if}
	</div>
	<div class="reward" class:selected={selected === REWARD_NODE} data-node={REWARD_NODE}>
		<FormulaInput
			label="Reward formula"
			value={d.reward}
			onchange={(v) => (model.decisions.reward = v)}
			symbols={declared}
			error={errorAt(errors, { kind: 'reward' })}
			testId="reward"
		/>
	</div>
</section>

<style>
	.decision-fields {
		display: grid;
		grid-template-columns: minmax(0, 6.5rem) minmax(0, 3.5rem) minmax(0, 1fr);
		gap: var(--sp-2);
	}
	.values {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
	}
	.values-label {
		padding-top: 5px;
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.mono {
		font-family: var(--font-mono);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0;
		height: var(--control-h-sm);
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
		min-width: 26px;
		min-height: 26px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.chip-remove:hover {
		color: var(--danger-text);
	}
	.add-value form {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-1);
	}
	.add-value :global(.ui-field) {
		width: 5.5rem;
	}
	.add-value :global(input) {
		height: var(--control-h-sm);
	}
	.error {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger-text);
	}
</style>
