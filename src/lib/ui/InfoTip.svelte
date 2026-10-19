<script lang="ts">
	import type { Snippet } from 'svelte';

	const uid = $props.id();

	let {
		label,
		children
	}: {
		/** The term explained, read as the button's name ("About {label}"). */
		label: string;
		/** The explanation. */
		children: Snippet;
	} = $props();

	let open = $state(false);
</script>

<span
	class="ui-infotip"
	role="presentation"
	onmouseenter={() => (open = true)}
	onmouseleave={() => (open = false)}
>
	<button
		type="button"
		class="ui-infotip-btn"
		aria-label="About {label}"
		aria-describedby="tip-{uid}"
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
		onclick={() => (open = !open)}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
		}}>i</button
	>
	<span id="tip-{uid}" role="tooltip" class="ui-infotip-body" class:open>{@render children()}</span>
</span>

<style>
	.ui-infotip {
		position: relative;
		display: inline-flex;
		vertical-align: middle;
	}
	.ui-infotip-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-muted);
		font:
			italic 600 var(--text-xs) / 1 Georgia,
			serif;
		cursor: help;
	}
	.ui-infotip-btn::before {
		content: '';
		position: absolute;
		width: 16px;
		height: 16px;
		border: 1px solid currentColor;
		border-radius: 50%;
	}
	.ui-infotip-btn:hover,
	.ui-infotip-btn:focus-visible {
		color: var(--accent);
	}
	.ui-infotip-body {
		position: absolute;
		top: 100%;
		left: 50%;
		z-index: 20;
		width: max-content;
		max-width: min(18rem, 80vw);
		padding: var(--sp-1) var(--sp-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
		font: 400 var(--text-xs) / 1.4 var(--font-sans);
		font-style: normal;
		text-align: left;
		white-space: normal;
		transform: translateX(-50%);
		display: none;
		pointer-events: none;
	}
	.ui-infotip-body.open {
		display: block;
	}
</style>
