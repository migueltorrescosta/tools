<script lang="ts">
	import { familyInfo } from '$lib/information-pricing/distributions';
	import { decisionLabels, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Button } from '$lib/ui';
	import { errorAt, freshIds, type RowIds } from './editor';
	import NumberInput from './NumberInput.svelte';

	/** The model's numbers: distribution parameters, constant values and decision values. */
	let {
		model = $bindable(),
		ids = $bindable(),
		errors
	}: {
		model: Model;
		ids: RowIds;
		errors: readonly ModelError[];
	} = $props();

	const d = $derived(model.decisions);
	const labels = $derived(decisionLabels(d));
	const inputWho = (i: number) => model.inputs[i].symbol || String(i + 1);
	const constantWho = (i: number) => model.constants[i].symbol || String(i + 1);

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

{#snippet who(name: string, symbol: string, detail?: string)}
	<span class="who">
		<span class="who-name">{name || symbol}</span>
		{#if name}<span class="mono">{symbol}</span>{/if}
		{#if detail}<span class="detail">{detail}</span>{/if}
	</span>
{/snippet}

<div class="columns params">
	<section class="card stack section" aria-labelledby="params-inputs-heading">
		<h3 id="params-inputs-heading">Random inputs</h3>
		{#each model.inputs as input, i (ids.inputs[i])}
			{@const family = familyInfo(input.family)}
			{@const familyError = errorAt(errors, {
				kind: 'input',
				index: i,
				field: 'params',
				param: -1
			})}
			<div class="param-row" data-testid="param-row">
				{@render who(input.name, input.symbol, family.name)}
				<div class="nums">
					{#each family.params as p, k (`${input.family}-${k}`)}
						<NumberInput
							label={p.label}
							name="{p.label} of input {inputWho(i)}"
							value={input.params[k]}
							onchange={(v) => (input.params[k] = v)}
							error={errorAt(errors, { kind: 'input', index: i, field: 'params', param: k })
								?.message}
						/>
					{/each}
				</div>
				{#if familyError}<p class="error">{familyError.message}</p>{/if}
			</div>
		{:else}
			<p class="muted">No inputs yet. Add them in Setup.</p>
		{/each}
	</section>

	<div class="stack column">
		{#if model.constants.length}
			<section class="card stack section" aria-labelledby="params-constants-heading">
				<h3 id="params-constants-heading">Constants</h3>
				{#each model.constants as c, i (ids.constants[i])}
					<div class="param-row" data-testid="constant-value-row">
						{@render who(c.name, c.symbol)}
						<div class="nums">
							<NumberInput
								label="Value"
								hideLabel
								name="Value of constant {constantWho(i)}"
								value={c.value}
								onchange={(v) => (c.value = v)}
								error={errorAt(errors, { kind: 'constant', index: i, field: 'value' })?.message}
							/>
						</div>
					</div>
				{/each}
			</section>
		{/if}

		<section class="card stack section" aria-labelledby="values-heading">
			<h3 id="values-heading">Decision values</h3>
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
			</ul>
			{#if valuesError}<p class="error" role="status">{valuesError.message}</p>{/if}
			<form
				class="add-value"
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
				<Button size="sm" type="submit" disabled={!canAdd}>Add decision value</Button>
			</form>
		</section>
	</div>
</div>

<style>
	.param-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-1) var(--sp-2);
		padding-top: var(--sp-2);
		border-top: 1px solid var(--border);
	}
	h3 + .param-row {
		padding-top: 0;
		border-top: 0;
	}
	.who {
		flex: 1 1 10rem;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 var(--sp-2);
		min-width: 0;
		padding-top: 6px;
		font-size: var(--text-sm);
	}
	.who-name {
		font-weight: 500;
	}
	.detail,
	.who .mono {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.nums {
		flex: 3 1 14rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: var(--sp-1) var(--sp-2);
		min-width: 0;
	}
	/* Label left of the field, error below both. */
	.nums :global(.ui-field) {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--sp-0) var(--sp-1);
	}
	.nums :global(.ui-field > label) {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-weight: 400;
	}
	.nums :global(.ui-field > .ui-error),
	.nums :global(.ui-field > .ui-hint) {
		grid-column: 1 / -1;
	}
	.error {
		flex-basis: 100%;
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger-text);
	}
	.mono {
		font-family: var(--font-mono);
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
	.add-value {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-2);
	}
	.add-value :global(.ui-field) {
		flex: 0 1 9rem;
	}
</style>
