<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		buildGraph,
		computeRows,
		getAnswersForNode,
		encodePath,
		decodePath
	} from '$lib/decision-tree/graph';
	import { validateGraph } from '$lib/decision-tree/validation';
	import rawTreeData from '$lib/decision-tree/data/tree.json';
	import type { DecisionGraph, TraversalPath, RawTree } from '$lib/decision-tree/types';
	const treeData = rawTreeData as RawTree;

	// Build the graph once
	const graph: DecisionGraph = buildGraph(treeData);

	// Validate in dev mode
	if (import.meta.env.DEV) {
		const errors = validateGraph(graph);
		if (errors.length > 0) {
			console.error('Decision tree validation errors:', errors);
		}
	}

	// --- State ---
	let traversalPath = $state<TraversalPath>([]);
	let revealedExplanations = $state<Set<string>>(new Set());
	let isTouchDevice = $state(false);

	// --- Derived ---
	const visibleRows = $derived(computeRows(graph, traversalPath));
	const currentNode = $derived(
		traversalPath.length === 0
			? graph.nodes.get(graph.rootNodeId)!
			: (() => {
					const lastEdge = graph.edges.get(traversalPath[traversalPath.length - 1]);
					return lastEdge
						? graph.nodes.get(lastEdge.targetId)!
						: graph.nodes.get(graph.rootNodeId)!;
				})()
	);
	// --- URL helpers ---
	function readPathFromUrl(): TraversalPath | null {
		const p = page.url.searchParams.get('p');
		if (!p) return null;
		return decodePath(p);
	}

	function writePathToUrl(path: TraversalPath) {
		const params = new URLSearchParams(page.url.search);
		if (path.length > 0) {
			params.set('p', encodePath(path));
		} else {
			params.delete('p');
		}
		const qs = params.toString();
		const newUrl = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
		history.replaceState(null, '', newUrl);
	}

	// --- Answer selection ---
	function selectAnswer(edgeId: string, rowIndex: number) {
		// rowIndex is the answer row's index in visibleRows
		// Answer rows are: index 1, 3, 5, 7, ...
		// Path position = (rowIndex - 1) / 2
		const pathIndex = (rowIndex - 1) / 2;

		// Truncate path up to this position and append the new edge
		traversalPath = [...traversalPath.slice(0, pathIndex), edgeId];

		// Clear revealed explanations on path change
		revealedExplanations = new Set();
	}

	// --- Explanation toggle (mobile tap) ---
	function toggleExplanation(edgeId: string) {
		if (!isTouchDevice) return;
		const next = new Set(revealedExplanations);
		if (next.has(edgeId)) {
			next.delete(edgeId);
		} else {
			next.add(edgeId);
		}
		revealedExplanations = next;
	}

	function showExplanation(edgeId: string) {
		if (isTouchDevice) return;
		const next = new Set(revealedExplanations);
		next.add(edgeId);
		revealedExplanations = next;
	}

	function hideExplanation(edgeId: string) {
		if (isTouchDevice) return;
		const next = new Set(revealedExplanations);
		next.delete(edgeId);
		revealedExplanations = next;
	}

	// --- Autosave & URL sync ---
	$effect(() => {
		const path = traversalPath;
		localStorage.setItem('decision-tree-path', JSON.stringify(path));
		writePathToUrl(path);
	});

	// --- Init ---
	onMount(() => {
		isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		// Restore state: URL takes priority, then localStorage
		const urlPath = readPathFromUrl();
		if (urlPath && urlPath.length > 0) {
			traversalPath = urlPath;
		} else {
			try {
				const saved = localStorage.getItem('decision-tree-path');
				if (saved) {
					const parsed: TraversalPath = JSON.parse(saved);
					if (Array.isArray(parsed)) {
						traversalPath = parsed;
					}
				}
			} catch {
				// Ignore corrupt localStorage
			}
		}
	});
</script>

<svelte:head>
	<title>Decision Tree</title>
</svelte:head>

