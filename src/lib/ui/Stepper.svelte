<script lang="ts" module>
	export interface Step {
		label: string;
		/** Shows a check mark instead of the number. */
		done?: boolean;
		/** A clickable step that can't be chosen yet. */
		disabled?: boolean;
	}
</script>

<script lang="ts">
	/**
	 * Progress stepper: numbered circles joined by a line. With `onselect` the
	 * steps are buttons (a disabled step can't be chosen); without it they only
	 * show where you are.
	 */
	let {
		steps,
		current,
		onselect,
		label = 'Progress'
	}: {
		steps: readonly Step[];
		/** Index of the current step. */
		current: number;
		onselect?: (index: number) => void;
		/** Accessible name of the list. */
		label?: string;
	} = $props();
</script>

<ol class="stepper" class:clickable={!!onselect} aria-label={label}>
	{#each steps as step, i (i)}
		{@const now = i === current}
		<li
			class="step"
			class:done={step.done}
			class:now
			aria-current={!onselect && now ? 'step' : undefined}
		>
			{#if onselect}
				<button
					type="button"
					class="step-button"
					disabled={step.disabled}
					aria-current={now ? 'step' : undefined}
					onclick={() => onselect(i)}
				>
					{@render content(step, i)}
				</button>
			{:else}
				{@render content(step, i)}
			{/if}
		</li>
	{/each}
</ol>

{#snippet content(step: Step, i: number)}
	<span class="step-dot" aria-hidden="true">{step.done ? '✓' : i + 1}</span>
	<span
		>{step.label}{#if step.done}<span class="sr-only">&nbsp;(done)</span>{/if}</span
	>
{/snippet}

<style>
	.stepper {
		display: flex;
		align-items: flex-start;
		margin: 0 0 var(--sp-3);
		padding: 0;
		list-style: none;
	}

	.step {
		position: relative;
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-align: center;
	}

	.step + .step::before {
		content: '';
		position: absolute;
		top: 12px;
		left: -50%;
		right: 50%;
		height: 2px;
		background: var(--border);
	}

	.step.done::before,
	.step.now::before {
		background: var(--success);
	}

	.step-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		min-width: 0;
		padding: 0 var(--sp-2) var(--sp-0);
		border: 0;
		border-radius: var(--radius);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.step-button:hover:not(:disabled) {
		color: var(--text);
	}

	.step-button:hover:not(:disabled) .step-dot {
		border-color: var(--border-strong);
	}

	.step-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.step-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.step-dot {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 2px solid var(--border);
		border-radius: 50%;
		background: var(--surface);
		font-weight: 700;
	}

	.step.done {
		color: var(--text);
	}

	.step.done .step-dot {
		background: var(--success);
		border-color: var(--success);
		color: var(--surface);
	}

	.step.now {
		color: var(--accent);
		font-weight: 600;
	}

	.step.now .step-dot {
		border-color: var(--accent);
		background: var(--accent-bg);
	}

	.step.now .step-button:hover .step-dot {
		border-color: var(--accent);
	}
</style>
