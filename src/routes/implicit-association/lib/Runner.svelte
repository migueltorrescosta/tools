<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { Button } from '#lib/ui/index.js';
	import { PRACTICE } from '#lib/implicit-association/presets.js';
	import { plan } from '#lib/implicit-association/sequence.js';
	import type {
		Category,
		Comparison,
		InputKind,
		Response,
		Run,
		Side,
		Stimulus,
		Trial
	} from '#lib/implicit-association/types.js';

	let {
		comparison,
		onfinish,
		oncancel
	}: {
		comparison: Comparison;
		onfinish: (run: Run) => void;
		oncancel: () => void;
	} = $props();

	const sizes = (c: { targets: Category[]; attributes: Category[] }) => ({
		target: [c.targets[0].items.length, c.targets[1].items.length] as [number, number],
		attribute: [c.attributes[0].items.length, c.attributes[1].items.length] as [number, number]
	});
	// The comparison is fixed for the life of a run; the page remounts the runner for a new one.
	// svelte-ignore state_referenced_locally
	const p = plan(sizes(comparison), sizes(PRACTICE));
	const blocks = [p.practice, ...p.blocks];
	const ITI = 250;

	let blockIndex = $state(0);
	let trialIndex = $state(0);
	/** 'ready': the block's key reminder, waiting for Space or a tap; 'trial': a stimulus is up. */
	let phase: 'loading' | 'ready' | 'trial' | 'gap' = $state('loading');
	let wrong = $state(false);
	let onset = 0;
	let shownCount = 0;
	let root: HTMLDivElement | undefined = $state();
	let hadError = false;
	const responses: Response[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;

	const isPractice = $derived(blockIndex === 0);
	const cats = $derived(isPractice ? PRACTICE : comparison);
	// Test blocks 1 and 3 (blockIndex 1 and 3) pair the first focal target with the I key.
	const focalTarget = $derived(
		isPractice ? 0 : blockIndex % 2 === 1 ? p.firstFocal : 1 - p.firstFocal
	);
	const trial: Trial | undefined = $derived(blocks[blockIndex]?.[trialIndex]);
	const stimulus: Stimulus | undefined = $derived(
		trial &&
			(trial.group === 'target' ? cats.targets : cats.attributes)[trial.category].items[trial.item]
	);
	const rightLabel = $derived(`${cats.targets[focalTarget].label} or ${cats.attributes[0].label}`);
	const stepLabel = $derived(isPractice ? 'Practice' : `Round ${blockIndex} of 4`);

	/** Load every image first, so no trial waits on the network. */
	onMount(async () => {
		const srcs = [...comparison.targets, ...comparison.attributes].flatMap((c) =>
			c.items.flatMap((i) => (i.kind === 'image' ? [i.src] : []))
		);
		await Promise.all(
			srcs.map((src) => {
				const img = new Image();
				img.src = src;
				return img.decode().catch(() => undefined);
			})
		);
		phase = 'ready';
		root?.scrollIntoView({ block: 'center' });
	});
	onDestroy(() => clearTimeout(timer));

	async function show() {
		phase = 'trial';
		wrong = false;
		hadError = false;
		await tick();
		// Onset is the frame the stimulus is painted in; the DOM time stands in until that frame
		// runs, so a press is never lost. `shown` drops a frame that arrives after the answer.
		onset = performance.now();
		const shown = ++shownCount;
		requestAnimationFrame(() => {
			if (shown === shownCount && phase === 'trial') onset = performance.now();
		});
	}

	function begin() {
		if (phase !== 'ready') return;
		trialIndex = 0;
		show();
	}

	function respond(side: Side, at: number, input: InputKind) {
		if (phase !== 'trial' || !trial || onset === 0) return;
		if (side !== trial.correct) {
			wrong = true;
			hadError = true;
			return;
		}
		responses.push({ ...trial, rt: at - onset, error: hadError, input });
		onset = 0;
		shownCount += 1;
		phase = 'gap';
		timer = setTimeout(next, ITI);
	}

	function next() {
		if (trialIndex + 1 < blocks[blockIndex].length) {
			trialIndex += 1;
			show();
		} else if (blockIndex + 1 < blocks.length) {
			blockIndex += 1;
			trialIndex = 0;
			phase = 'ready';
		} else finish();
	}

	function finish() {
		const scored = responses.filter((r) => r.block >= 0);
		const touches = scored.filter((r) => r.input === 'touch').length;
		onfinish({
			id: crypto.randomUUID(),
			comparisonId: comparison.id,
			labels: {
				targets: [comparison.targets[0].label, comparison.targets[1].label],
				attributes: [comparison.attributes[0].label, comparison.attributes[1].label]
			},
			date: new Date().toISOString(),
			input: touches * 2 > scored.length ? 'touch' : 'keyboard',
			firstFocal: p.firstFocal,
			responses: scored
		});
	}

	function onKey(e: KeyboardEvent) {
		if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
		const key = e.key.toLowerCase();
		if (key === 'escape') return oncancel();
		if (key === ' ') {
			// Space starts a block and must never scroll the page mid-run.
			e.preventDefault();
			return begin();
		}
		if (key === 'e' || key === 'i') {
			e.preventDefault();
			respond(key === 'e' ? 'left' : 'right', e.timeStamp, 'keyboard');
		}
	}

	function onTap(side: Side, e: PointerEvent) {
		e.preventDefault();
		if (phase === 'ready') return begin();
		respond(side, e.timeStamp, 'touch');
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="runner" bind:this={root} data-testid="runner" data-phase={phase}>
	<div class="keys" aria-hidden={phase === 'ready'}>
		<p class="key left"><kbd>E</kbd> Anything else</p>
		<p class="key right" data-testid="right-label">{rightLabel} <kbd>I</kbd></p>
	</div>

	<div class="stage" aria-live="off">
		{#if phase === 'loading'}
			<p class="muted">Loading…</p>
		{:else if phase === 'ready'}
			<div class="ready">
				<p class="step">{stepLabel}</p>
				<p>Press <kbd>I</kbd> for <strong>{rightLabel}</strong>.</p>
				<p>Press <kbd>E</kbd> for anything else.</p>
				<p class="muted">Go fast. A red ✕ means press the other key.</p>
				<Button variant="primary" onclick={begin}>Start {isPractice ? 'practice' : 'round'}</Button>
				<p class="muted hint-keys">or press Space</p>
			</div>
		{:else if phase === 'trial' && stimulus}
			{#if stimulus.kind === 'word'}
				<p class="word" data-testid="stimulus" data-correct={trial?.correct}>{stimulus.text}</p>
			{:else}
				<img
					class="face"
					src={stimulus.src}
					alt={stimulus.alt}
					data-testid="stimulus"
					data-correct={trial?.correct}
				/>
			{/if}
			{#if wrong}<p class="wrong" aria-label="Wrong key">✕</p>{/if}
		{/if}
	</div>

	{#if phase === 'trial' || phase === 'gap'}
		<div class="taps">
			<button type="button" class="tap" onpointerdown={(e) => onTap('left', e)}>E</button>
			<button type="button" class="tap" onpointerdown={(e) => onTap('right', e)}>I</button>
		</div>
	{/if}
	<p class="progress muted">
		{stepLabel} · <Button variant="link" tone="muted" onclick={oncancel}>Stop</Button>
	</p>
</div>

<style>
	.runner {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-height: 420px;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}
	.keys {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-3);
		font-weight: 600;
	}
	.key {
		max-width: 48%;
	}
	.key.right {
		text-align: right;
	}
	kbd {
		display: inline-block;
		min-width: 1.6em;
		padding: 0 var(--sp-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		text-align: center;
	}
	.stage {
		flex: 1;
		display: grid;
		place-items: center;
		position: relative;
		min-height: 260px;
		text-align: center;
	}
	.ready {
		display: grid;
		gap: var(--sp-2);
		justify-items: center;
	}
	.step {
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.word {
		font-size: 2rem;
		font-weight: 600;
	}
	.face {
		width: 200px;
		height: 200px;
		border-radius: var(--radius);
	}
	.wrong {
		position: absolute;
		bottom: 0;
		color: var(--danger-text);
		font-size: 3rem;
		line-height: 1;
	}
	.muted {
		color: var(--text-muted);
	}
	.taps {
		display: none;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	/* Tap zones only where touch is the main input; desktop uses the E and I keys. */
	@media (pointer: coarse) {
		.taps {
			display: grid;
		}
		.hint-keys {
			display: none;
		}
	}
	.tap {
		height: 120px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--text-xl);
		font-family: var(--font-mono);
	}
	.progress {
		font-size: var(--text-sm);
	}
</style>
