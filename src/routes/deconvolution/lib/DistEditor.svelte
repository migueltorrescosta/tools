<script lang="ts">
	import { Button, Field } from '$lib/ui';
	import { FAMILIES, defaultParams, family, validateParams } from '$lib/deconvolution/families';
	import type { DistSpec, FamilyId, Role, SimpleSpec } from '$lib/deconvolution/types';

	/** Family and parameters of X (signal; may be a mixture) or Y (noise; no location). */
	let {
		spec = $bindable(),
		role,
		testId,
		label,
		allowMixture = true,
		continuousOnly = false
	}: {
		spec: DistSpec;
		role: Role;
		testId: string;
		/** Defaults to "Signal X" or "Noise Y". */
		label?: string;
		/** Offer "Mixture" for the signal (not for a 2D product's marginals). */
		allowMixture?: boolean;
		/** Only continuous families (a 2D noise's marginals). */
		continuousOnly?: boolean;
	} = $props();

	type Choice = FamilyId | 'mixture';
	const choices = $derived<{ value: Choice; label: string }[]>([
		...FAMILIES.filter((f) => !continuousOnly || !f.discrete).map((f) => ({
			value: f.id as Choice,
			label: f.name
		})),
		...(role === 'signal' && allowMixture ? [{ value: 'mixture' as Choice, label: 'Mixture' }] : [])
	]);

	function pick(value: Choice) {
		if (value === 'mixture') {
			spec = {
				family: 'mixture',
				components: [
					{ family: 'normal', params: [-2, 0.6], weight: 0.5 },
					{ family: 'normal', params: [2, 0.6], weight: 0.5 }
				]
			};
		} else spec = { family: value, params: defaultParams(value) };
	}

	/** Parameters a role shows: the noise hides the location (it is held at 0). */
	const shown = (id: FamilyId) =>
		family(id)
			.params.map((p, i) => ({ ...p, i }))
			.filter((p) => !(role === 'noise' && family(id).location === p.i));

	const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);

	function setFamily(c: SimpleSpec, id: FamilyId) {
		c.family = id;
		c.params = defaultParams(id);
	}

	/** In a mixture, families that match the kind (continuous or discrete) of the others. */
	const compatible = (index: number) => {
		if (spec.family !== 'mixture') return FAMILIES;
		const others = spec.components.filter((_, i) => i !== index);
		const kind = family(others[0].family).discrete;
		return FAMILIES.filter((f) => f.discrete === kind || others.length === 0);
	};
</script>

{#snippet params(c: SimpleSpec, prefix: string)}
	{@const errors = validateParams(c.family, c.params)}
	{#each shown(c.family) as p (p.key)}
		<Field
			label={p.label}
			error={errors.find((e) => e.index === p.i)?.message ??
				(p.i === 0 ? errors.find((e) => e.index === -1)?.message : undefined)}
		>
			{#snippet children(props)}
				<input
					class="control"
					type="number"
					step="any"
					value={c.params[p.i]}
					oninput={(e) => (c.params[p.i] = num(e))}
					data-testid="{prefix}-{p.key}"
					{...props}
				/>
			{/snippet}
		</Field>
	{/each}
{/snippet}

<div class="editor" data-testid={testId}>
	<Field label={label ?? (role === 'signal' ? 'Signal X' : 'Noise Y')}>
		{#snippet children(props)}
			<select
				class="control"
				value={spec.family}
				onchange={(e) => pick(e.currentTarget.value as Choice)}
				data-testid="{testId}-family"
				{...props}
			>
				{#each choices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
			</select>
		{/snippet}
	</Field>
	{#if spec.family === 'mixture'}
		{#each spec.components as c, i (i)}
			<fieldset class="component">
				<legend>Component {i + 1}</legend>
				<div class="row">
					<Field label="Family">
						{#snippet children(props)}
							<select
								class="control"
								value={c.family}
								onchange={(e) => setFamily(c, e.currentTarget.value as FamilyId)}
								data-testid="{testId}-c{i}-family"
								{...props}
							>
								{#each compatible(i) as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
							</select>
						{/snippet}
					</Field>
					<Field label="weight" error={c.weight > 0 ? undefined : 'weight must be positive.'}>
						{#snippet children(props)}
							<input
								class="control"
								type="number"
								step="any"
								min="0"
								value={c.weight}
								oninput={(e) => (c.weight = num(e))}
								data-testid="{testId}-c{i}-weight"
								{...props}
							/>
						{/snippet}
					</Field>
					{@render params(c, `${testId}-c${i}`)}
				</div>
				{#if spec.components.length > 2}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => spec.family === 'mixture' && spec.components.splice(i, 1)}
						>Remove component {i + 1}</Button
					>
				{/if}
			</fieldset>
		{/each}
		{#if spec.components.length < 3}
			<Button
				variant="secondary"
				size="sm"
				onclick={() =>
					spec.family === 'mixture' &&
					spec.components.push({
						...structuredClone($state.snapshot(spec.components[0])),
						weight: 0.3
					})}>Add a component</Button
			>
		{/if}
	{:else}
		<div class="row">{@render params(spec, testId)}</div>
	{/if}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: var(--sp-2);
	}
	.component {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--sp-2);
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	legend {
		font-size: var(--text-xs);
		color: var(--text-muted);
		padding: 0 var(--sp-1);
	}
</style>
