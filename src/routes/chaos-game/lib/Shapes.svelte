<!--
	Shapes: one sideways-scrolling row of the preset patterns. A click loads the
	shape; with Challenge mode on it starts a scored try instead: the shape shows
	faintly in the plot and a match score says how close the game is.
-->
<script lang="ts">
	import { render, tone } from '#lib/chaos-game/engine.js';
	import type { Challenge } from '#lib/chaos-game/presets.js';
	import type { Rgb } from '#lib/chaos-game/types.js';
	import { Button, ScrollEdges } from '#lib/ui/index.js';

	let {
		challenges,
		active = $bindable(null),
		mode = $bindable(false),
		score,
		ink,
		onload,
		onanswer
	}: {
		challenges: readonly Challenge[];
		/** The id being attempted. */
		active?: string | null;
		/** Challenge mode: a click starts a scored try instead of loading the shape. */
		mode?: boolean;
		/** Match with the target, 0–1, or null before the first frame. */
		score: number | null;
		/** Thumbnail colour. */
		ink: Rgb | null;
		/** Loads a shape's setup. */
		onload: (c: Challenge) => void;
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

	function pick(c: Challenge) {
		if (mode) active = active === c.id ? null : c.id;
		else onload(c);
	}

	function setMode(e: Event) {
		mode = (e.currentTarget as HTMLInputElement).checked;
		if (!mode) active = null;
	}

	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<section class="shapes" aria-labelledby="shapes-heading">
	<div class="head">
		<h2 id="shapes-heading">Shapes</h2>
		<label class="check"
			><input type="checkbox" checked={mode} onchange={setMode} data-testid="challenge-mode" /> Challenge
			mode</label
		>
	</div>
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
			</div>
		</div>
	{:else if mode}
		<p class="hint">Pick a shape, then try to make it. It shows faintly behind your game.</p>
	{/if}
	<ScrollEdges>
		<ul class="strip" data-testid="challenges">
			{#each challenges as c (c.id)}
				<li>
					<button
						type="button"
						class="card"
						class:active={active === c.id}
						aria-pressed={mode ? active === c.id : undefined}
						data-id={c.id}
						onclick={() => pick(c)}
					>
						<canvas bind:this={canvases[c.id]} width={THUMB} height={THUMB} aria-hidden="true"
						></canvas>
						<span>{c.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	</ScrollEdges>
</section>

<style>
	.shapes {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
	}

	h2 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
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

	.strip {
		display: flex;
		gap: var(--sp-2);
		margin: 0;
		padding: 0 0 var(--sp-1);
		list-style: none;
	}

	.strip li {
		flex: 0 0 6.5rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		width: 100%;
		height: 100%;
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
		outline-offset: -2px;
	}

	canvas {
		width: 100%;
		aspect-ratio: 1;
	}
</style>
