<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Answer, Button, PageHeader } from '#lib/ui/index.js';
	import solutionTree from '#lib/wordle-solution.js';
	import {
		cycleTile as cycleResultTile,
		getTileColor,
		newAttempt,
		OPENER,
		setTile,
		solvedMessage,
		step,
		tileLabel,
		undoLast,
		type Attempt,
		type SolutionTree,
		type TileColor
	} from '#lib/wordle.js';

	let currentSolutionTree = $state<SolutionTree>(solutionTree);
	let history = $state<Attempt[]>([]);
	// visited[i] is the tree that was current when history[i] was submitted.
	let visited = $state<SolutionTree[]>([]);
	let nextAttempt = $state<Attempt>(newAttempt(OPENER));
	let message = $state('');
	let messageKind = $state<'error' | 'solved'>('error');
	/** Set once the page is interactive, so e2e tests can wait for hydration. */
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	let gameOver = $state(false);
	/** The tree is down to one word: the next guess is the answer, still to be confirmed. */
	let answerKnown = $derived(!gameOver && Object.keys(currentSolutionTree).length === 0);

	function showMessage(text: string, kind: typeof messageKind = 'error') {
		message = text;
		messageKind = kind;
	}

	const STATE_NAMES = { B: 'absent', Y: 'present', G: 'correct' } as const;

	function cycleTile(index: number) {
		nextAttempt = { ...nextAttempt, result: cycleResultTile(nextAttempt.result, index) };
	}

	function handleTileKeydown(e: KeyboardEvent, index: number) {
		if (e.key === '1' || e.key === 'b' || e.key === 'B') {
			setTileColor(index, 'B');
		} else if (e.key === '2' || e.key === 'y' || e.key === 'Y') {
			setTileColor(index, 'Y');
		} else if (e.key === '3' || e.key === 'g' || e.key === 'G') {
			setTileColor(index, 'G');
		} else if (e.key === 'ArrowLeft' && index > 0) {
			focusTile(index - 1);
		} else if (e.key === 'ArrowRight' && index < 4) {
			focusTile(index + 1);
		}
	}

	function setTileColor(index: number, color: TileColor) {
		nextAttempt = { ...nextAttempt, result: setTile(nextAttempt.result, index, color) };
	}

	function focusTile(index: number) {
		const inputs = document.querySelectorAll('.cell-input');
		(inputs[index] as HTMLButtonElement)?.focus();
	}

	function handleResultSubmission() {
		const result = nextAttempt.result.toUpperCase();
		const outcome = step(currentSolutionTree, result);

		if (outcome.error) {
			showMessage(outcome.error);
			gameOver = outcome.done;
			return;
		}

		visited = [...visited, currentSolutionTree];
		history = [...history, { ...nextAttempt, result }];
		currentSolutionTree = outcome.next;
		gameOver = outcome.done;

		if (outcome.won) {
			// The input row is hidden once the game is over, so it needs no word.
			showMessage(solvedMessage(history.length), 'solved');
			return;
		}

		nextAttempt = newAttempt(outcome.word.toUpperCase());
		showMessage('');
	}

	function undoLastRow() {
		const undone = undoLast(visited, history);
		if (!undone) return;
		currentSolutionTree = undone.tree;
		visited = undone.visited;
		history = undone.history;
		nextAttempt = undone.attempt;
		showMessage('');
		gameOver = false;
	}

	function restartGame() {
		currentSolutionTree = solutionTree;
		history = [];
		visited = [];
		nextAttempt = newAttempt(OPENER);
		showMessage('');
		gameOver = false;
	}
</script>

