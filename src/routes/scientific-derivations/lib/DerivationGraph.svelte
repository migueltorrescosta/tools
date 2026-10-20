<script lang="ts" module>
	export type Selection = { type: 'node' | 'edge'; id: string } | null;
</script>

<script lang="ts">
	import { edgeId, type Derivation } from '$lib/scientific-derivations';
	import { edgePath, layoutGraph } from '$lib/scientific-derivations/layout';
	import { renderProse, stackTex } from '$lib/scientific-derivations/prose';
	import { renderTex } from '$lib/tex';
	import Tex from '$lib/ui/Tex.svelte';

	let {
		derivation,
		selected = $bindable(),
		fit = true
	}: {
		derivation: Derivation;
		selected: Selection;
		/** Shrink the graph to the width of its box instead of scrolling. */
		fit?: boolean;
	} = $props();

	const uid = $props.id();

	const nodes = $derived(
		derivation.nodes.map((node) => ({ ...node, html: renderTex(stackTex(node.tex), true) }))
	);
	const edges = $derived(
		derivation.edges.map((edge) => ({ ...edge, id: edgeId(edge), html: renderProse(edge.label) }))
	);
	const titles = $derived(Object.fromEntries(derivation.nodes.map((n) => [n.id, n.title])));

	// Rendered sizes, measured in the browser; the layout waits until every box has one.
	const width = $state<Record<string, number>>({});
	const height = $state<Record<string, number>>({});

	const layout = $derived.by(() => {
		const ids = [...nodes.map((n) => n.id), ...edges.map((e) => e.id)];
		if (!ids.every((id) => width[id] > 0 && height[id] > 0)) return null;
		const size = (id: string) => ({ width: width[id], height: height[id] });
		return layoutGraph(
			Object.fromEntries(nodes.map((n) => [n.id, size(n.id)])),
			edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: size(e.id) }))
		);
	});

	/** Below this, fitting would make the math unreadable; the box scrolls instead. */
	const MIN_SCALE = 0.6;
	let boxWidth = $state(0);
	const scale = $derived(
		layout && fit && boxWidth > 0
			? Math.max(MIN_SCALE, Math.min(1, (boxWidth - 2) / layout.width))
			: 1
	);

	/** The selection and everything it touches, to highlight. */
	const lit = $derived.by(() => {
		const ids = new Set<string>();
		if (!selected) return ids;
		ids.add(selected.id);
		for (const e of edges) {
			if (selected.type === 'node' && (e.from === selected.id || e.to === selected.id)) {
				ids.add(e.id);
			}
			if (selected.type === 'edge' && e.id === selected.id) {
				ids.add(e.from);
				ids.add(e.to);
			}
		}
		return ids;
	});

	function select(type: 'node' | 'edge', id: string) {
		selected = selected?.id === id ? null : { type, id };
	}

	function position(id: string, kind: 'node' | 'edge') {
		if (!layout) return '';
		const p = kind === 'node' ? layout.nodes[id] : layout.edges[id]?.label;
		if (!p) return '';
		return `left:${p.x - width[id] / 2}px;top:${p.y - height[id] / 2}px`;
	}
</script>

<div
	class="dg-scroll"
	data-testid="graph"
	data-ready={layout ? '' : undefined}
	bind:clientWidth={boxWidth}
