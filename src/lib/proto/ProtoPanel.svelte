<script lang="ts">
	import { AXES, applyProto, proto, type Axis } from './proto.svelte.js';

	let open = $state(false);
	$effect(() => {
		// Track every axis so a change re-applies.
		void Object.values(proto).join();
		applyProto();
	});
	const axes = Object.entries(AXES) as [Axis, (typeof AXES)[Axis]][];
	let root: HTMLDivElement | undefined = $state();
	function onPointer(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onpointerdown={onPointer} />

<div class="proto" bind:this={root}>
	{#if open}
		<div class="proto-panel" role="dialog" aria-label="Prototype options">
			<p class="proto-hint">
				Each list starts at its first option; that is not a suggestion. Tap outside to close.
				Choices stay in this browser.
			</p>
			{#each axes as [axis, def] (axis)}
				<fieldset>
					<legend>{def.label}</legend>
					{#each Object.entries(def.values) as [value, label] (value)}
						<label>
							<input
								type="radio"
								name="proto-{axis}"
								{value}
								checked={proto[axis] === value}
								onchange={() => ((proto as Record<string, string>)[axis] = value)}
							/>
							{label}
						</label>
					{/each}
				</fieldset>
			{/each}
		</div>
	{/if}
	<button type="button" class="proto-toggle" aria-expanded={open} onclick={() => (open = !open)}>
		{open ? 'Close' : 'Prototype'}
	</button>
</div>

<style>
	.proto {
		position: fixed;
		left: max(12px, env(safe-area-inset-left, 0px));
		bottom: max(12px, env(safe-area-inset-bottom, 0px));
		z-index: 200;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 0.8125rem;
	}
	.proto-toggle {
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
		cursor: pointer;
	}
	.proto-panel {
		width: min(22rem, calc(100vw - 24px));
		max-height: min(60vh, 44rem);
		overflow: auto;
		padding: 12px 14px;
		border-radius: 10px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 8px 30px rgb(0 0 0 / 0.2);
	}
	.proto-hint {
		margin: 0 0 8px;
		color: var(--text-muted);
	}
	fieldset {
		margin: 0 0 10px;
		padding: 0;
		border: 0;
	}
	legend {
		font-weight: 600;
		margin-bottom: 4px;
	}
	label {
		display: flex;
		gap: 8px;
		align-items: center;
		min-height: 30px;
		cursor: pointer;
	}
</style>
