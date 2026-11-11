<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { PAPERS } from '#lib/scientific-derivations/index.js';
	import { renderProse } from '#lib/scientific-derivations/prose.js';
	import { PageHeader, Panel, Select } from '#lib/ui/index.js';
	import DerivationGraph, { type Selection } from './lib/DerivationGraph.svelte';
	import DetailPanel from './lib/DetailPanel.svelte';

	let paperId = $state(PAPERS[0].id);
	let derivationId = $state(PAPERS[0].derivations[0].id);
	let selected = $state<Selection>(null);
	let hydrated = $state(false);

	const paper = $derived(PAPERS.find((p) => p.id === paperId) ?? PAPERS[0]);
	const derivation = $derived(
		paper.derivations.find((d) => d.id === derivationId) ?? paper.derivations[0]
	);

	const paperOptions = PAPERS.map((p) => ({ value: p.id, label: p.title }));
	const derivationOptions = $derived(
		paper.derivations.map((d, i) => ({ value: d.id, label: `${i + 1}. ${d.title}` }))
	);

	function writeUrl() {
		const url = new URL(page.url.href);
		url.searchParams.set('paper', paper.id);
		url.searchParams.set('derivation', derivation.id);
		goto(url, { shallow: true, replace: true, state: page.state });
	}

	function choosePaper() {
		derivationId = paper.derivations[0].id;
		selected = null;
		writeUrl();
	}

	function chooseDerivation() {
		selected = null;
		writeUrl();
	}

	function open(id: string) {
		derivationId = id;
		chooseDerivation();
	}

	// The details drawer takes focus when it opens and hands it back to its opener when it closes.
	let drawer = $state<HTMLElement>();
	$effect(() => {
		if (!drawer) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		drawer.focus();
		return () => {
			if (opener?.isConnected) opener.focus();
		};
	});

	// ?paper and ?derivation pick the graph; unknown values fall back to the first.
	onMount(() => {
		const params = new URLSearchParams(page.url.search);
		const fromUrl = PAPERS.find((p) => p.id === params.get('paper'));
		if (fromUrl) paperId = fromUrl.id;
		const d = paper.derivations.find((d) => d.id === params.get('derivation'));
		derivationId = (d ?? paper.derivations[0]).id;
		hydrated = true;
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />

<div class="container sd-page" data-hydrated={hydrated || undefined}>
	<PageHeader path="/scientific-derivations" />

	<Panel>
		<div class="sd-pickers">
			<Select
				label="Paper"
				options={paperOptions}
				bind:value={paperId}
				onchange={choosePaper}
				data-testid="paper"
			/>
			<Select
				label="Derivation"
				options={derivationOptions}
				bind:value={derivationId}
				onchange={chooseDerivation}
				data-testid="derivation"
			/>
		</div>

		<section class="sd-intro" aria-labelledby="sd-title">
			<h2 id="sd-title">
				{derivation.title} <span class="sd-section">{derivation.section}</span>
			</h2>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
			<p>{@html renderProse(derivation.summary)}</p>
		</section>
	</Panel>

	<Panel>
		<ul class="sd-key" aria-label="Key">
			<li><span class="sd-swatch assumption" aria-hidden="true"></span>Assumption</li>
			<li><span class="sd-swatch result" aria-hidden="true"></span>Result</li>
		</ul>
		{#key derivation.id}
			<DerivationGraph {derivation} bind:selected />
		{/key}

		<div class="sd-end">
			<details class="how">
				<summary>How it works</summary>
				<p>
					Key derivations of scientific papers as graphs: equations are nodes, and the facts that
					connect them are edges.
				</p>
				<p>
					Select an equation or a fact for its details. Dashed boxes are assumptions and bold boxes
					are results. The words "corrected" and "added" mark steps that were corrected or that are
					not in the paper.
				</p>
			</details>
			<p class="sd-paper">
				{paper.authors}, <a href={paper.url} target="_blank" rel="noopener">{paper.title}</a>,
				{paper.venue}. {paper.numbering}
			</p>
		</div>
	</Panel>

	{#if selected}
		<aside class="sd-drawer" aria-label="Details" tabindex="-1" bind:this={drawer}>
			<DetailPanel {paper} {derivation} bind:selected onopen={open} />
		</aside>
	{/if}
</div>

<style>
	.sd-pickers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: var(--sp-3);
		margin-bottom: var(--sp-2);
	}

	/* How it works and the paper reference close the graph box, under a hairline. */
	.sd-end {
		margin-top: var(--sp-3);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}

	.sd-end :global(details.how) {
		margin-top: 0;
	}

	.sd-paper {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.sd-section {
		font-size: var(--text-sm);
		font-weight: 400;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.sd-intro {
		margin-top: var(--sp-2);
	}

	.sd-intro h2 {
		margin: 0;
		font-size: var(--text-xl);
	}

	.sd-intro p:last-child {
		margin: var(--sp-1) 0 0;
		max-width: 70ch;
		line-height: var(--leading);
	}

	/* Complex graphs need every pixel: this page ignores the shared content cap. */
	.sd-page {
		max-width: none;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	/* A key to the two box styles, drawn like the graph's own boxes. */
	.sd-key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-4);
		margin: 0 0 var(--sp-2);
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.sd-key li {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.sd-swatch {
		width: 1.25rem;
		height: 0.85rem;
		border-radius: var(--radius-sm);
	}

	.sd-swatch.assumption {
		background: var(--surface-2);
		border: 1px dashed var(--border-strong);
	}

	.sd-swatch.result {
		background: var(--surface);
		border: 2px solid var(--accent);
	}

	/* Details slide over the right edge, so the graph keeps the full width. */
	.sd-drawer {
		position: fixed;
		top: var(--topbar-h);
		right: 0;
		bottom: 0;
		z-index: 10;
		width: min(26rem, 100vw);
		overflow-y: auto;
		animation: sd-slide 0.15s ease-out;
	}

	.sd-drawer:focus {
		outline: none;
	}

	.sd-drawer:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	/* The details Panel is the sheet itself: full height, square to the screen edges. */
	.sd-drawer > :global(.ui-panel) {
		min-height: 100%;
		border-radius: 0;
	}

	@keyframes sd-slide {
		from {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sd-drawer {
			animation: none;
		}
	}
</style>
