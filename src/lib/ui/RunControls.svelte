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
		preset,
		fields,
		summary,
		actions,
		children
	}: {
		/** Starts a fresh run. */
		onrun: () => void;
		running?: boolean;
		/** Disables Run (for example while the inputs have errors). */
		disabled?: boolean;
		/** Id of the element that says why Run is disabled. */
		describedby?: string;
		/** While running, Run turns into Stop when the tool can stop. */
		onstop?: () => void;
		/** Shows Continue after a stop, when there is a run to resume. */
		oncontinue?: () => void;
		canContinue?: boolean;
		/** The tool's preset picker, right above Run: choosing and running happen in one place. */
		preset?: Snippet;
		/** Run settings (Field components), behind one closed Advanced line. */
		fields?: Snippet;
		/** What the Advanced line holds, e.g. "100,000 samples, seed 2026". */
		summary?: string;
		/** Extra buttons after Run or Stop and Continue. */
		actions?: Snippet;
		/** Progress, status and errors, below the buttons. */
		children?: Snippet;
	} = $props();
</script>

<Panel title="Run">
	<div class="ui-run">
		{#if preset}<div class="ui-run-preset">{@render preset()}</div>{/if}
		<div class="ui-run-buttons">
			{#if running && onstop}
				<Button onclick={onstop} data-testid="stop">Stop</Button>
			{:else}
				<Button
					variant="primary"
					onclick={onrun}
					disabled={running || disabled}
					aria-describedby={describedby}
					data-testid="run">Run</Button
				>
			{/if}
			{#if oncontinue && canContinue && !running}<Button onclick={oncontinue} data-testid="continue"
					>Continue</Button
				>{/if}
			{@render actions?.()}
		</div>
		{#if fields}
			<details class="ui-run-advanced">
				<summary
					>Advanced{#if summary}<span class="ui-run-summary"> · {summary}</span>{/if}</summary
				>
				<div class="ui-run-fields">{@render fields()}</div>
			</details>
		{/if}
		{@render children?.()}
	</div>
</Panel>

<style>
	.ui-run {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.ui-run-buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-1);
	}
	.ui-run-advanced > summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--control-h-sm);
		color: var(--accent);
		cursor: pointer;
	}
	.ui-run-summary {
		color: var(--text-muted);
	}
	.ui-run-fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--sp-2) var(--sp-3);
		max-width: 48rem;
		margin-top: var(--sp-2);
	}
</style>
