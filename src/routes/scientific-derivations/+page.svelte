<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { PAPERS } from '$lib/scientific-derivations';
	import { renderProse } from '$lib/scientific-derivations/prose';
	import { PageHeader, SegmentedControl, Select } from '$lib/ui';
	import DerivationGraph, { type Selection } from './lib/DerivationGraph.svelte';
	import DetailPanel from './lib/DetailPanel.svelte';

	let paperId = $state(PAPERS[0].id);
	let derivationId = $state(PAPERS[0].derivations[0].id);
	let selected = $state<Selection>(null);
	let hydrated = $state(false);
	let zoom = $state<'fit' | 'full'>('fit');

	const paper = $derived(PAPERS.find((p) => p.id === paperId) ?? PAPERS[0]);
	const derivation = $derived(
		paper.derivations.find((d) => d.id === derivationId) ?? paper.derivations[0]
	);
	const index = $derived(paper.derivations.indexOf(derivation));

	const paperOptions = PAPERS.map((p) => ({ value: p.id, label: p.title }));
	const derivationOptions = $derived(
		paper.derivations.map((d, i) => ({ value: d.id, label: `${i + 1}. ${d.title}` }))
	);

	function writeUrl() {
		const url = new URL(page.url);
		url.searchParams.set('paper', paper.id);
		url.searchParams.set('derivation', derivation.id);
		replaceState(url, page.state);
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
		const params = page.url.searchParams;
		const fromUrl = PAPERS.find((p) => p.id === params.get('paper'));
		if (fromUrl) paperId = fromUrl.id;
		const d = paper.derivations.find((d) => d.id === params.get('derivation'));
		derivationId = (d ?? paper.derivations[0]).id;
		hydrated = true;
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />

<div class="container sd-page" data-hydrated={hydrated || undefined}>
	<PageHeader path="/scientific-derivations">
		Key derivations of scientific papers as graphs: equations are nodes, the facts that connect them
		are edges.
	</PageHeader>

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

	<p class="sd-paper">
		{paper.authors}, <a href={paper.url} target="_blank" rel="noopener">{paper.title}</a>,
		{paper.venue}. {paper.numbering}
	</p>

	<section class="sd-intro" aria-labelledby="sd-title">
		<h2 id="sd-title">{index + 1}. {derivation.title}</h2>
		<p class="sd-section">{derivation.section}</p>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
		<p>{@html renderProse(derivation.summary)}</p>
	</section>

	<div class="sd-toolbar">
		<SegmentedControl
			legend="Zoom"
			hideLegend
			options={[
				{ value: 'fit', label: 'Fit to width' },
				{ value: 'full', label: '100%' }
			]}
			bind:value={zoom}
		/>
		<p class="sd-hint">
			Select an equation or a fact for details. Dashed boxes are assumptions and bold boxes are
			results. Tags mark steps that were corrected or added.
		</p>
	</div>
	{#key derivation.id}
		<DerivationGraph {derivation} bind:selected fit={zoom === 'fit'} />
	{/key}
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

	.sd-paper,
	.sd-section {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.sd-intro {
		margin: var(--sp-3) 0;
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
	}

	.sd-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2) var(--sp-3);
		margin-bottom: var(--sp-2);
	}

	.sd-hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
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
		background: var(--bg);
		border-left: 1px solid var(--border);
		box-shadow: -4px 0 16px rgb(0 0 0 / 0.15);
		animation: sd-slide 0.15s ease-out;
	}

	.sd-drawer:focus {
		outline: none;
	}

	.sd-drawer:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.sd-drawer > :global(.ui-panel) {
		min-height: 100%;
		border: none;
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
