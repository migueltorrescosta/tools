<script lang="ts" module>
	export type Selection = { type: 'node' | 'edge'; id: string } | null;
</script>

<script lang="ts">
	import { relationId, type Context } from '#lib/institutions/index.js';
	import {
		FAMILY,
		FAMILY_STYLE,
		KIND_STYLE,
		SYMMETRIC,
		UPWARD,
		shapePath,
		type Family
	} from '#lib/institutions/style.js';
	import { AsyncLayout } from '#lib/async-layout.svelte.js';
	import { edgePath, layoutGraph } from '#lib/graph-layout.js';
	import ScrollEdges from '#lib/ui/ScrollEdges.svelte';

	let {
		context,
		selected = $bindable(),
		hidden,
		steps,
		fit
	}: {
		context: Context;
		selected: Selection;
		/** Relation families left out of the drawing. */
		hidden: Set<Family>;
		/** A route's institutions in order: draw only them, numbered, with every label. */
		steps?: string[];
		/** Shrink the map to the width of its box; otherwise draw it full size and scroll. */
		fit: boolean;
	} = $props();

	const uid = $props.id();

	const step = $derived(steps && new Map(steps.map((id, i) => [id, i + 1])));
	const nodes = $derived(context.institutions.filter((i) => !step || step.has(i.id)));
	const edges = $derived(
		context.relations
			.filter((r) => !hidden.has(FAMILY[r.kind]))
			.filter((r) => !step || (step.has(r.from) && step.has(r.to)))
			.map((r) => ({ ...r, id: relationId(r), family: FAMILY[r.kind] }))
	);
	const names = $derived(Object.fromEntries(nodes.map((n) => [n.id, n.acronym ?? n.name])));

	// Rendered sizes, measured in the browser; the layout waits until every box has one.
	const width = $state<Record<string, number>>({});
	const height = $state<Record<string, number>>({});

	const request = $derived.by(() => {
		// A route's labels get room in the layout; on the full map, with over a hundred relations,
		// they would triple its width, so the selection's labels sit over the map instead.
		const sized = [...nodes.map((n) => n.id), ...(step ? edges.map((e) => e.id) : [])];
		if (!sized.every((id) => width[id] > 0 && height[id] > 0)) return undefined;
		const size = (id: string) => ({ width: width[id], height: height[id] });
		return {
			nodes: Object.fromEntries(nodes.map((n) => [n.id, size(n.id)])),
			edges: edges.map((e) => {
				const label = step ? size(e.id) : undefined;
				return UPWARD.has(e.kind)
					? { id: e.id, from: e.to, to: e.from, label }
					: { id: e.id, from: e.from, to: e.to, label };
			})
		};
	});
	const laidOut = new AsyncLayout(
		() => request,
		(r) => layoutGraph(r.nodes, r.edges, { nodeGap: 16, rowGap: 48 })
	);
	const layout = $derived(laidOut.latest ?? null);

	/** Route points from source to target, whichever way the layout ran the edge. */
	function route(e: (typeof edges)[number]) {
		const points = layout?.edges[e.id]?.points ?? [];
		return UPWARD.has(e.kind) ? [...points].reverse() : points;
	}

	/** The point halfway along a route, where its label sits. */
	function midpoint(points: { x: number; y: number }[]) {
		const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
		let rest = lengths.reduce((a, b) => a + b, 0) / 2;
		for (const [i, l] of lengths.entries()) {
			if (rest <= l) {
				const t = l ? rest / l : 0;
				const [a, b] = [points[i], points[i + 1]];
				return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
			}
			rest -= l;
		}
		return points[0] ?? { x: 0, y: 0 };
	}

	/** A label's centre: the room the layout left for it, else the middle of its arrow. */
	function labelAt(e: (typeof edges)[number]) {
		const laid = layout?.edges[e.id];
		if (!laid) return undefined;
		return step ? laid.label : midpoint(route(e));
	}

	let boxWidth = $state(0);
	const scale = $derived(
		fit && layout && boxWidth > 0 ? Math.min(1, (boxWidth - 2) / layout.width) : 1
	);

	/** The selection and everything it touches. */
	const lit = $derived.by(() => {
		const ids = new Set<string>();
		if (!selected) return ids;
		ids.add(selected.id);
		for (const e of edges) {
			if (selected.type === 'node' && (e.from === selected.id || e.to === selected.id)) {
				ids.add(e.id);
				ids.add(e.from);
				ids.add(e.to);
			}
			if (selected.type === 'edge' && e.id === selected.id) {
				ids.add(e.from);
				ids.add(e.to);
			}
		}
		return ids;
	});
	const dim = (id: string) => lit.size > 0 && !lit.has(id);
	/** On the full map only the selection's relations carry a label; a route labels them all. */
	const labelled = $derived(step ? edges : edges.filter((e) => lit.has(e.id)));

	function select(type: 'node' | 'edge', id: string) {
		selected = selected?.id === id ? null : { type, id };
	}

	function position(id: string) {
		const p = layout?.nodes[id];
		if (!p) return layout ? 'visibility:hidden' : '';
		return `left:${p.x - width[id] / 2}px;top:${p.y - height[id] / 2}px`;
	}
