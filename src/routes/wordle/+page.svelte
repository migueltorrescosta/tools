<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, PageHeader } from '$lib/ui';
	import solutionTree from '$lib/wordle-solution';
	import {
		answerMessage,
		cycleTile as cycleResultTile,
		getTileColor,
		newAttempt,
		OPENER,
		setTile,
		step,
		tileLabel,
		undoLast,
		WIN_MESSAGE,
		type Attempt,
		type SolutionTree,
		type TileColor
	} from '$lib/wordle';

	let currentSolutionTree = $state<SolutionTree>(solutionTree);
	let history = $state<Attempt[]>([]);
	// visited[i] is the tree that was current when history[i] was submitted.
	let visited = $state<SolutionTree[]>([]);
	let nextAttempt = $state<Attempt>(newAttempt(OPENER));
	let message = $state('');
	let messageKind = $state<'error' | 'success' | 'info'>('error');
	/** Set once the page is interactive, so e2e tests can wait for hydration. */
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	let gameOver = $state(false);

	function showMessage(text: string, kind: typeof messageKind = 'error') {
		message = text;
		messageKind = kind;
	}

	const STATE_NAMES = { B: 'absent', Y: 'present', G: 'correct' } as const;
	const MESSAGE_ICONS = { error: '✕', success: '✓', info: 'ℹ' } as const;

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
			showMessage(WIN_MESSAGE, 'success');
			return;
		}

		nextAttempt = newAttempt(outcome.word.toUpperCase());
		showMessage(outcome.solved ? answerMessage(outcome.word) : '', 'info');
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
	<PageHeader path="/wordle">
		<a href="https://blog.mptc.uk/posts/Wordle" target="_blank" rel="noreferrer"
			>First written up on the blog</a
		>
	</PageHeader>

	<div class="wordle-panel" data-hydrated={hydrated || undefined}>
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

			<div class="current">
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
								aria-label={tileLabel(nextAttempt.word[i], i, color)}
								title="Click to cycle: Black (not in word) → Yellow → Green. Keys: 1/B=Black, 2/Y=Yellow, 3/G=Green, Arrow keys to navigate"
								>{nextAttempt.word[i]}</button
							>
						{/each}
					</div>
				{/if}
				<div class="cluster">
					{#if gameOver}
						<Button onclick={restartGame}>Start New Game</Button>
					{:else}
						<Button variant="primary" onclick={handleResultSubmission}>Submit</Button>
					{/if}
					{#if history.length > 0}
						<Button onclick={undoLastRow}>Undo</Button>
					{/if}
				</div>
			</div>
			{#if !gameOver}
				<p class="tile-hint">Click tiles to match Wordle's colours, then Submit.</p>
			{/if}
		</div>

		<div role="status">
			{#if message}
				<p class="message {messageKind}">
					<span aria-hidden="true">{MESSAGE_ICONS[messageKind]}</span>
					<span data-testid="message">{message}</span>
				</p>
			{/if}
		</div>
	</div>

	<ul class="key" aria-label="Legend">
		<li>
			<span class="cell" data-state="absent" aria-hidden="true">B</span> Black: not in the word
		</li>
		<li>
			<span class="cell" data-state="present" aria-hidden="true">Y</span> Yellow: wrong position
		</li>
		<li>
			<span class="cell" data-state="correct" aria-hidden="true">G</span> Green: right position
		</li>
	</ul>

	<details class="how">
		<summary>How it works</summary>
		<p>
			Play a guess in Wordle, click the tiles here to match its colours, then press Submit. The tool
			shows the next word. Open with RAISE and play every suggestion as shown. Some suggestions are
			probes, not answers, and Hard Mode may reject some.
		</p>
		<p>
			Keys 1, 2 and 3 set the focused tile to black, yellow or green; the arrow keys move between
			tiles. The details are in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/wordle.md">docs</a>.
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

	.board {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.guess {
		display: flex;
		gap: var(--sp-1);
	}

	.current {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2) var(--sp-4);
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

	.tile-hint {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.message {
		display: flex;
		gap: var(--sp-2);
		margin: var(--sp-3) 0 0;
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid;
		border-radius: var(--radius);
		font-weight: 600;
	}

	.message.error {
		background: var(--danger-bg);
		border-color: var(--danger);
		color: var(--danger-text);
	}

	.message.success {
		background: var(--success-bg);
		border-color: var(--success);
		color: var(--success-text);
	}

	.message.info {
		background: var(--info-bg);
		border-color: var(--info);
		color: var(--info-text);
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-4);
		margin: var(--sp-3) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.key li {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.key .cell {
		width: 28px;
		height: 28px;
		font-size: var(--text-sm);
	}

	.how p {
		margin: 0 0 var(--sp-2);
	}

	.how p:last-child {
		margin-bottom: 0;
	}
</style>
