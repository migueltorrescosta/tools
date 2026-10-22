<script lang="ts">
	import type { PolicyTreeView } from '$lib/information-pricing/analysis';
	import { dataColour } from './format';
	import Legend from './Legend.svelte';
	import { scrollFocus } from './scroll-focus';
	import { LINE_HEIGHT, edgePath, layoutTree, nodeLines, splitText } from './tree-layout';

	let {
		view,
		inputs,
		maximized = false
	}: {
		view: PolicyTreeView;
		/** Input names, model order (the view's own labels are symbols). */
		inputs: readonly string[];
		/** In a full-window overlay: at scale 1, centred, scrolling if still too big. */
		maximized?: boolean;
	} = $props();

	const uid = $props.id();

	const layout = $derived(layoutTree(view, inputs));

	/** A tree a little wider than its box shrinks to fit (down to MIN_SCALE); a wider one scrolls. */
	const MIN_SCALE = 0.8;
	let boxWidth = $state(0);
	const scale = $derived(
		!maximized && boxWidth > 0 && layout.width > boxWidth && layout.width * MIN_SCALE <= boxWidth
			? boxWidth / layout.width
			: 1
	);

	/** A tree that still scrolls opens at its root (the middle), not its left edge. */
	let scroller = $state<HTMLDivElement>();
	$effect(() => {
		if (!scroller || !layout.width) return;
		void scale;
		scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
	});
	const byId = $derived(new Map(view.nodes.map((n) => [n.id, n])));
	const splitOf = $derived(new Map(view.splits.map((s) => [s.node, s])));
	/** Savings × share fill (log, from the view): green at 0, yellow halfway, red at the tree's largest. */
	const fill = (f: number | null) =>
		f === null
			? 'var(--surface-2)'
			: f <= 0.5
				? `color-mix(in oklab, var(--warning-fill) ${Math.round(f * 200)}%, var(--success-fill))`
				: `color-mix(in oklab, var(--danger-fill) ${Math.round(f * 200 - 100)}%, var(--warning-fill))`;

	const description = $derived(
		view.nodes
			.map((n) => {
				const split = splitOf.get(n.id);
				const rule = split ? `, then splits on ${splitText(split, inputs)}` : '';
				return `Node ${n.id}: ${n.decisionLabel}, saves ${n.savingsLabel}, ${n.shareLabel} of scenarios${rule}`;
			})
			.join('. ')
	);
</script>

<figure class="chart tree" class:maximized>
	<Legend
		label="Decisions in the tree"
		items={view.legend.map((l) => ({
			key: l.decision,
			label: l.isStatusQuo ? `${l.label} (status quo)` : l.label,
			colour: dataColour(l.decision),
			dashed: l.isStatusQuo
		}))}
	/>
	<div
		class="scroll"
		bind:this={scroller}
		bind:clientWidth={boxWidth}
		use:scrollFocus={'Policy tree diagram'}
	>
		<svg
			viewBox="0 0 {layout.width} {layout.height}"
			width={layout.width * scale}
			height={layout.height * scale}
			role="img"
			aria-label="Optimal Policy Tree. {description}."
			data-testid="policy-tree"
		>
			<defs>
				<marker
					id="tree-arrow-{uid}"
					viewBox="0 0 8 8"
					refX="7"
					refY="4"
					markerWidth="7"
					markerHeight="7"
					orient="auto"
				>
					<path d="M0,0L8,4L0,8Z" class="arrow" />
				</marker>
			</defs>
			{#each layout.edges as e (e.id)}
				<path class="edge" d={edgePath(e.points)} marker-end="url(#tree-arrow-{uid})" />
			{/each}
			{#each layout.edges as e (e.id)}
				{#if e.label}
					<rect
						class="edge-label-bg"
						x={e.label.x - e.label.text.length * 3.6 - 3}
						y={e.label.y - 9}
						width={e.label.text.length * 7.2 + 6}
						height={17}
						rx="3"
					/>
					<text class="edge-label" x={e.label.x} y={e.label.y + 4} text-anchor="middle"
						>{e.label.text}</text
					>
				{/if}
			{/each}
			{#each layout.splits as s (s.node)}
				{@const split = splitOf.get(s.node)!}
				<rect
					class="split"
					x={s.x - s.width / 2}
					y={s.y - s.height / 2}
					width={s.width}
					height={s.height}
					rx={s.height / 2}
				/>
				<text class="split-label" x={s.x} y={s.y + 4} text-anchor="middle"
					>{splitText(split, inputs)}</text
				>
			{/each}
			{#each layout.nodes as box (box.id)}
				{@const n = byId.get(box.id)!}
				<rect
					class="node"
					class:quo={n.isStatusQuo}
					x={box.x - box.width / 2}
					y={box.y - box.height / 2}
					width={box.width}
					height={box.height}
					rx="5"
					fill={fill(n.fill)}
					data-fill={n.fill}
					data-testid="tree-node"
					stroke={n.isStatusQuo ? undefined : dataColour(n.decision)}
				/>
				{#each nodeLines(n) as line, k (k)}
					<text
						class="node-text"
						x={box.x}
						y={box.y - box.height / 2 + 8 + (k + 0.75) * LINE_HEIGHT}
						text-anchor="middle">{line}</text
					>
				{/each}
			{/each}
		</svg>
	</div>
	<figcaption class="footer">
		{#each view.footer as line (line)}<span>{line}</span>{/each}
		<span
			>Each box: what its scenarios save, and their share. Its border is the decision. Red boxes
			save the most overall; a box saving a tenth as much is yellow, a hundredth or less green.</span
		>
	</figcaption>
</figure>

<style>
	.scroll {
		overflow-x: auto;
		max-width: 100%;
	}
	.scroll svg {
		display: block;
		margin: 0 auto;
		max-width: none;
	}
	/* Maximized: legend, the tree centred in the space left, footer. */
	.tree.maximized {
		display: flex;
		flex-direction: column;
	}
	.tree.maximized .scroll {
		display: flex;
		flex: 1 1 0;
		min-height: 0;
		overflow: auto;
	}
	.tree.maximized .scroll svg {
		flex: none;
		margin: auto;
	}
	.edge {
		fill: none;
		stroke: var(--border-strong);
		stroke-width: 1.2;
	}
	.arrow {
		fill: var(--border-strong);
	}
	.edge-label-bg {
		fill: var(--surface);
	}
	.edge-label,
	.split-label,
	.node-text {
		fill: var(--text);
		font-size: 12px;
	}
	.edge-label {
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.split {
		fill: var(--surface-2);
		stroke: var(--border-strong);
	}
	.split-label {
		font-weight: 600;
	}
	.node {
		stroke-width: 2.5;
	}
	.node.quo {
		stroke: var(--border-strong);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
	.footer {
		display: flex;
		flex-direction: column;
		gap: var(--sp-0);
		margin-top: var(--sp-2);
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
