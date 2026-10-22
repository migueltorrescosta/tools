<script module lang="ts">
	/** One reference: a short citation, its linked title, the venue and what it changed. */
	export interface Reference {
		cite: string;
		title: string;
		venue: string;
		href: string;
		impact: string;
	}
</script>

<script lang="ts">
	let { references }: { references: readonly Reference[] } = $props();
</script>

<section class="references" aria-labelledby="references-heading">
	<h2 id="references-heading">References</h2>
	<ol class="refs">
		{#each references as ref (ref.href)}
			<li>
				{ref.cite} <a href={ref.href} target="_blank" rel="noreferrer">{ref.title}</a>
				{ref.venue}
				<span class="impact">{ref.impact}</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.references {
		margin-top: var(--sp-4);
	}

	.references h2 {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.refs {
		display: grid;
		gap: var(--sp-2);
		margin: 0;
		padding-left: var(--sp-5);
		font-size: var(--text-sm);
	}

	.impact {
		display: block;
		color: var(--text-muted);
	}
</style>
