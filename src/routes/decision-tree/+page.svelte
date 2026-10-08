<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { createPersistGate } from '$lib/persist-gate';
	import { buildGraph, encodePath, restorePath } from '$lib/decision-tree/graph';
	import DecisionTree from '$lib/decision-tree/DecisionTree.svelte';
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

	// --- Autosave & URL sync ---
	const STORAGE_KEY = 'decision-tree-path';
	// Closed until onMount has restored the saved path: this effect runs before
	// onMount and would otherwise overwrite the saved path and ?p with [].
	const persist = createPersistGate(browser ? localStorage : null);

	$effect(() => {
		const path = traversalPath;
		const json = JSON.stringify(path);
		if (!persist.isOpen) return;
		persist.write(STORAGE_KEY, json);
		writePathToUrl(path);
	});

	// --- Init ---
	onMount(() => {
		// Restore state: URL takes priority, then localStorage
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(STORAGE_KEY);
		} catch {
			// Storage blocked: start from the URL or the root
		}
		traversalPath = restorePath(graph, page.url.searchParams.get('p'), saved);
		persist.open();
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

	<DecisionTree {graph} bind:path={traversalPath} />
</div>
