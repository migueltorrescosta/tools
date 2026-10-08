<script lang="ts">
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

	function choose(depth: number, edgeId: string) {
		path = selectAnswer(path, depth, edgeId);
		revealed = new Set();
	}

	function toggleExplanation(edgeId: string) {
		const next = new Set(revealed);
		if (!next.delete(edgeId)) next.add(edgeId);
		revealed = next;
	}
</script>

<div class="decision-tree-rows">
	{#each rows as row (row.index)}
		{#if row.type === 'question'}
			<div class="question-row">
				<div class="question-prompt">{row.node.prompt}</div>
			</div>
		{:else if row.type === 'answer'}
			<div class="answer-row">
				{#each row.edges as edge, i (edge.id)}
					{@const tipId = `explanation-${row.depth}-${i}`}
					<div class="answer-item">
						<button
							class="answer-btn"
							class:selected={edge.id === row.selectedEdgeId}
							aria-describedby={edge.explanation ? tipId : undefined}
							onclick={() => choose(row.depth, edge.id)}
						>
							{edge.label}
						</button>
						{#if edge.explanation}
							<button
								class="explain-btn"
								aria-label={`Explain "${edge.label}"`}
								aria-expanded={revealed.has(edge.id)}
								aria-controls={tipId}
								onclick={() => toggleExplanation(edge.id)}
							>
								?
							</button>
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
			<div class="result-row">
				<div class="result-card">
					<div class="result-icon">◆</div>
					<div class="result-text">{row.node.result}</div>
				</div>
			</div>
		{/if}
	{/each}
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
	.answer-item {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		gap: 0.2rem;
	}

	.answer-btn {
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

	.explain-btn {
		padding: 0 0.5rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		color: var(--futuristic-text-dim);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.explain-btn:hover,
	.explain-btn[aria-expanded='true'] {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.answer-btn:focus-visible,
	.explain-btn:focus-visible {
		outline: 2px solid var(--futuristic-cyan);
		outline-offset: 2px;
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
		z-index: 20;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		line-height: 1.4;
		width: max-content;
		max-width: 280px;
		white-space: normal;
	}

	/* Shown on pointer hover, on keyboard focus of the answer, or when toggled
	   with the ? button (touch and keyboard) */
	@media (hover: hover) {
		.answer-item:hover .explanation-tip {
			display: block;
		}
	}

	.answer-item:has(.answer-btn:focus-visible) .explanation-tip,
	.explanation-tip.visible {
		display: block;
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
