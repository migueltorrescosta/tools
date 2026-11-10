<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { tick } from 'svelte';
	import { Button } from '#lib/ui/index.js';
	import { computeRows, selectAnswer } from './graph';
	import type { DecisionGraph, TraversalPath } from './types';

	interface Props {
		graph: DecisionGraph;
		path?: TraversalPath;
	}

	let { graph, path = $bindable([]) }: Props = $props();

	const rows = $derived(computeRows(graph, path));

	// Answered questions show only the chosen answer; Change adds their depth here to show them all
	const reopened = new SvelteSet<number>();

	// Read out by the live region below whenever a choice reveals a new question or the result
	const announcement = $derived.by(() => {
		const last = rows[rows.length - 1];
		if (last?.type === 'result') return `Result: ${last.node.result}`;
		const question = rows[rows.length - 2];
		return question?.type === 'question' ? question.node.prompt : '';
	});

	let container: HTMLDivElement | undefined = $state();

	function choose(depth: number, edgeId: string) {
		// Picking the answer already chosen keeps the questions after it
		if (path[depth] !== edgeId) path = selectAnswer(path, depth, edgeId);
		for (const d of [...reopened]) if (d >= depth) reopened.delete(d);
	}

	/** Show every answer of an answered question again, with focus on the chosen one. */
	async function change(depth: number) {
		reopened.add(depth);
		await tick();
		container
			?.querySelector<HTMLButtonElement>(`[data-depth="${depth}"] [aria-pressed="true"]`)
			?.focus();
	}

	/** Clear every answer and move focus to the root question's first answer. */
	async function restart() {
		path = [];
		reopened.clear();
		await tick();
		container?.querySelector<HTMLButtonElement>('.answer-btn')?.focus();
	}
</script>

<div class="decision-tree-rows" bind:this={container}>
	{#each rows as row (row.index)}
		{#if row.type === 'question'}
			<h2 class="question-prompt" id={`question-${row.index}`}>{row.node.prompt}</h2>
		{:else if row.type === 'answer'}
			{@const folded = row.selectedEdgeId !== undefined && !reopened.has(row.depth)}
			<div
				class="answer-row"
				role="group"
				aria-labelledby={`question-${row.index - 1}`}
				data-testid="answers"
				data-depth={row.depth}
			>
				{#each row.edges as edge (edge.id)}
					{#if !folded || edge.id === row.selectedEdgeId}
						<Button
							class="answer-btn"
							pressed={edge.id === row.selectedEdgeId}
							onclick={() => choose(row.depth, edge.id)}
						>
							{edge.label}
						</Button>
					{/if}
				{/each}
				{#if folded}
					<button
						type="button"
						class="text-link"
						aria-describedby={`question-${row.index - 1}`}
						onclick={() => change(row.depth)}>Change</button
					>
				{/if}
			</div>
		{:else if row.type === 'result'}
			<p class="result-card" data-testid="result">{row.node.result}</p>
		{/if}
	{/each}
</div>

<p class="sr-only" role="status">{announcement}</p>

{#if path.length > 0}
	<div class="restart-row">
		<button type="button" class="text-link" onclick={restart}>Start over</button>
	</div>
{/if}

<style>
	.decision-tree-rows {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-4);
	}

	.question-prompt {
		margin-top: var(--sp-2);
		font-size: var(--text-lg);
		text-align: center;
	}

	.answer-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: var(--sp-2);
	}

	/* The result ends the journey: the recommendation alone, centred and larger */
	.result-card {
		max-width: 100%;
		margin: var(--sp-3) 0 0;
		padding: var(--sp-4) var(--sp-6);
		background: var(--accent-bg);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		font-size: var(--text-xl);
		font-weight: 600;
		text-align: center;
		color: var(--text);
	}

	/* Change and Start over are quiet links, so they never read as one more answer */
	.text-link {
		min-height: var(--control-h);
		padding: 0 var(--sp-1);
		border: 0;
		background: none;
		color: var(--text-muted);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.text-link:hover {
		color: var(--text);
	}

	.restart-row {
		display: flex;
		justify-content: center;
	}
</style>
