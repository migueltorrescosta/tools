<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
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
	// Set in onMount; e2e tests wait for it so clicks are not lost before hydration
	let hydrated = $state(false);
	// SvelteKit's replaceState throws (in dev) until the router has started,
	// which happens after onMount, so the URL is synced only once this is set
	let routerReady = $state(false);

	// --- URL helpers ---
	function writePathToUrl(path: TraversalPath) {
		// Untracked: replaceState must not make the sync effect depend on page
		const url = untrack(() => new URL(page.url));
		if (path.length > 0) {
			url.searchParams.set('p', encodePath(graph, path));
		} else {
			url.searchParams.delete('p');
		}
		replaceState(url, {});
	}

	/** localStorage, or null where reading the property itself throws (blocked storage). */
	function getStorage(): Storage | null {
		if (!browser) return null;
		try {
			return localStorage;
		} catch {
			return null;
		}
	}

	// --- Autosave & URL sync ---
	const STORAGE_KEY = 'decision-tree-path';
	// Closed until onMount has restored the saved path: this effect runs before
	// onMount and would otherwise overwrite the saved path and ?p with [].
	const persist = createPersistGate(getStorage());

	$effect(() => {
		const path = traversalPath;
		const json = JSON.stringify(path);
		if (!persist.isOpen) return;
		try {
			persist.write(STORAGE_KEY, json);
		} catch {
			// Storage full or blocked: the URL still carries the path
		}
		if (routerReady) writePathToUrl(path);
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
		hydrated = true;
		// A macrotask runs after SvelteKit finishes starting the router
		const timer = setTimeout(() => (routerReady = true));
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Decision Tree</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>DECISION TREE</h1>
		<p class="subtitle">Navigate a decision tree one answer at a time</p>
	</header>

	<DecisionTree {graph} bind:path={traversalPath} />
</div>
