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

	// Edge ids of explanations opened with the ? button; cleared on every answer
	let revealed = $state<Set<string>>(new Set());

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
		revealed = new Set();
	}

	/** Clear every answer and move focus to the root question's first answer. */
	async function restart() {
		path = [];
		revealed = new Set();
		await tick();
		container?.querySelector<HTMLButtonElement>('.answer-btn')?.focus();
	}

	function toggleExplanation(edgeId: string) {
		const next = new Set(revealed);
		if (!next.delete(edgeId)) next.add(edgeId);
		revealed = next;
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
				{#each row.edges as edge, i (edge.id)}
					{@const tipId = `explanation-${row.depth}-${i}`}
					<div class="answer-item">
						<Button
							class="answer-btn"
							pressed={edge.id === row.selectedEdgeId}
							aria-describedby={edge.explanation ? tipId : undefined}
							onclick={() => choose(row.depth, edge.id)}
						>
							{edge.label}
						</Button>
						{#if edge.explanation}
							<Button
								class="explain-btn"
								variant="ghost"
								aria-label={`Explain "${edge.label}"`}
								aria-expanded={revealed.has(edge.id)}
								aria-controls={tipId}
								onclick={() => toggleExplanation(edge.id)}
							>
								?
							</Button>
							<span
								id={tipId}
								role="tooltip"
								class="explanation-tip"
								class:visible={revealed.has(edge.id)}
							>
								{edge.explanation}
							</span>
						{/if}
					</div>
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

	.answer-item {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		gap: var(--sp-0);
	}

	.answer-item :global(.explain-btn) {
		min-width: var(--control-h);
		padding: 0 var(--sp-2);
		color: var(--text-muted);
	}

	.answer-item :global(.explain-btn[aria-expanded='true']) {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Explanation tooltip */
	.explanation-tip {
		display: none;
		position: absolute;
		top: 100%;
		margin-top: var(--sp-1);
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		width: max-content;
		max-width: 280px;
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		color: var(--text);
		font-size: var(--text-sm);
		font-weight: 400;
		white-space: normal;
	}

	/* Shown on pointer hover, on keyboard focus of the answer, or when toggled
	   with the ? button (touch and keyboard) */
	@media (hover: hover) {
		.answer-item:hover .explanation-tip {
			display: block;
		}
	}

	.answer-item:has(:global(.answer-btn:focus-visible)) .explanation-tip,
	.explanation-tip.visible {
		display: block;
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
