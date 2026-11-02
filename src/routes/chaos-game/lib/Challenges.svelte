<!--
	Challenges: pick a pattern to copy; its shape shows faintly in the plot and a
	match score says how close the game is. The answer loads its setup.
-->
<script lang="ts">
	import { render, tone } from '$lib/chaos-game/engine';
	import type { Challenge } from '$lib/chaos-game/presets';
	import type { Rgb } from '$lib/chaos-game/types';
	import { Button, Panel } from '$lib/ui';

	let {
		challenges,
		active = $bindable(null),
		score,
		ink,
		onanswer
	}: {
		challenges: readonly Challenge[];
		/** The id being attempted. */
		active?: string | null;
		/** Match with the target, 0–1, or null before the first frame. */
		score: number | null;
		/** Thumbnail colour. */
		ink: Rgb | null;
		onanswer: (c: Challenge) => void;
	} = $props();

	/** At this match the shapes are the same to the eye. */
	const SOLVED = 0.9;
	const THUMB = 160;

	let hintShown = $state(false);
	const current = $derived(challenges.find((c) => c.id === active) ?? null);
	$effect(() => {
		void active;
		hintShown = false;
	});

	const canvases: Record<string, HTMLCanvasElement> = $state({});

	// Thumbnails render one per idle slot, so the page stays responsive
	$effect(() => {
		if (!ink) return;
		const colour = ink;
		const queue = [...challenges];
		let handle = 0;
		const idle = (fn: () => void) =>
			'requestIdleCallback' in window ? requestIdleCallback(fn) : setTimeout(fn, 16);
		const cancel = (h: number) =>
			'cancelIdleCallback' in window ? cancelIdleCallback(h) : clearTimeout(h);
		const next = () => {
			const c = queue.shift();
			if (!c) return;
			const canvas = canvases[c.id];
			const h = render(c.setup, THUMB, THUMB, 150_000);
			const ctx = canvas?.getContext('2d');
			if (h && ctx) {
				const px = tone(h, { ink: colour, mode: 'density', gamma: 2 });
				ctx.putImageData(new ImageData(new Uint8ClampedArray(px), THUMB, THUMB), 0, 0);
			}
			handle = idle(next) as number;
		};
		handle = idle(next) as number;
		return () => cancel(handle);
	});

	function toggle(id: string) {
		active = active === id ? null : id;
	}

	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<Panel title="Challenges">
	<div class="stack">
		<p class="hint">
			Pick a pattern and try to make it. It shows faintly behind your game, and the match ignores
			position and size. The first ten are from the original blog post.
		</p>
		{#if current}
			<div class="status" data-testid="challenge-status">
				<p>
					<strong>{current.name}</strong>:
					<span data-testid="score" data-score={score ?? ''}
						>{score === null ? 'matching…' : `${pct(score)} match`}</span
					>{#if score !== null && score >= SOLVED}
						<span class="solved" data-testid="solved"> Solved!</span>{/if}
				</p>
				{#if hintShown}<p class="hint" data-testid="hint">{current.hint}</p>{/if}
				<div class="cluster">
					<Button size="sm" onclick={() => (hintShown = true)} disabled={hintShown}>Hint</Button>
					<Button size="sm" onclick={() => onanswer(current)} data-testid="show-answer"
						>Show answer</Button
					>
					<Button size="sm" variant="ghost" onclick={() => (active = null)}>Stop</Button>
				</div>
			</div>
		{/if}
		<ul class="grid" data-testid="challenges">
			{#each challenges as c (c.id)}
				<li>
					<button
						type="button"
						class="card"
						class:active={active === c.id}
						aria-pressed={active === c.id}
						data-id={c.id}
						onclick={() => toggle(c.id)}
					>
						<canvas bind:this={canvases[c.id]} width={THUMB} height={THUMB} aria-hidden="true"
						></canvas>
						<span>{c.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</Panel>

<style>
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.status p {
		margin: 0 0 var(--sp-1);
	}

	.solved {
		color: var(--success-text);
		font-weight: 600;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		width: 100%;
		padding: var(--sp-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--sunken);
		color: var(--text);
		font-size: var(--text-xs);
		cursor: pointer;
	}

	.card:hover {
		background: var(--surface-2);
	}

	.card.active {
		border-color: var(--accent);
		background: var(--accent-bg);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	canvas {
		width: 100%;
		aspect-ratio: 1;
	}
</style>
