<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { tick, type Snippet } from 'svelte';
	import { Answer, Button } from '#lib/ui/index.js';
	import { computeRows, selectAnswer } from './graph';
	import type { DecisionGraph, TraversalPath } from './types';

	interface Props {
		graph: DecisionGraph;
		path?: TraversalPath;
		/** The end of the last line, beside Start over (the page's How it works). */
		end?: Snippet;
	}

	let { graph, path = $bindable([]), end }: Props = $props();

	const rows = $derived(computeRows(graph, path));
	// The recommendation leads; the questions follow as the path that led to it
	const result = $derived.by(() => {
		const last = rows[rows.length - 1];
		return last?.type === 'result' ? last.node.result : undefined;
	});

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

{#if result !== undefined}
	<div class="recommendation">
		<p class="recommendation-label">Recommendation</p>
		<Answer headline={result} data-testid="result" />
	</div>
{/if}

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
					<Button
						variant="link"
						tone="muted"
						aria-describedby={`question-${row.index - 1}`}
						onclick={() => change(row.depth)}>Change</Button
					>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<p class="sr-only" role="status">{announcement}</p>

{#if path.length > 0 || end}
	<div class="last-line">
		{#if path.length > 0}
			<Button variant="link" tone="muted" onclick={restart}>Start over</Button>
		{/if}
		{@render end?.()}
	</div>
{/if}

<style>
	/* The answer first: a small muted label over the headline, then a rule */
	.recommendation {
		padding-bottom: var(--sp-3);
		margin-bottom: var(--sp-3);
		border-bottom: 1px solid var(--border);
	}

	.recommendation-label {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	/* The path: each question on the left, its answers on the right */
	.decision-tree-rows {
		display: grid;
		grid-template-columns: fit-content(18rem) minmax(0, 1fr);
		align-items: center;
		gap: var(--sp-2) var(--sp-4);
	}

	.question-prompt {
		margin: 0;
		font-size: var(--text-lg);
	}

	.answer-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
	}

	/* On a phone each question sits above its answers */
	@media (max-width: 40rem) {
		.decision-tree-rows {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--sp-1);
		}
		.answer-row:not(:last-child) {
			margin-bottom: var(--sp-2);
		}
	}

	/* Start over and How it works side by side, after a rule */
	.last-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-1) var(--sp-4);
		padding-top: var(--sp-2);
		margin-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}

	.last-line :global(details.how) {
		margin-top: 0;
	}

	/* Opened, How it works takes the full width below Start over */
	.last-line :global(details.how[open]) {
		flex-basis: 100%;
	}
</style>
