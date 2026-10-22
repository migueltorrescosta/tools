<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	/**
	 * A plot with a ⤢ button that opens it again in a full-window `<dialog>`.
	 * The dialog's copy renders only while open; `plot(true)` should fill the
	 * dialog body (a flex column), `plot(false)` is the inline plot.
	 */
	let {
		title,
		plot,
		disabled = false,
		frame
	}: {
		/** Names the button ("Maximize {title}") and heads the dialog. */
		title: string;
		/** The plot; `maximized` is true for the copy in the dialog. */
		plot: Snippet<[maximized: boolean]>;
		/** E.g. while the plot is still computing. */
		disabled?: boolean;
		/**
		 * Custom inline layout: render the ⤢ `button` where it belongs (a panel
		 * header) and the inline plot yourself. Without it the button sits in a
		 * bar above the plot, beside the title.
		 */
		frame?: Snippet<[button: Snippet]>;
	} = $props();

	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let open = $state(false);
	// The browser moves focus into the dialog and, on close, back to the ⤢ button.
	function show() {
		open = true;
		dialog?.showModal();
	}
</script>

{#snippet button()}
	<Button
		variant="ghost"
		size="sm"
		class="ui-max-open"
		aria-label="Maximize {title}"
		title="Maximize"
		{disabled}
		onclick={show}><span aria-hidden="true">⤢</span></Button
	>
{/snippet}

{#if frame}
	{@render frame(button)}
{:else}
	<div class="ui-max">
		<div class="ui-max-bar">
			<span class="ui-max-label">{title}</span>
			{@render button()}
		</div>
		{@render plot(false)}
	</div>
{/if}

<dialog
	bind:this={dialog}
	class="ui-max-dialog"
	aria-labelledby="max-title-{uid}"
	data-testid="maximized"
	oncancel={(e) => {
		e.preventDefault();
		dialog?.close();
	}}
	onclose={() => (open = false)}
>
	<div class="ui-max-head">
		<h2 id="max-title-{uid}">{title}</h2>
		<Button variant="ghost" size="sm" aria-label="Close {title}" onclick={() => dialog?.close()}
			><span aria-hidden="true">✕</span></Button
		>
	</div>
	<!-- Focusable, so keyboard users can scroll a plot taller or wider than the window. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="ui-max-body" role="region" aria-labelledby="max-title-{uid}" tabindex="0">
		{#if open}{@render plot(true)}{/if}
	</div>
</dialog>

<style>
	.ui-max {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.ui-max-bar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
	}
	.ui-max-label {
		flex: 1;
		min-width: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	:global(.ui-btn.ui-max-open) {
		flex: none;
		min-width: var(--control-h-sm);
		margin-left: auto;
		font-size: var(--text-lg);
		line-height: 1;
	}
	.ui-max-dialog {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: var(--sp-2) var(--sp-4) var(--sp-4);
		border: 0;
		background: var(--bg);
		color: var(--text);
	}
	.ui-max-dialog[open] {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.ui-max-dialog::backdrop {
		background: color-mix(in oklab, var(--bg) 70%, transparent);
	}
	.ui-max-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: var(--control-h);
	}
	.ui-max-head h2 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.ui-max-body:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.ui-max-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
	}
	/* The plot takes the whole body, and more if it needs to (then the body scrolls). */
	.ui-max-body > :global(*) {
		flex: 1 0 auto;
		min-width: 0;
	}
	@media (max-width: 40rem) {
		.ui-max-dialog {
			padding: var(--sp-1) var(--sp-2) var(--sp-2);
		}
	}
</style>
