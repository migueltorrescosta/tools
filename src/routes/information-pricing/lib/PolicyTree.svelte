<script lang="ts">
	import type { PolicyTreeView } from '$lib/information-pricing/analysis';
	import { dataColour } from './format';
	import Legend from './Legend.svelte';
	import { scrollFocus } from './scroll-focus';
	import { LINE_HEIGHT, edgePath, layoutTree, nodeLines } from './tree-layout';

	let {
		view,
		inputs
	}: {
		view: PolicyTreeView;
		/** Input labels, model order (the view's own labels are symbols). */
		inputs: readonly string[];
	} = $props();

	const layout = $derived(layoutTree(view));
	const byId = $derived(new Map(view.nodes.map((n) => [n.id, n])));
	const splitOf = $derived(new Map(view.splits.map((s) => [s.node, s])));
	/** Savings fill: the surface tinted toward the data colour by weighted savings. */
	const fill = (f: number | null) =>
		f === null
			? 'var(--surface-2)'
			: `color-mix(in oklab, var(--data-3) ${Math.round(f * 40)}%, var(--surface))`;

	const description = $derived(
		view.nodes
			.map((n) => {
				const split = splitOf.get(n.id);
				const rule = split ? `, then splits on ${inputs[split.input]}` : '';
				return `Node ${n.id}: ${n.decisionLabel}, saves ${n.savingsLabel}, ${n.shareLabel} of scenarios${rule}`;
			})
			.join('. ')
	);
</script>

<figure class="chart tree">
	<Legend
		label="Decisions in the tree"
		items={view.legend.map((l) => ({
			key: l.decision,
			label: l.isStatusQuo ? `${l.label} (status quo)` : l.label,
			colour: dataColour(l.decision),
			dashed: l.isStatusQuo
		}))}
	/>
	<div class="scroll" use:scrollFocus={'Policy tree diagram'}>
		<svg
			viewBox="0 0 {layout.width} {layout.height}"
			width={layout.width}
			height={layout.height}
			role="img"
			aria-label="{view.title}. {description}."
			data-testid="policy-tree"
		>
			<defs>
				<marker
					id="tree-arrow"
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
				<path class="edge" d={edgePath(e.points)} marker-end="url(#tree-arrow)" />
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
				<polygon
					class="split"
					points="{s.x},{s.y - s.height / 2} {s.x + s.width / 2},{s.y} {s.x},{s.y +
						s.height / 2} {s.x - s.width / 2},{s.y}"
				/>
				<text class="split-label" x={s.x} y={s.y + 4} text-anchor="middle">{split.inputLabel}</text>
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
					stroke={n.isStatusQuo ? undefined : dataColour(n.decision)}
				/>
				{#each nodeLines(n) as line, k (k)}
					<text
						class="node-text"
						class:strong={k === 0}
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
		<span>Greener boxes save more, weighted by their share of scenarios.</span>
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
	.strong {
		font-weight: 600;
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
