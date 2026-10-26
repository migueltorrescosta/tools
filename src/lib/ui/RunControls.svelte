<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Panel from './Panel.svelte';

	let {
		onrun,
		running = false,
		disabled = false,
		describedby,
		onstop,
		oncontinue,
		canContinue = false,
		fields,
		actions,
		children
	}: {
		/** Starts a fresh run. */
		onrun: () => void;
		running?: boolean;
		/** Disables Run (for example while the inputs have errors). Run is always disabled while running. */
		disabled?: boolean;
		/** Id of the element that says why Run is disabled. */
		describedby?: string;
		/** Shows a Stop button, enabled while running. */
		onstop?: () => void;
		/** Shows a Continue button, enabled when stopped with a run to resume. */
		oncontinue?: () => void;
		canContinue?: boolean;
		/** Run settings (Field components), laid out in a wrapping grid above the buttons. */
		fields?: Snippet;
		/** Extra buttons after Run, Stop and Continue. */
		actions?: Snippet;
		/** Progress, status and errors, below the buttons. */
		children?: Snippet;
	} = $props();
</script>

<Panel title="Run">
	<div class="ui-run">
		{#if fields}<div class="ui-run-fields">{@render fields()}</div>{/if}
		<div class="ui-run-buttons">
			<Button
				variant="primary"
				onclick={onrun}
				disabled={running || disabled}
				aria-describedby={describedby}
				data-testid="run">Run</Button
			>
			{#if onstop}<Button variant="danger" onclick={onstop} disabled={!running} data-testid="stop"
					>Stop</Button
				>{/if}
			{#if oncontinue}<Button
					onclick={oncontinue}
					disabled={!canContinue || running}
					data-testid="continue">Continue</Button
				>{/if}
			{@render actions?.()}
		</div>
		{@render children?.()}
	</div>
</Panel>

<style>
	.ui-run {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.ui-run-fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--sp-2) var(--sp-3);
		max-width: 48rem;
	}
	.ui-run-buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-1);
	}
</style>
