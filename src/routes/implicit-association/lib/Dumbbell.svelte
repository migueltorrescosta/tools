<script lang="ts">
	import { sections, type Association } from '#lib/implicit-association/history.js';
	import Section from './Section.svelte';

	/** The fewest axes that show every comparison, side by side, with one key below. */
	let { items }: { items: readonly Association[] } = $props();
	const axes = $derived(sections(items));
</script>

<div class="columns">
	{#each axes as section (JSON.stringify(section.ends))}
		<Section {section} />
	{/each}
</div>
<ul class="key" aria-label="Key">
	<li>
		<span class="sw s1"></span><span class="sw s2"></span><span class="sw s3"></span> Weak → strong
	</li>
	<li>
		<span class="sw s3 c0"></span><span class="sw s3 c1"></span><span class="sw s3"></span> Unsure → sure
	</li>
</ul>

<style>
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: var(--sp-4) var(--sp-5);
		align-items: start;
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-4);
		margin-top: var(--sp-3);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.key li {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.sw {
		display: inline-block;
		width: 14px;
		height: 10px;
		border-radius: 2px;
		background: var(--c);
	}
	.s1 {
		--c: color-mix(in oklab, var(--data-1) 58%, var(--surface-2));
	}
	.s2 {
		--c: color-mix(in oklab, var(--data-1) 75%, var(--surface-2));
	}
	.s3 {
		--c: var(--data-1);
	}
	.c0 {
		opacity: 0.55;
	}
	.c1 {
		opacity: 0.75;
	}
</style>
