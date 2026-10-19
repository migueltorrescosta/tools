<script lang="ts">
	import { Field } from '$lib/ui';
	import { MAX_LAMBDA, MAX_RATE } from '$lib/ancilla-mzi/limits';
	import type { LorentzianKind, RegisterNoise } from '$lib/ancilla-mzi/types';

	let {
		noise = $bindable(),
		register,
		title,
		errorFor,
		kindReasons
	}: {
		noise: RegisterNoise;
		register: 'system' | 'ancilla';
		title: string;
		errorFor: (field: string) => string | undefined;
		/** Why a Lorentzian kind can't be picked, or null when it can. */
		kindReasons: Record<LorentzianKind, string | null>;
	} = $props();

	const markov = [
		{ key: 'dephasing', label: 'Dephasing σz, γ' },
		{ key: 'amplitudeDamping', label: 'Amplitude damping, γ' },
		{ key: 'depolarizing', label: 'Depolarizing, γ' },
		{ key: 'transverse', label: 'Transverse σx, γ' }
	] as const;

	const KINDS: { value: LorentzianKind; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'dephasing', label: 'Dephasing' },
		{ value: 'amplitudeDamping', label: 'Amplitude damping' }
	];

	const kindHint = $derived(
		KINDS.map((k) => kindReasons[k.value])
			.filter((r): r is string => r !== null)
			.filter((r, i, all) => all.indexOf(r) === i)
			.join(' ') || undefined
	);
	const f = (path: string) => errorFor(`noise.${register}.${path}`);
</script>

<fieldset class="column" data-testid="noise-{register}">
	<legend>{title}</legend>
	{#each markov as m (m.key)}
		<Field label={m.label} error={f(`markov.${m.key}`)}>
			{#snippet children(props)}
				<input
					class="control"
					type="number"
					min="0"
					max={MAX_RATE}
					step="0.1"
					bind:value={noise.markov[m.key]}
					data-testid="{register}-{m.key}"
					{...props}
				/>
			{/snippet}
		</Field>
	{/each}
	{#if noise.markov.amplitudeDamping > 0}
		<Field label="Thermal occupation n̄" error={f('markov.nbar')}>
			{#snippet children(props)}
				<input
					class="control"
					type="number"
					min="0"
					max={MAX_RATE}
					step="0.1"
					bind:value={noise.markov.nbar}
					data-testid="{register}-nbar"
					{...props}
				/>
			{/snippet}
		</Field>
	{/if}
	<Field label="Lorentzian bath" hint={kindHint} error={f('lorentzian.kind')}>
		{#snippet children(props)}
			<select
				class="control"
				bind:value={noise.lorentzian.kind}
				data-testid="{register}-lorentzian"
				{...props}
			>
				{#each KINDS as k (k.value)}
					<option
						value={k.value}
						disabled={k.value !== noise.lorentzian.kind && kindReasons[k.value] !== null}
						>{k.label}</option
					>
				{/each}
			</select>
		{/snippet}
	</Field>
	{#if noise.lorentzian.kind !== 'none'}
		<div class="pair">
			<Field label="γ" error={f('lorentzian.gamma')}>
				{#snippet children(props)}
					<input
						class="control"
						type="number"
						min="0"
						max={MAX_RATE}
						step="0.1"
						bind:value={noise.lorentzian.gamma}
						data-testid="{register}-lorentzian-gamma"
						{...props}
					/>
				{/snippet}
			</Field>
			<Field label="λ" error={f('lorentzian.lambda')}>
				{#snippet children(props)}
					<input
						class="control"
						type="number"
						min="0"
						max={MAX_LAMBDA}
						step="0.1"
						bind:value={noise.lorentzian.lambda}
						data-testid="{register}-lorentzian-lambda"
						{...props}
					/>
				{/snippet}
			</Field>
		</div>
	{/if}
</fieldset>

<style>
	.column {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-2);
	}
</style>