</script>

<ScrollEdges
	class="ig-scroll"
	data-testid="graph"
	data-ready={laidOut.ready ? '' : undefined}
	bind:width={boxWidth}
>
	{#if !layout}
		<p class="ig-loading" role="status">
			<span class="ig-spinner" aria-hidden="true"></span>
			Drawing the map…
		</p>
	{/if}
	<div
		class="ig-size"
		style:width={layout ? `${layout.width * scale}px` : '100%'}
		style:height={layout ? `${layout.height * scale}px` : '24rem'}
	>
		<div
			class="ig-canvas"
			class:ready={!!layout}
			style:width={layout ? `${layout.width}px` : '100%'}
			style:height={layout ? `${layout.height}px` : '24rem'}
			style:transform={scale < 1 ? `scale(${scale})` : undefined}
		>
			{#if layout}
				<svg class="ig-svg" width={layout.width} height={layout.height} aria-hidden="true">
					<defs>
						{#each Object.entries(FAMILY_STYLE) as [family, style] (family)}
							<marker
								id="{uid}-{family}"
								viewBox="0 0 10 10"
								refX="9"
								refY="5"
								markerWidth="7"
								markerHeight="7"
								orient="auto-start-reverse"
							>
								<path d="M0,0 L10,5 L0,10 z" style:fill="var({style.colour})" />
							</marker>
						{/each}
					</defs>
					{#each edges.filter((e) => layout.edges[e.id]) as edge (edge.id)}
						{@const style = FAMILY_STYLE[edge.family]}
						<path
							d={edgePath(route(edge))}
							class="ig-edge"
							class:lit={lit.has(edge.id)}
							class:dim={dim(edge.id)}
							style:stroke="var({style.colour})"
							stroke-dasharray={style.dash}
							marker-end={SYMMETRIC.has(edge.kind) ? undefined : `url(#${uid}-${edge.family})`}
						/>
					{/each}
					{#each nodes.filter((n) => layout.nodes[n.id]) as node (node.id)}
						{@const style = KIND_STYLE[node.kind]}
						{@const p = layout.nodes[node.id]}
						<path
							d={shapePath(style.shape, p.x, p.y, width[node.id], height[node.id])}
							class="ig-shape"
							class:lit={lit.has(node.id)}
							class:dim={dim(node.id)}
							style:--kind="var({style.colour})"
							stroke-dasharray={style.dashed ? '5 3' : undefined}
						/>
					{/each}
				</svg>
			{/if}

			{#each nodes as node (node.id)}
				<button
					type="button"
					class="ig-node shape-{KIND_STYLE[node.kind].shape}"
					class:dim={dim(node.id)}
					aria-pressed={selected?.id === node.id}
					data-testid="node-{node.id}"
					style={position(node.id)}
					bind:offsetWidth={width[node.id]}
					bind:offsetHeight={height[node.id]}
					onclick={() => select('node', node.id)}
				>
					{#if step}<span class="ig-step">{step.get(node.id)}</span>{/if}
					{#if node.acronym}<span class="ig-acronym">{node.acronym}</span>{/if}
					<span class="ig-name">{node.name}</span>
					<span class="sr-only">, {KIND_STYLE[node.kind].label}</span>
				</button>
			{/each}

			{#each labelled as edge (edge.id)}
				{@const p = labelAt(edge)}
				<button
					type="button"
					class="ig-label"
					class:lit={lit.has(edge.id)}
					aria-pressed={selected?.id === edge.id}
					data-testid="edge-{edge.id}"
					style={p ? `left:${p.x}px;top:${p.y}px` : 'visibility:hidden'}
					bind:offsetWidth={width[edge.id]}
					bind:offsetHeight={height[edge.id]}
					onclick={() => select('edge', edge.id)}
				>
					{edge.label}
					<span class="sr-only">: {names[edge.from]} to {names[edge.to]}</span>
				</button>
			{/each}
		</div>
	</div>
</ScrollEdges>

<style>
	:global(.ig-scroll) {
		position: relative;
		overflow: auto;
		max-width: 100%;
	}

	.ig-loading {
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

	.ig-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: ig-spin 0.8s linear infinite;
	}

	@keyframes ig-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.ig-size {
		margin: 0 auto;
	}

	.ig-canvas {
		position: relative;
		transform-origin: top left;
		visibility: hidden;
	}

	.ig-canvas.ready {
		visibility: visible;
	}

	.ig-svg {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.ig-edge {
		fill: none;
		stroke-width: 1.5;
	}

	.ig-edge.lit {
		stroke-width: 3;
	}

	/* The kind's colour outlines the box and tints its fill. */
	.ig-shape {
		fill: color-mix(in srgb, var(--kind) 14%, var(--surface));
		stroke: var(--kind);
		stroke-width: 1.5;
	}

	.ig-shape.lit {
		stroke-width: 3;
	}

	.dim {
		opacity: 0.25;
	}

	.ig-node,
	.ig-label {
		position: absolute;
		left: 0;
		top: 0;
		width: max-content;
		font: inherit;
		color: var(--text);
		cursor: pointer;
	}

	/* The button is see-through: the SVG behind it draws the shape. */
	.ig-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 12rem;
		padding: var(--sp-1) var(--sp-3);
		background: none;
		border: 0;
		text-align: center;
		line-height: 1.25;
	}

	.ig-node.shape-hexagon,
	.ig-node.shape-pill {
		padding-inline: var(--sp-4);
	}

	.ig-node.shape-slant {
		padding-inline: calc(var(--sp-3) + 6px);
	}

	.ig-node:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	/* A route's step number, on the box's top-left corner. */
	.ig-step {
		position: absolute;
		top: -0.6rem;
		left: -0.4rem;
		min-width: 1.3rem;
		padding: 0 0.3rem;
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1.3rem;
		color: var(--surface);
		background: var(--accent);
		border-radius: 999px;
	}

	.ig-acronym {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.ig-name {
		font-size: var(--text-xs);
	}

	/* Centred on its point, over the map. */
	.ig-label {
		z-index: 1;
		transform: translate(-50%, -50%);
		max-width: 9rem;
		min-height: 24px;
		padding: 1px var(--sp-1);
		font-size: var(--text-xs);
		line-height: 1.25;
		text-align: center;
		color: var(--text-muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.ig-label:hover {
		border-color: var(--accent);
	}

	.ig-label.lit {
		color: var(--text);
		border-color: var(--accent);
		background: var(--accent-bg);
	}
</style>
