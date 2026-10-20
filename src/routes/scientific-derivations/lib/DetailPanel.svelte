<script lang="ts">
	import { edgeId, type Derivation, type Paper } from '$lib/scientific-derivations';
	import { renderProse, stackTex } from '$lib/scientific-derivations/prose';
	import { renderTex } from '$lib/tex';
	import { Alert, Panel } from '$lib/ui';
	import Tex from '$lib/ui/Tex.svelte';
	import type { Selection } from './DerivationGraph.svelte';

	let {
		paper,
		derivation,
		selected = $bindable(),
		onopen
	}: {
		paper: Paper;
		derivation: Derivation;
		selected: Selection;
		/** Switch to another derivation of the paper. */
		onopen: (id: string) => void;
	} = $props();

	const node = $derived(
		selected?.type === 'node' ? derivation.nodes.find((n) => n.id === selected?.id) : undefined
	);
	const edge = $derived(
		selected?.type === 'edge' ? derivation.edges.find((e) => edgeId(e) === selected?.id) : undefined
	);
	const titles = $derived(Object.fromEntries(derivation.nodes.map((n) => [n.id, n.title])));
	const incoming = $derived(node ? derivation.edges.filter((e) => e.to === node.id) : []);
	const outgoing = $derived(node ? derivation.edges.filter((e) => e.from === node.id) : []);
	const source = $derived(node?.from ? paper.derivations.findIndex((d) => d.id === node.from) : -1);

	const KIND = { assumption: 'Assumption', step: 'Step', result: 'Result' } as const;
	const meta = $derived(
		node
			? [
					KIND[node.kind] + (node.added ? ', not in the paper' : ''),
					node.ref && `Paper: ${node.ref}`
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);
</script>

<Panel title={node?.title ?? (edge ? 'Fact' : 'Details')} level={3}>
	<div class="dp" data-testid="detail">
		{#if node}
			<p class="dp-meta">{meta}</p>
			<div class="dp-eq"><Tex html={renderTex(stackTex(node.tex), true)} /></div>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
			{#if node.detail}<p>{@html renderProse(node.detail)}</p>{/if}
			{#if node.correction}
				<Alert tone="warning">
					<strong>Correction.</strong>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
					{@html renderProse(node.correction)}
				</Alert>
			{/if}
			{#if source >= 0}
				<button type="button" class="dp-link" onclick={() => onopen(node.from!)}>
					Derived in {source + 1}. {paper.derivations[source].title}
				</button>
			{/if}
			{#each [{ label: 'Follows from', list: incoming, other: 'from' }, { label: 'Leads to', list: outgoing, other: 'to' }] as group (group.label)}
				{#if group.list.length}
					<h4>{group.label}</h4>
					<ul>
						{#each group.list as e (edgeId(e))}
							{@const id = group.other === 'from' ? e.from : e.to}
							<li>
								<button
									type="button"
									class="dp-link"
									onclick={() => (selected = { type: 'node', id })}>{titles[id]}</button
								>
								<button
									type="button"
									class="dp-fact"
									onclick={() => (selected = { type: 'edge', id: edgeId(e) })}
									><Tex html={renderProse(e.label)} /></button
								>
							</li>
						{/each}
					</ul>
				{/if}
			{/each}
		{:else if edge}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
			<p class="dp-fact-title">{@html renderProse(edge.label)}</p>
			<p class="dp-meta">
				<button
					type="button"
					class="dp-link"
					onclick={() => (selected = { type: 'node', id: edge.from })}>{titles[edge.from]}</button
				>
				→
				<button
					type="button"
					class="dp-link"
					onclick={() => (selected = { type: 'node', id: edge.to })}>{titles[edge.to]}</button
				>
				{#if edge.ref}· Paper: {edge.ref}{/if}
			</p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
			{#if edge.detail}<p>{@html renderProse(edge.detail)}</p>{/if}
			{#if edge.correction}
				<Alert tone="warning">
					<strong>Correction.</strong>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped prose with KaTeX -->
					{@html renderProse(edge.correction)}
				</Alert>
			{/if}
		{:else}
			<p class="dp-hint">
				Select an equation or a fact on the graph. Dashed boxes are assumptions, bold boxes are
				results. Tags mark steps that are corrected from, or added to, the paper.
			</p>
		{/if}
	</div>
</Panel>

<style>
	.dp {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--text-md);
		line-height: var(--leading);
	}

	.dp p,
	.dp ul,
	.dp h4 {
		margin: 0;
	}

	.dp h4 {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dp ul {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding-left: var(--sp-4);
	}

	.dp-meta,
	.dp-hint {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dp-eq {
		overflow-x: auto;
		max-width: 100%;
	}

	.dp-eq :global(.katex-display) {
		margin: 0;
	}

	.dp-fact-title {
		font-weight: 600;
	}

	.dp-link,
	.dp-fact {
		padding: 0;
		font: inherit;
		color: var(--accent);
		text-align: left;
		text-decoration: underline;
		background: none;
		border: none;
		cursor: pointer;
	}

	.dp-fact {
		margin-left: var(--sp-1);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dp-fact::before {
		content: 'by ';
	}
</style>
