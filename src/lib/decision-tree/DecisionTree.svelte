<script lang="ts">
	import { tick } from 'svelte';
	import { Button } from '$lib/ui';
	import { computeRows, selectAnswer } from './graph';
	import type { DecisionGraph, TraversalPath } from './types';

	interface Props {
		graph: DecisionGraph;
		path?: TraversalPath;
	}

	let { graph, path = $bindable([]) }: Props = $props();

	const rows = $derived(computeRows(graph, path));

	// Read out by the live region below whenever a choice reveals a new question or the result
	const announcement = $derived.by(() => {
		const last = rows[rows.length - 1];
		if (last?.type === 'result') return `Result: ${last.node.result}`;
		const question = rows[rows.length - 2];
		return question?.type === 'question' ? question.node.prompt : '';
	});

	let container: HTMLDivElement | undefined = $state();

	function choose(depth: number, edgeId: string) {
		path = selectAnswer(path, depth, edgeId);
	}

	/** Clear every answer and move focus to the root question's first answer. */
	async function restart() {
		path = [];
		await tick();
		container?.querySelector<HTMLButtonElement>('.answer-btn')?.focus();
	}
</script>

<div class="decision-tree-rows" bind:this={container}>
	{#each rows as row (row.index)}
		{#if row.type === 'question'}
			<h2 class="question-prompt" id={`question-${row.index}`}>{row.node.prompt}</h2>
		{:else if row.type === 'answer'}
			<div
				class="answer-row"
				role="group"
				aria-labelledby={`question-${row.index - 1}`}
				data-testid="answers"
			>
				{#each row.edges as edge (edge.id)}
					<Button
						class="answer-btn"
						pressed={edge.id === row.selectedEdgeId}
						onclick={() => choose(row.depth, edge.id)}
					>
						{edge.label}
					</Button>
				{/each}
			</div>
		{:else if row.type === 'result'}
			<div class="result-card">
				<span class="result-label">Result</span>
				<span class="result-text" data-testid="result">{row.node.result}</span>
			</div>
		{/if}
	{/each}
</div>

<p class="sr-only" role="status">{announcement}</p>

{#if path.length > 0}
	<div class="restart-row">
		<Button size="sm" onclick={restart}>Start over</Button>
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
		gap: var(--sp-2);
	}

	.result-card {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: var(--sp-1) var(--sp-3);
		margin-top: var(--sp-2);
		padding: var(--sp-3) var(--sp-4);
		background: var(--accent-bg);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
	}

	.result-label {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.result-text {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text);
	}

	.restart-row {
		display: flex;
		justify-content: center;
	}
</style>