<div class="container">
	<PageHeader path="/wordle" />

	<div class="wordle-panel" data-hydrated={hydrated || undefined}>
		{#if !gameOver}
			<p class="instruction" data-testid="instruction">
				{#if answerKnown}
					Answer: <strong>{nextAttempt.word}</strong>. Play it, mark every tile green and Submit.
				{:else}
					Play <strong>{nextAttempt.word}</strong> in Wordle, then tap each tile below to match.
				{/if}
			</p>
		{/if}

		<div class="board">
			{#each history as attempt (attempt.word)}
				<div class="guess" data-testid="result-row">
					{#each Array(5) as _, i}
						{@const color = getTileColor(attempt.result, i)}
						<span
							class="cell"
							data-state={STATE_NAMES[color]}
							role="img"
							aria-label={tileLabel(attempt.word[i], i, color)}>{attempt.word[i]}</span
						>
					{/each}
				</div>
			{/each}

			{#if !gameOver}
				<div class="guess" role="group" aria-label="Next guess">
					{#each Array(5) as _, i}
						{@const color = getTileColor(nextAttempt.result, i)}
						<button
							type="button"
							class="cell cell-input"
							data-state={STATE_NAMES[color]}
							onclick={() => cycleTile(i)}
							onkeydown={(e) => handleTileKeydown(e, i)}
							aria-label={tileLabel(nextAttempt.word[i], i, color)}>{nextAttempt.word[i]}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		<div role="status" class="message">
			{#if message && messageKind === 'error'}
				<Alert tone="danger" live={false}><span data-testid="message">{message}</span></Alert>
			{:else if message}
				<Answer headline={message} data-testid="message" />
			{/if}
		</div>

		<div class="actions">
			{#if gameOver}
				<Button variant="primary" onclick={restartGame}>New game</Button>
			{:else}
				<Button variant="primary" class="submit" onclick={handleResultSubmission}>Submit</Button>
			{/if}
			{#if history.length > 0}
				<Button variant="ghost" class="text-link" onclick={undoLastRow}>Undo</Button>
			{/if}
		</div>
	</div>

	<details class="how">
		<summary>How it works</summary>
		<p>
			Play a guess in Wordle, tap the tiles here to match its colours, then press Submit. Each tap
			cycles a tile from black (not in the word) to yellow (in the word, wrong position) to green
			(right position). Yellow tiles carry a ~ and green tiles a ✓, so the colours never stand
			alone. The tool then shows the next word.
		</p>
		<p>
			Open with RAISE and play every suggestion as shown. Some suggestions are probes, not answers,
			and Hard Mode may reject some.
		</p>
		<p>
			Keys 1, 2 and 3 (or B, Y and G) set the focused tile to black, yellow or green; the arrow keys
			move between tiles. The details are in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/wordle.md">docs</a>, and
			the solver was
			<a href="https://blog.mptc.uk/posts/Wordle" target="_blank" rel="noreferrer"
				>first written up on the blog</a
			>.
		</p>
	</details>
</div>

<style>
	.wordle-panel {
		width: fit-content;
		overflow: visible;
		margin: 0;
		max-width: 100%;
		padding: var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.instruction {
		margin: 0 0 var(--sp-2);
	}

	.board {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.guess {
		display: flex;
		gap: var(--sp-1);
	}

	.cell {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font-size: var(--text-lg);
		font-weight: 700;
		line-height: 1;
	}

	.cell[data-state='absent'] {
		background: var(--tile-absent);
		color: var(--tile-absent-text);
	}

	.cell[data-state='present'] {
		background: var(--tile-present);
		color: var(--tile-present-text);
	}

	.cell[data-state='correct'] {
		background: var(--tile-correct);
		color: var(--tile-correct-text);
	}

	/* A corner mark, so the state is not conveyed by colour alone. */
	.cell[data-state='present']::after,
	.cell[data-state='correct']::after {
		position: absolute;
		top: 1px;
		right: 3px;
		font-size: 0.65em;
		line-height: 1;
		font-weight: 700;
	}

	.cell[data-state='present']::after {
		content: '~';
		font-size: 0.8em;
	}

	.cell[data-state='correct']::after {
		content: '✓';
	}

	.cell-input {
		border-color: var(--border-strong);
		cursor: pointer;
	}

	.cell-input:hover {
		border-color: var(--text);
	}

	.message > :global(*) {
		margin: var(--sp-2) 0 0;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		margin-top: var(--sp-3);
	}

	/* Submit is the wide main button; Undo is a quiet text link beside it. */
	.actions :global(.submit) {
		flex: 1;
		max-width: 14rem;
	}

	.actions :global(.text-link) {
		padding: 0 var(--sp-1);
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.actions :global(.text-link:hover:not(:disabled)) {
		background: transparent;
		color: var(--accent-hover);
	}

	.how p {
		margin: 0 0 var(--sp-2);
	}

	.how p:last-child {
		margin-bottom: 0;
	}
</style>
