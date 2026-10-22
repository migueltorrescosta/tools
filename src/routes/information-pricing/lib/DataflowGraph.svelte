<script lang="ts">
	import { reach, type Dataflow } from '$lib/information-pricing/dataflow';
	import { edgePath, layoutGraph } from '$lib/scientific-derivations/layout';
	import { renderTex } from '$lib/tex';
	import Tex from '$lib/ui/Tex.svelte';

	/** The model's dataflow as a top-to-bottom graph; picking a node lights its chain. */
	let {
		graph,
		selected = $bindable()
	}: {
		graph: Dataflow;
		/** The picked node's id, or null. */
		selected: string | null;
	} = $props();

	const uid = $props.id();

	const nodes = $derived(
		graph.nodes.map((n) => ({ ...n, html: n.tex === null ? null : renderTex(n.tex) }))
	);
	const labels = $derived(new Map(graph.nodes.map((n) => [n.id, n.label])));

	// Rendered sizes, measured in the browser; the layout waits until every node has one.
	const width = $state<Record<string, number>>({});
	const height = $state<Record<string, number>>({});
	const NO_LABEL = { width: 0, height: 0 };

	let boxWidth = $state(0);
	/** Boxes per row before inputs move up a row: narrow columns grow the graph taller. */
	const perRow = $derived(Math.min(6, Math.max(2, Math.floor(boxWidth / 220))));

	const layout = $derived.by(() => {
		if (!nodes.every((n) => width[n.id] > 0 && height[n.id] > 0)) return null;
		return layoutGraph(
			Object.fromEntries(nodes.map((n) => [n.id, { width: width[n.id], height: height[n.id] }])),
			graph.edges.map((e) => ({ ...e, label: NO_LABEL })),
			perRow
		);
	});

	/** Below this the math gets too small to read; the box scrolls instead. */
	const MIN_SCALE = 0.65;
	const scale = $derived(
		layout && boxWidth > 0 ? Math.max(MIN_SCALE, Math.min(1, (boxWidth - 2) / layout.width)) : 1
	);

	/** The picked node's whole chain: everything upstream and downstream. */
	const lit = $derived.by(() => {
		if (!selected || !labels.has(selected)) return { nodes: new Set<string>(), edges: new Set() };
		const up = reach(graph, selected, 'up');
		const down = reach(graph, selected, 'down');
		return {
			nodes: new Set([...up.nodes, ...down.nodes]),
			edges: new Set([...up.edges, ...down.edges])
		};
	});

	/** What the graph shows, in words. */
	const summary = $derived.by(() => {
		const uses = graph.nodes
			.map((n) => {
				const from = graph.edges.filter((e) => e.to === n.id).map((e) => labels.get(e.from));
				return from.length ? `${n.label} uses ${from.join(', ')}.` : '';
			})
			.filter(Boolean);
		return `${graph.nodes.length} nodes and ${graph.edges.length} arrows. ${uses.join(' ')}`;
	});

	function position(id: string) {
		const p = layout?.nodes[id];
		return p ? `left:${p.x - width[id] / 2}px;top:${p.y - height[id] / 2}px` : '';
	}
</script>

<div
	class="df-scroll"
	role="group"
	aria-label="Dataflow"
	aria-describedby="df-summary-{uid}"
	data-testid="dataflow"
	data-ready={layout ? '' : undefined}
	data-edges={graph.edges.length}
	bind:clientWidth={boxWidth}
>
	<p id="df-summary-{uid}" class="sr-only">{summary}</p>
	<div
		class="df-size"
		style:width={layout ? `${layout.width * scale}px` : '100%'}
		style:height={layout ? `${layout.height * scale}px` : '12rem'}
	>
		<div
			class="df-canvas"
			class:ready={!!layout}
			style:width={layout ? `${layout.width}px` : '100%'}
			style:height={layout ? `${layout.height}px` : '12rem'}
			style:transform={scale < 1 ? `scale(${scale})` : undefined}
		>
			{#if layout}
				<svg class="df-edges" width={layout.width} height={layout.height} aria-hidden="true">
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
								<path d="M0,0 L10,5 L0,10 z" class="df-head {tone}" />
							</marker>
						{/each}
					</defs>
					{#each graph.edges as edge (edge.id)}
						{@const on = lit.edges.has(edge.id)}
						<path
							d={edgePath(layout.edges[edge.id].points)}
							class="df-edge"
							class:lit={on}
							data-testid="dataflow-edge"
							marker-end="url(#{uid}-{on ? 'lit' : 'plain'})"
						/>
					{/each}
				</svg>
			{/if}

			{#each nodes as node (node.id)}
				<button
					type="button"
					class="df-node {node.kind}"
					class:error={node.error}
					class:picked={selected === node.id}
					class:lit={lit.nodes.has(node.id)}
					aria-pressed={selected === node.id}
					data-testid="dataflow-node"
					data-node={node.id}
					data-kind={node.kind}
					style={position(node.id)}
					bind:offsetWidth={width[node.id]}
					bind:offsetHeight={height[node.id]}
					onclick={() => (selected = selected === node.id ? null : node.id)}
					onkeydown={(e) => {
						if (e.key === 'Escape' && selected) {
							selected = null;
							e.stopPropagation();
						}
					}}
				>
					{#if node.title}<span class="df-title">{node.title}</span>{:else}<span class="sr-only"
							>{node.label}</span
						>{/if}
					{#if node.html !== null}
						<Tex html={node.html} />
					{:else}
						<code class="df-raw">{node.raw || '(empty)'}</code>
						<span class="sr-only">(has an error)</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.df-scroll {
		position: relative;
		overflow: auto;
		max-width: 100%;
		max-height: calc(100vh - var(--topbar-h) - 5rem);
		min-height: 6rem;
	}
	.df-size {
		margin: 0 auto;
	}
	.df-canvas {
		position: relative;
		transform-origin: top left;
		visibility: hidden;
	}
	.df-canvas.ready {
		visibility: visible;
	}
	.df-edges {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.df-edge {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.25;
	}
	.df-edge.lit {
		stroke: var(--accent);
		stroke-width: 2.5;
	}
	.df-head {
		fill: var(--border-strong);
	}
	.df-head.lit {
		fill: var(--accent);
	}
	.df-node {
		position: absolute;
		left: 0;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: max-content;
		max-width: 26rem;
		padding: 3px 6px;
		font: inherit;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.df-node:hover {
		border-color: var(--accent);
	}
	.df-node.fixed {
		border-style: dashed;
	}
	.df-node.input,
	.df-node.fixed {
		background: var(--surface-2);
	}
	.df-node.decision,
	.df-node.reward {
		border: 2px solid var(--accent);
	}
	.df-node.error {
		border: 2px solid var(--danger);
		background: var(--danger-bg);
	}
	.df-node.lit {
		box-shadow: 0 0 0 1px var(--accent);
	}
	.df-node.picked {
		background: var(--accent-bg);
		box-shadow: 0 0 0 2px var(--accent);
	}
	/* The name wraps to the formula's width instead of widening the box. */
	.df-title {
		width: 0;
		min-width: 100%;
		text-align: center;
		overflow-wrap: break-word;
		font-size: 0.6875rem;
		color: var(--text-muted);
		line-height: 1.2;
	}
	.df-node :global(.katex) {
		font-size: 0.9em;
	}
	.df-raw {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
