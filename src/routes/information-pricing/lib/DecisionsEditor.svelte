<script lang="ts">
	import { decisionLabels, type ModelError } from '$lib/information-pricing/model';
	import type { Model } from '$lib/information-pricing/types';
	import { Field, InfoTip } from '$lib/ui';
	import { declaredSymbols, errorAt } from './editor';
	import FormulaInput from './FormulaInput.svelte';
	import SymbolInput from './SymbolInput.svelte';

	let {
		model = $bindable(),
		errors,
		onrename
	}: {
		model: Model;
		errors: readonly ModelError[];
		onrename: (from: string, to: string) => void;
	} = $props();

	const d = $derived(model.decisions);
	const declared = $derived(declaredSymbols(model));
	const labels = $derived(decisionLabels(d));
</script>

<section class="stack section" aria-labelledby="decisions-heading">
	<div class="section-head">
		<h3 id="decisions-heading">Decisions</h3>
		<InfoTip label="decisions"
			>The options you choose between, how each one is labelled, and the reward to maximise.</InfoTip
		>
	</div>
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
			hint={labels.length
				? `Shows as: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}`
				: undefined}
			error={errorAt(errors, { kind: 'decisions', field: 'label' })?.message}
		>
			{#snippet children(props)}
				<input class="control" type="text" bind:value={model.decisions.label} {...props} />
			{/snippet}
		</Field>
	</div>
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
	.decision-fields {
		display: grid;
		grid-template-columns: minmax(0, 7rem) minmax(0, 5rem) minmax(0, 1fr);
		gap: var(--sp-2);
	}
</style>