>
	{#if !layout}
		<p class="dg-loading" role="status">
			<span class="dg-spinner" aria-hidden="true"></span>
			Drawing the derivation…
		</p>
	{/if}
	<div
		class="dg-size"
		style:width={layout ? `${layout.width * scale}px` : '100%'}
		style:height={layout ? `${layout.height * scale}px` : '24rem'}
	>
		<div
			class="dg-canvas"
			class:ready={!!layout}
			style:width={layout ? `${layout.width}px` : '100%'}
			style:height={layout ? `${layout.height}px` : '24rem'}
			style:transform={scale < 1 ? `scale(${scale})` : undefined}
		>
			{#if layout}
				<svg class="dg-edges" width={layout.width} height={layout.height} aria-hidden="true">
					<defs>
						{#each ['plain', 'lit'] as tone (tone)}
							<marker
								id="{uid}-{tone}"
								viewBox="0 0 10 10"
								refX="9"
								refY="5"
								markerWidth="7"
								markerHeight="7"
								orient="auto-start-reverse"
							>
								<path d="M0,0 L10,5 L0,10 z" class="dg-head {tone}" />
							</marker>
						{/each}
					</defs>
					{#each edges as edge (edge.id)}
						{@const on = lit.has(edge.id)}
						<path
							d={edgePath(layout.edges[edge.id].points)}
							class="dg-edge"
							class:lit={on}
							marker-end="url(#{uid}-{on ? 'lit' : 'plain'})"
						/>
					{/each}
				</svg>
			{/if}

			{#each nodes as node (node.id)}
				<button
					type="button"
					class="dg-node {node.kind}"
					class:lit={lit.has(node.id)}
					aria-pressed={selected?.id === node.id}
					data-testid="node-{node.id}"
					style={position(node.id, 'node')}
					bind:offsetWidth={width[node.id]}
					bind:offsetHeight={height[node.id]}
					onclick={() => select('node', node.id)}
				>
					<span class="dg-title">
						{node.title}
						{#if node.correction}<span class="dg-flag" title="Corrected">corrected</span>{/if}
						{#if node.added}<span class="dg-flag added" title="Not in the paper">added</span>{/if}
					</span>
					<Tex html={node.html} />
				</button>
			{/each}

			{#each edges as edge (edge.id)}
				<button
					type="button"
					class="dg-label"
					class:lit={lit.has(edge.id)}
					class:corrected={!!edge.correction}
					aria-pressed={selected?.id === edge.id}
					data-testid="edge-{edge.id}"
					style={position(edge.id, 'edge')}
					bind:offsetWidth={width[edge.id]}
					bind:offsetHeight={height[edge.id]}
					onclick={() => select('edge', edge.id)}
				>
					<Tex html={edge.html} />
					<span class="sr-only">: from {titles[edge.from]} to {titles[edge.to]}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.dg-scroll {
		position: relative;
		overflow: auto;
		max-width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.dg-loading {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.dg-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: dg-spin 0.8s linear infinite;
	}

	@keyframes dg-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.dg-size {
		margin: 0 auto;
	}

	.dg-canvas {
		position: relative;
		transform-origin: top left;
		visibility: hidden;
	}

	.dg-canvas.ready {
		visibility: visible;
	}

	.dg-edges {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.dg-edge {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.5;
	}

	.dg-edge.lit {
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.dg-head {
		fill: var(--border-strong);
	}

	.dg-head.lit {
		fill: var(--accent);
	}

	.dg-node,
	.dg-label {
		position: absolute;
		left: 0;
		top: 0;
		width: max-content;
		font: inherit;
		color: var(--text);
		cursor: pointer;
	}

	.dg-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
	}

	.dg-node.assumption {
		border-style: dashed;
		background: var(--surface-2);
	}

	.dg-node.result {
		border: 2px solid var(--accent);
	}

	.dg-node.lit {
		background: var(--accent-bg);
		box-shadow: 0 0 0 2px var(--accent);
	}

	.dg-node :global(.katex-display) {
		margin: 0;
	}

	.dg-node :global(.katex) {
		font-size: 1.05em;
	}

	.dg-title {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.dg-flag {
		padding: 0 var(--sp-1);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--warning-text);
		background: var(--warning-bg);
		border-radius: var(--radius-sm);
	}

	.dg-flag.added {
		color: var(--info-text);
		background: var(--info-bg);
	}

	.dg-label {
		max-width: 13rem;
		padding: 1px var(--sp-1);
		font-size: var(--text-xs);
		line-height: 1.3;
		text-align: center;
		color: var(--text-muted);
		background: var(--surface);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
	}

	.dg-label :global(.ui-tex) {
		color: inherit;
	}

	.dg-label.corrected {
		border-color: var(--warning);
	}

	.dg-label:hover,
	.dg-node:hover {
		border-color: var(--accent);
	}

	.dg-label.lit {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-bg);
	}
</style>