<div class="container">
	<header>
		<h1>DECISION TREE</h1>
		<p class="subtitle">Navigate a decision tree one answer at a time</p>
	</header>

	<div class="decision-tree-rows">
		{#each visibleRows as row (row.index)}
			{#if row.type === 'question'}
				<div class="question-row">
					<div class="question-prompt">{row.node.prompt}</div>
				</div>
			{:else if row.type === 'answer'}
				<div class="answer-row">
					{#each row.edges as edge (edge.id)}
						<button
							class="answer-btn"
							class:selected={edge.id === row.selectedEdgeId}
							class:has-explanation={!!edge.explanation}
							onclick={() => selectAnswer(edge.id, row.index)}
							onmouseenter={() => showExplanation(edge.id)}
							onmouseleave={() => hideExplanation(edge.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectAnswer(edge.id, row.index);
								}
							}}
						>
							<span class="answer-label">{edge.label}</span>
							{#if edge.explanation}
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<span
									class="explanation-tip"
									class:visible={revealedExplanations.has(edge.id)}
									onclick={(e) => {
										e.stopPropagation();
										toggleExplanation(edge.id);
									}}
								>
									{edge.explanation}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{:else if row.type === 'result'}
				<div class="result-row">
					<div class="result-card">
						<div class="result-icon">◆</div>
						<div class="result-text">{row.node.result}</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	/* ── Rows ── */
	.decision-tree-rows {
		margin-bottom: 1.5rem;
	}

	.question-row {
		padding: 0.5rem 0 0.25rem 0;
		text-align: center;
	}

	.question-prompt {
		font-size: 1rem;
		font-weight: 600;
		color: var(--futuristic-text);
		line-height: 1.4;
	}

	/* ── Answer row ── */
	.answer-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.25rem 0 0.75rem 0;
	}

	/* ── Answer buttons ── */
	.answer-btn {
		position: relative;
		padding: 0.45rem 1rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		color: var(--futuristic-text-dim);
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-align: center;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.answer-btn:hover {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
		background: rgba(0, 245, 255, 0.05);
	}

	.answer-btn.selected {
		background: rgba(0, 245, 255, 0.18);
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
		box-shadow: 0 0 12px rgba(0, 245, 255, 0.2);
	}

	.answer-btn:active {
		transform: scale(0.97);
	}

	/* ── Explanation tooltip ── */
	.explanation-tip {
		display: none;
		position: absolute;
		top: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		padding: 0.5rem 0.75rem;
		background: #1e1e30;
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--futuristic-text-dim);
		white-space: nowrap;
		z-index: 20;
		pointer-events: none;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		line-height: 1.4;
		max-width: 280px;
		white-space: normal;
	}

	/* Desktop hover — show on parent hover */
	@media (hover: hover) {
		.answer-btn.has-explanation:hover .explanation-tip {
			display: block;
		}
	}

	/* Mobile tap — toggle via class */
	.explanation-tip.visible {
		display: block;
		pointer-events: auto;
	}

	/* ── Result row ── */
	.result-row {
		padding: 0.75rem 0 0.25rem 0;
	}

	.result-card {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: rgba(0, 245, 255, 0.06);
		border: 1px solid var(--futuristic-cyan);
		border-radius: 10px;
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.1);
	}

	.result-icon {
		font-size: 1.25rem;
		color: var(--futuristic-cyan);
		flex-shrink: 0;
	}

	.result-text {
		font-size: 1rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		line-height: 1.4;
		letter-spacing: 0.02em;
	}

	/* ── Mobile ── */
	@media (max-width: 600px) {
		.question-prompt {
			font-size: 0.9rem;
		}

		.answer-btn {
			font-size: 0.8rem;
			padding: 0.4rem 0.85rem;
			flex: 1 1 auto;
		}

		.result-card {
			padding: 0.85rem 0.85rem;
			flex-direction: column;
			text-align: center;
			gap: 0.4rem;
		}

		.result-text {
			font-size: 0.9rem;
		}
	}
</style>
