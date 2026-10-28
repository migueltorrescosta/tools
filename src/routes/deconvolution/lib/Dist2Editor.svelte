<script lang="ts">
	import { Button, Field } from '$lib/ui';
	import {
		FRINGE2_PARAMS,
		GAUSS2_PARAMS,
		validate2,
		type Noise2Spec,
		type Spec2
	} from '$lib/deconvolution/dist2';
	import type { DistSpec, ParamSpec, Role, SimpleSpec } from '$lib/deconvolution/types';
	import DistEditor from './DistEditor.svelte';

	/** A 2D signal (Gaussian, mixture, product or fringe) or noise (Gaussian or product). */
	let {
		spec = $bindable(),
		role,
		testId
	}: {
		spec: Spec2;
		role: Role;
		testId: string;
	} = $props();

	type Family2 = Spec2['family'];
	const NAMES: Record<Family2, string> = {
		gauss2: 'Correlated Gaussian',
		mixture2: 'Mixture of Gaussians',
		product: 'Independent axes (product)',
		fringe2: 'Fringe pattern'
	};
	const families = $derived<Family2[]>(
		role === 'signal' ? ['gauss2', 'mixture2', 'product', 'fringe2'] : ['gauss2', 'product']
	);
	const defaults = (p: readonly ParamSpec[]) => p.map((q) => q.default);

	function pick(f: Family2) {
		if (f === 'gauss2') spec = { family: 'gauss2', params: defaults(GAUSS2_PARAMS) };
		else if (f === 'fringe2') spec = { family: 'fringe2', params: defaults(FRINGE2_PARAMS) };
		else if (f === 'mixture2')
			spec = {
				family: 'mixture2',
				components: [
					{ params: [-2, 0, 0.6, 0.6, 0], weight: 0.5 },
					{ params: [2, 0, 0.6, 0.6, 0], weight: 0.5 }
				]
			};
		else
			spec = {
				family: 'product',
				x: { family: 'normal', params: [0, role === 'signal' ? 1 : 0.5] },
				y: { family: 'normal', params: [0, role === 'signal' ? 1 : 0.5] }
			};
	}

	const errors = $derived(validate2(spec));
	const error = (part: string, index: number) =>
		errors.find((e) => e.part === part && e.index === index)?.message;
	/** The noise holds the Gaussian's means at 0, so it doesn't show them. */
	const shown = (params: readonly ParamSpec[]) =>
		params.map((p, i) => ({ ...p, i })).filter((p) => !(role === 'noise' && p.i < 2));
	const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
</script>

{#snippet fields(params: number[], specs: readonly ParamSpec[], part: string, prefix: string)}
	<div class="row">
		{#each shown(specs) as p (p.key)}
			<Field label={p.label} error={error(part, p.i)}>
				{#snippet children(props)}
					<input
						class="control"
						type="number"
						step="any"
						value={params[p.i]}
						oninput={(e) => (params[p.i] = num(e))}
						data-testid="{prefix}-{p.key}"
						{...props}
					/>
				{/snippet}
			</Field>
		{/each}
	</div>
{/snippet}

<div class="editor" data-testid={testId}>
	<Field label={role === 'signal' ? 'Signal X (2D)' : 'Noise Y (2D)'}>
		{#snippet children(props)}
			<select
				class="control"
				value={spec.family}
				onchange={(e) => pick(e.currentTarget.value as Family2)}
				data-testid="{testId}-family"
				{...props}
			>
				{#each families as f (f)}<option value={f}>{NAMES[f]}</option>{/each}
			</select>
		{/snippet}
	</Field>
	{#if spec.family === 'gauss2'}
		{@render fields(spec.params, GAUSS2_PARAMS, '', testId)}
	{:else if spec.family === 'fringe2'}
		{@render fields(spec.params, FRINGE2_PARAMS, '', testId)}
	{:else if spec.family === 'mixture2'}
		{#each spec.components as c, i (i)}
			<fieldset class="component">
				<legend>Component {i + 1}</legend>
				<Field label="weight" error={error(`c${i}`, -1)}>
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
				{@render fields(c.params, GAUSS2_PARAMS, `c${i}`, `${testId}-c${i}`)}
				{#if spec.components.length > 2}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => spec.family === 'mixture2' && spec.components.splice(i, 1)}
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
					spec.family === 'mixture2' &&
					spec.components.push({ params: [0, 2, 0.6, 0.6, 0], weight: 0.3 })}
				>Add a component</Button
			>
		{/if}
	{:else}
		<fieldset class="component">
			<legend>x axis</legend>
			<DistEditor
				bind:spec={spec.x as DistSpec}
				{role}
				label="Family"
				allowMixture={false}
				continuousOnly={role === 'noise'}
				testId="{testId}-x"
			/>
		</fieldset>
		<fieldset class="component">
			<legend>y axis</legend>
			<DistEditor
				bind:spec={spec.y as DistSpec}
				{role}
				label="Family"
				allowMixture={false}
				continuousOnly={role === 'noise'}
				testId="{testId}-y"
			/>
		</fieldset>
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
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
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
