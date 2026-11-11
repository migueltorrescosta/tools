<!--
	A result's answer: a headline that states it, then one plain sentence.
	`extra` holds a tool's essential addition (a badge, a list), between the two.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		headline,
		level,
		extra,
		children,
		class: className = '',
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		headline: string;
		/** Makes the headline a heading at this level, when it titles a section. */
		level?: 2 | 3 | 4;
		extra?: Snippet;
		/** The plain sentence after the headline. */
		children?: Snippet;
	} = $props();
</script>

<div class="ui-answer {className}" {...rest}>
	{#if level}
		<svelte:element this={`h${level}`} class="ui-answer-headline">{headline}</svelte:element>
	{:else}
		<p class="ui-answer-headline">{headline}</p>
	{/if}
	{@render extra?.()}
	{#if children}<p class="ui-answer-text">{@render children()}</p>{/if}
</div>

<style>
	.ui-answer {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-1);
		min-width: 0;
	}
	.ui-answer-headline {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 700;
		line-height: 1.25;
		font-variant-numeric: tabular-nums;
		overflow-wrap: break-word;
	}
	.ui-answer-text {
		margin: 0;
		overflow-wrap: break-word;
	}
</style>
