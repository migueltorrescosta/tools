<script lang="ts">
	import { onMount } from 'svelte';
	import solutionTree from '$lib/wordle-solution';
	import {
		cycleTile as cycleResultTile,
		getTileColor,
		newAttempt,
		OPENER,
		setTile,
		step,
		undoLast,
		type Attempt,
		type SolutionTree,
		type TileColor
	} from '$lib/wordle';

	let currentSolutionTree = $state<SolutionTree>(solutionTree);
	let history = $state<Attempt[]>([]);
	// visited[i] is the tree that was current when history[i] was submitted.
	let visited = $state<SolutionTree[]>([]);
	let nextAttempt = $state<Attempt>(newAttempt(OPENER));
	let errorMessage = $state('');
	/** Set once the page is interactive, so e2e tests can wait for hydration. */
	let hydrated = $state(false);
	onMount(() => (hydrated = true));
	let gameOver = $state(false);

	function handleResultChange(e: Event) {
		const target = e.target as HTMLInputElement;
		nextAttempt = { ...nextAttempt, result: target.value.toUpperCase() };
	}

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
		const inputs = document.querySelectorAll('.tile-input');
		(inputs[index] as HTMLButtonElement)?.focus();
	}

	function handleResultSubmission() {
		const result = nextAttempt.result.toUpperCase();
		const outcome = step(currentSolutionTree, result);

		if (outcome.error) {
			errorMessage = outcome.error;
			gameOver = outcome.done;
			return;
		}

		visited = [...visited, currentSolutionTree];
		history = [...history, { ...nextAttempt, result }];
		currentSolutionTree = outcome.next;
		gameOver = outcome.done;

		if (outcome.won) {
			errorMessage = 'CONGRATULATIONS';
			nextAttempt = newAttempt('🎉🎉🎉');
			return;
		}

		nextAttempt = newAttempt(outcome.word.toUpperCase());
		errorMessage = '';
	}

	function undoLastRow() {
		const undone = undoLast(visited, history);
		if (!undone) return;
		currentSolutionTree = undone.tree;
		visited = undone.visited;
		history = undone.history;
		nextAttempt = undone.attempt;
		errorMessage = '';
		gameOver = false;
	}

	function restartGame() {
		currentSolutionTree = solutionTree;
		history = [];
		visited = [];
		nextAttempt = newAttempt(OPENER);
		errorMessage = '';
		gameOver = false;
	}
</script>

<svelte:head>
	<title>Wordle Solver</title>
</svelte:head>

<div class="container">
	<header>
		<h1>WORDLE SOLVER</h1>
		<p class="subtitle">Click tiles to set result colors (Black/Yellow/Green)</p>
	</header>

	<div class="wordle-panel" data-hydrated={hydrated || undefined}>
		<div class="wordle-header">
			<span class="dot red"></span>
			<span class="dot yellow"></span>
			<span class="dot green"></span>
			<span class="panel-title">GAME</span>
		</div>

		<div class="wordle-content">
			<table class="wordle-table">
				<tbody>
					{#each history as attempt (attempt.word)}
						<tr>
							<td class="word-cell">
								<div class="result-tiles">
									{#each Array(5) as _, i}
										<span
											class="tile"
											class:black={attempt.result[i] === 'B'}
											class:yellow={attempt.result[i] === 'Y'}
											class:green={attempt.result[i] === 'G'}>{attempt.word[i]}</span
										>
									{/each}
								</div>
							</td>
						</tr>
					{/each}
					<tr>
						<td class="word-cell current">
							<div class="input-tiles">
								{#each Array(5) as _, i}
									<button
										class="tile-input"
										class:black={getTileColor(nextAttempt.result, i) === 'B'}
										class:yellow={getTileColor(nextAttempt.result, i) === 'Y'}
										class:green={getTileColor(nextAttempt.result, i) === 'G'}
										onclick={() => cycleTile(i)}
										onkeydown={(e) => handleTileKeydown(e, i)}
										title="Click to cycle: Black (not in word) → Yellow → Green. Keys: 1/B=Black, 2/Y=Yellow, 3/G=Green, Arrow keys to navigate"
										>{nextAttempt.word[i]}</button
									>
								{/each}
							</div>
						</td>
						<td class="result-cell">
							{#if gameOver}
								<button class="restart-btn" onclick={restartGame}> Start New Game </button>
							{:else}
								<button class="submit-btn" onclick={handleResultSubmission}> Submit </button>
							{/if}
							{#if history.length > 0}
								<button class="submit-btn undo-btn" onclick={undoLastRow}> Undo </button>
							{/if}
						</td>
					</tr>
				</tbody>
			</table>

			{#if errorMessage}
				<div class="error-message" class:success={errorMessage === 'CONGRATULATIONS'}>
					{errorMessage}
				</div>
			{/if}
		</div>
	</div>

	<div class="legend">
		<div class="legend-item">
			<span class="legend-letter black">B</span>
			<span class="legend-desc">Black - Letter not in word</span>
		</div>
		<div class="legend-item">
			<span class="legend-letter yellow">Y</span>
			<span class="legend-desc">Yellow - Letter in wrong position</span>
		</div>
		<div class="legend-item">
			<span class="legend-letter green">G</span>
			<span class="legend-desc">Green - Letter in correct position</span>
		</div>
	</div>

	<div class="wordle-explanation">
		After entering your guess in the actual Wordle game, look at the colored tiles to see which
		letters are in the correct position (green), which letters are in the word but the wrong
		position (yellow), and which letters are not in the word at all (black). Click on the colored
		tiles in this tool to match what you saw, then click Submit. The tool will suggest the next best
		word to try based on all your previous results, helping you solve the puzzle in fewer guesses by
		narrowing down the possible answers.
	</div>
</div>
