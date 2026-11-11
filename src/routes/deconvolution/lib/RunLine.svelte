<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/ui/index.js';

	/**
	 * Run and its status as plain content of the Setup box. RunControls brings its own
	 * Run box, which here would be a box inside a box.
	 */
	let {
		onrun,
		running = false,
		disabled = false,
		describedby,
		onstop,
		children
	}: {
		onrun: () => void;
		running?: boolean;
		disabled?: boolean;
		describedby?: string;
		onstop: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="run">
	<div>
		{#if running}
			<Button onclick={onstop} data-testid="stop">Stop</Button>
		{:else}
			<Button
				variant="primary"
				onclick={onrun}
				{disabled}
				aria-describedby={describedby}
				data-testid="run">Run</Button
			>
		{/if}
	</div>
	{@render children?.()}
</div>

<style>
	.run {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
</style>
