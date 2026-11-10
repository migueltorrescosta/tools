<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browserStorage, clearSaved, createPersistGate } from '#lib/persist-gate.js';
	import { theme } from '#lib/theme.svelte.js';
	import { Walker, compile, fitView, optimalRatio, validate } from '#lib/chaos-game/engine.js';
	import { CHALLENGES, DEFAULT_SETUP, type Challenge } from '#lib/chaos-game/presets.js';
	import {
		GAMMA_RANGE,
		STATE_KEY,
		STORAGE_PREFIX,
		decodeShareParams,
		encodeShareParams,
		hasShareParams,
		type DecodedShare,
		type ShareState
	} from '#lib/chaos-game/state.js';
	import type { ColourMode, GamePoint, Rgb, Setup, View } from '#lib/chaos-game/types.js';
	import type { FromWorker, ToWorker } from '#lib/chaos-game/worker-engine.js';
	import {
		Alert,
		Button,
		Field,
		Fold,
		PageHeader,
		Panel,
		References,
		SegmentedControl,
		ShareActions
	} from '#lib/ui/index.js';
	import Plot, { type Frame, type StepView, type TargetImage } from './lib/Plot.svelte';
	import PointsPanel from './lib/PointsPanel.svelte';
	import Shapes from './lib/Shapes.svelte';
	import { REFERENCES } from './lib/references';

	/** Jumps a run makes before it stops. */
	const CAP = 10_000_000;
	/** Jumps of the quick preview while dragging a point. */
	const PREVIEW_CAP = 300_000;
	/** Largest canvas side in device pixels. */
	const MAX_SIDE = 1200;
	const STEP_MS = 400;

	// --- Setup ---
	let points = $state<GamePoint[]>(structuredClone(DEFAULT_SETUP.points));
	let ratio = $state(DEFAULT_SETUP.ratio);
	type RuleMode = 'any' | 'same' | 'neighbour' | 'custom';
	let ruleMode = $state<RuleMode>('any');
	let customRule = $state('1');
	let seed = $state(DEFAULT_SETUP.seed);
	let colour = $state<ColourMode>('density');
	let gamma = $state(2);
	let challenge = $state<string | null>(null);
	let challengeMode = $state(false);
	let editOpen = $state(false);
	let selected = $state<number | null>(null);

	function parseOffsets(text: string): number[] | null {
		const parts = text.split(/[\s,]+/).filter(Boolean);
		const nums = parts.map(Number);
		return nums.every(Number.isInteger) ? nums : null;
	}

	const customOffsets = $derived(parseOffsets(customRule));
	const forbid = $derived.by((): number[] => {
		const n = points.length;
		if (ruleMode === 'same') return [0];
		if (ruleMode === 'neighbour') return n > 1 ? [...new Set([1, n - 1])] : [];
		if (ruleMode === 'custom') return customOffsets ?? [];
		return [];
	});

	/** The rule mode a forbid list reads as, for links and presets. */
	function applyForbid(f: number[]) {
		const n = points.length;
		const set = new Set(f.map((k) => ((k % n) + n) % n));
		if (set.size === 0) ruleMode = 'any';
		else if (set.size === 1 && set.has(0)) ruleMode = 'same';
		else if (n > 2 && set.size === 2 && set.has(1) && set.has(n - 1)) ruleMode = 'neighbour';
		else {
			ruleMode = 'custom';
			customRule = f.join(', ');
		}
	}

	const setup = $derived<Setup>({ points, ratio, rule: { forbid }, seed });
	const ratioValid = $derived(ratio > 0 && ratio < 1);
	const customError = $derived(
		ruleMode === 'custom' && !customOffsets
			? 'List the forbidden steps as whole numbers, like "1" or "1, 3".'
			: ''
	);
	const error = $derived(customError || validate($state.snapshot(setup) as Setup));
	/** Errors no field shows: the ratio and the custom rule show theirs under the field. */
	const setupError = $derived(customError || !ratioValid ? '' : error);
	// A custom rule lives in the editing fold, so a link or preset with one opens it
	$effect(() => {
		if (ruleMode === 'custom') untrack(() => (editOpen = true));
	});

	function load(s: Setup) {
		points = structuredClone(s.points);
		ratio = s.ratio;
		seed = s.seed;
		applyForbid(s.rule.forbid);
		selected = null;
	}

	// --- Canvas size and colours ---
	let side = $state(600);
	function resize(cssWidth: number) {
		const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
		const next = Math.max(200, Math.min(MAX_SIDE, Math.round(cssWidth * dpr)));
		if (Math.abs(next - side) > 8) side = next;
	}

	let probe = $state<HTMLSpanElement>();
	let ink = $state<Rgb | null>(null);
	let palette = $state<Rgb[]>([]);
	let targetInk = $state<Rgb | null>(null);

	let swatch: CanvasRenderingContext2D | null = null;
	/** A token's colour as sRGB bytes; a canvas converts any CSS colour (oklch too). */
	function resolve(el: HTMLElement, token: string): Rgb {
		el.style.color = `var(${token})`;
		swatch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
		if (!swatch) return [0, 0, 0];
		swatch.clearRect(0, 0, 1, 1);
		swatch.fillStyle = getComputedStyle(el).color;
		swatch.fillRect(0, 0, 1, 1);
		const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}

	$effect(() => {
		void theme.current;
		if (!probe) return;
		const el = probe;
		// light-dark() resolves after the color-scheme change lands
		requestAnimationFrame(() => {
			ink = resolve(el, '--data-1');
			targetInk = resolve(el, '--text');
			palette = Array.from({ length: 12 }, (_, i) => resolve(el, `--data-${i + 1}`));
		});
	});

	// --- Worker ---
	let worker: Worker | null = null;
	let runId = 0;
	let targetId = 0;
	let frame = $state<(Frame & { view: View }) | null>(null);
	let target = $state<TargetImage | null>(null);
	let jumps = $state(0);
	let running = $state(false);
	let score = $state<number | null>(null);
	let runError = $state('');
	/** While dragging, the view stays put and runs are short previews. */
	let dragView = $state<View | null>(null);

	function post(msg: ToWorker) {
		worker?.postMessage(msg);
	}

	function onWorker(e: MessageEvent<FromWorker>) {
		const msg = e.data;
		if (msg.type === 'frame') {
			if (msg.id !== runId) return;
			frame = msg;
			jumps = msg.jumps;
			running = msg.running;
			score = msg.score;
			runError = '';
		} else if (msg.type === 'target') {
			if (msg.id === targetId) target = msg;
		} else if (msg.id === runId) {
			runError = msg.message;
			running = false;
			frame = null;
		}
	}

	function start() {
		if (!worker || !ink || error || stepping) return;
		runId++;
		running = true;
		post({
			type: 'run',
			id: runId,
			setup: $state.snapshot(setup) as Setup,
			width: side,
			height: side,
			view: dragView ? $state.snapshot(dragView) : null,
			ink: $state.snapshot(ink) as Rgb,
			palette: $state.snapshot(palette) as Rgb[],
			mode: colour,
			gamma,
			cap: dragView ? PREVIEW_CAP : CAP
		});
	}

	let hydrated = $state(false);
	let routerReady = false;

	// Any change to the game, the size or the colours starts a fresh run
	$effect(() => {
		void [$state.snapshot(setup), side, ink, palette, dragView, error, hydrated];
		untrack(start);
	});

	$effect(() => {
		const msg: ToWorker = { type: 'tone', mode: colour, gamma };
		untrack(() => post(msg));
	});

	$effect(() => {
		const c = CHALLENGES.find((x) => x.id === challenge) ?? null;
		void [side, targetInk, hydrated];
		untrack(() => {
			if (!worker || !targetInk) return;
			targetId++;
			target = null;
			score = null;
			post({
				type: 'target',
				id: targetId,
				setup: c ? structuredClone(c.setup) : null,
				width: side,
				height: side,
				ink: $state.snapshot(targetInk) as Rgb
			});
		});
	});

	/** Before the first frame, and when a run fails, fit the points themselves. */
	const pointsView = $derived.by((): View => {
		const xs = points.map((p) => p.x);
		const ys = points.map((p) => p.y);
		const box = xs.length
			? {
					minX: Math.min(...xs),
					maxX: Math.max(...xs),
					minY: Math.min(...ys),
					maxY: Math.max(...ys)
				}
			: { minX: -1, maxX: 1, minY: -1, maxY: 1 };
		const pad = Math.max(box.maxX - box.minX, box.maxY - box.minY, 1) * 0.1;
		return fitView(
			{ minX: box.minX - pad, maxX: box.maxX + pad, minY: box.minY - pad, maxY: box.maxY + pad },
			side,
			side
		);
	});
	const view = $derived(
		dragView ?? (frame && frame.width === side && !error ? frame.view : pointsView)
	);

	// --- Editing from the plot ---
	function addPoint(x: number, y: number) {
		if (points.length >= 32) return;
		points = [...points, { x, y }];
	}

	function movePoint(i: number, x: number, y: number, done: boolean) {
		if (!done && !dragView) dragView = $state.snapshot(view);
		points = points.map((p, j) => (j === i ? { ...p, x, y } : p));
		if (done) dragView = null;
	}

	function removePoint(i: number) {
		points = points.filter((_, j) => j !== i);
	}

	// --- Step through ---
	let stepping = $state(false);
	let playing = $state(false);
	let walker: Walker | null = null;
	let stepView = $state<StepView | null>(null);
	let stepCount = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	function startSteps() {
		if (error) return;
		post({ type: 'stop' });
		walker = new Walker(compile($state.snapshot(setup) as Setup), seed);
		stepView = { trail: [], from: null, to: null, at: [walker.x, walker.y] };
		stepCount = 0;
		stepping = true;
	}

	function nextStep() {
		if (!walker || !stepView) return;
		const from: [number, number] = [walker.x, walker.y];
		const to = walker.step();
		stepView = {
			trail: [...stepView.trail, from].slice(-80),
			from,
			to,
			at: [walker.x, walker.y]
		};
		stepCount++;
	}

	function togglePlay() {
		playing = !playing;
		clearInterval(timer);
		if (playing) timer = setInterval(nextStep, STEP_MS);
	}

	function endSteps() {
		clearInterval(timer);
		playing = false;
		stepping = false;
		stepView = null;
		walker = null;
		start();
	}

	// Editing the game ends a step-through
	$effect(() => {
		void $state.snapshot(setup);
		untrack(() => {
			if (stepping) endSteps();
		});
	});

	// --- Share and persistence ---
	const storage = browserStorage();
	const persist = createPersistGate(storage);
	const shareState = $derived<ShareState>({
		setup: $state.snapshot(setup) as Setup,
		colour,
		gamma,
		challenge
	});
	let shareUrl = $state('');
	const DEFAULT_PARAMS = encodeShareParams({
		setup: DEFAULT_SETUP,
		colour: 'density',
		gamma: 2,
		challenge: null
	}).toString();
	let touched = false;

	$effect(() => {
		const params = encodeShareParams(shareState).toString();
		if (!persist.isOpen || dragView) return;
		const url = untrack(() => new URL(page.url.href));
		url.search = params;
		shareUrl = url.toString();
		// A fresh or cleared page writes nothing until the game leaves its defaults
		if (params !== DEFAULT_PARAMS) touched = true;
		if (!touched) return;
		persist.write(STATE_KEY, params);
		if (routerReady) goto(url, { shallow: true, replace: true });
	});

	function apply(s: DecodedShare) {
		if (s.setup?.points) points = s.setup.points;
		if (s.setup?.ratio !== undefined) ratio = s.setup.ratio;
		if (s.setup?.seed !== undefined) seed = s.setup.seed;
		if (s.setup?.rule) applyForbid(s.setup.rule.forbid);
		if (s.colour) colour = s.colour;
		if (s.gamma !== undefined) gamma = s.gamma;
		if (s.challenge !== undefined)
			challenge = CHALLENGES.some((c) => c.id === s.challenge) ? s.challenge : null;
		if (challenge) challengeMode = true;
	}

	function clearAll() {
		if (storage) clearSaved(storage, STORAGE_PREFIX);
		window.location.replace(page.url.pathname);
	}

	function showAnswer(c: Challenge) {
		load(c.setup);
	}

	const canResume = $derived(!running && jumps > 0 && jumps < CAP);
	function pauseOrResume() {
		post({ type: running ? 'stop' : 'continue' });
	}

	onMount(() => {
		worker = new Worker(new URL('../../lib/chaos-game/chaos.worker.ts', import.meta.url), {
			type: 'module'
		});
		worker.onmessage = onWorker;
		const params = new URLSearchParams(page.url.search);
		const saved = storage?.getItem(STATE_KEY);
		if (hasShareParams(params)) apply(decodeShareParams(params));
		else if (saved) apply(decodeShareParams(new URLSearchParams(saved)));
		persist.open();
		hydrated = true;
		// A macrotask runs after SvelteKit starts the router
		const t = setTimeout(() => (routerReady = true));
		return () => clearTimeout(t);
	});

	onDestroy(() => {
		clearInterval(timer);
		worker?.terminate();
	});

	// --- Text ---
	function fmtJumps(n: number): string {
		if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
		if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`;
		return String(n);
	}

	const plotLabel = $derived(
		`Chaos game with ${points.length} points, jump ratio ${ratio}, after ${fmtJumps(jumps)} jumps.`
	);
	// Only when it differs from the ½ and ⅔ buttons (triangle and square are ½)
	const touching = $derived.by(() => {
		if (points.length < 3) return null;
		const r = optimalRatio(points.length);
		return Math.abs(r - 0.5) < 1e-9 || Math.abs(r - 2 / 3) < 1e-9 ? null : r;
	});
	const RULES = [
		{ value: 'any', label: 'Any point' },
		{ value: 'same', label: 'Never twice' },
		{ value: 'neighbour', label: 'No neighbour' }
	] as const;
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/chaos-game">
		{#snippet actions()}<ShareActions
				url={shareUrl}
				onClear={clearAll}
				description="the points, rule and colours"
			/>{/snippet}
	</PageHeader>

	<span class="sr-only" bind:this={probe} aria-hidden="true"></span>

	<div class="layout">
		<div class="plot-col">
			<Plot
				{points}
				bind:selected
				{view}
				width={side}
				height={side}
				frame={frame && frame.width === side && !error ? frame : null}
				target={challenge ? target : null}
				steps={stepView}
				label={plotLabel}
				onadd={addPoint}
				onmove={movePoint}
				onremove={removePoint}
				onresize={resize}
			/>
			<div class="run-row" data-testid="steps">
				{#if !stepping}
					<p class="progress" data-testid="progress" data-jumps={jumps}>
						{fmtJumps(jumps)} jumps{running ? '…' : ''}
					</p>
					<div class="links">
						{#if running || canResume}
							<Button variant="link" size="sm" onclick={pauseOrResume} data-testid="pause"
								>{running ? 'Pause' : 'Resume'}</Button
							>
						{/if}
						<Button
							variant="link"
							size="sm"
							onclick={startSteps}
							disabled={!!error}
							data-testid="step-start">Step through</Button
						>
					</div>
				{:else}
					<p class="progress" aria-live="polite" data-testid="step-text">
						{#if stepView?.to === null || stepView?.to === undefined}
							The orange dot is the start.
						{:else}
							Jump {stepCount}: towards point {stepView.to + 1}.
						{/if}
					</p>
					<div class="links">
						<Button
							variant="link"
							size="sm"
							onclick={nextStep}
							disabled={playing}
							data-testid="step-next">Next jump</Button
						>
						<Button variant="link" size="sm" onclick={togglePlay} aria-pressed={playing}
							>{playing ? 'Pause' : 'Play'}</Button
						>
						<Button variant="link" size="sm" onclick={endSteps} data-testid="step-end">Done</Button>
					</div>
				{/if}
			</div>
			{#if setupError || runError}<Alert tone="danger">{setupError || runError}</Alert>{/if}
			<Shapes
				challenges={CHALLENGES}
				bind:active={challenge}
				bind:mode={challengeMode}
				{score}
				ink={targetInk}
				onload={(c) => load(c.setup)}
				onanswer={showAnswer}
			/>
		</div>

		<div class="controls-col stack">
			<Panel title="Jumps">
				<div class="stack">
					<Field label="Jump ratio" error={ratioValid ? undefined : 'Use a ratio between 0 and 1.'}>
						{#snippet children(props)}
							<div class="ratio">
								<input
									type="range"
									min="0.01"
									max="0.99"
									step="0.01"
									bind:value={ratio}
									aria-label="Jump ratio slider"
								/>
								<input
									class="control"
									type="number"
									min="0.01"
									max="0.99"
									step="0.01"
									bind:value={ratio}
									{...props}
									data-testid="ratio"
								/>
							</div>
						{/snippet}
					</Field>
					<div class="cluster">
						<Button size="sm" onclick={() => (ratio = 0.5)} pressed={ratio === 0.5}>½</Button>
						<Button size="sm" onclick={() => (ratio = 2 / 3)} pressed={ratio === 2 / 3}>⅔</Button>
						{#if touching !== null}
							<Button
								size="sm"
								onclick={() => (ratio = touching)}
								pressed={ratio === touching}
								data-testid="touching">Copies touch ({touching.toFixed(3)})</Button
							>
						{/if}
					</div>
					<SegmentedControl legend="Next point" options={RULES} bind:value={ruleMode} />
				</div>
			</Panel>

			<PointsPanel bind:points bind:selected bind:open={editOpen} {ratio}>
				{#snippet extra()}
					<div class="custom">
						<label class="check"
							><input
								type="checkbox"
								checked={ruleMode === 'custom'}
								onchange={(e) => (ruleMode = e.currentTarget.checked ? 'custom' : 'any')}
								data-testid="custom-toggle"
							/> Custom next-point rule</label
						>
						{#if ruleMode === 'custom'}
							<Field
								label="Forbidden steps"
								hint="Steps on from the last point's number: 0 is the same point, 1 the next one."
								error={customError || undefined}
							>
								{#snippet children(props)}
									<input
										class="control"
										bind:value={customRule}
										{...props}
										data-testid="custom-rule"
									/>
								{/snippet}
							</Field>
						{/if}
					</div>
				{/snippet}
			</PointsPanel>

			<Panel title="Display">
				<Fold label="Colour and contrast" data-testid="colour-fold">
					<SegmentedControl
						legend="Colour"
						options={[
							{ value: 'density', label: 'Density' },
							{ value: 'point', label: 'By point' }
						]}
						bind:value={colour}
					/>
					<Field label="Contrast">
						{#snippet children(props)}
							<input
								type="range"
								min={GAMMA_RANGE.min}
								max={GAMMA_RANGE.max}
								step="0.1"
								bind:value={gamma}
								{...props}
							/>
						{/snippet}
					</Field>
				</Fold>
			</Panel>
		</div>
	</div>

	<details class="how" data-testid="how">
		<summary>How it works</summary>
		<p>
			Pick some points and jump part of the way to a random one, over and over. Fractals appear.
			Start anywhere. Pick one of the points at random and jump a fraction of the way towards it,
			the jump ratio. Repeat millions of times and mark where you land. With three points and a
			ratio of one half you get the Sierpinski triangle.
		</p>
		<p>
			Rules about which point can come next, weights and per-point turns or matrices make many more
			shapes. Contrast brings out faint regions. Step through shows the first jumps one at a time.
		</p>
		<p>
			A click on a shape loads it. With Challenge mode on, a click starts a try instead: the shape
			shows faintly behind your game and the match ignores position and size. The first ten shapes
			are from the original blog post.
		</p>
		<p>
			From the blog post
			<a href="https://blog.mptc.uk/posts/Strange-Attractors">Strange Attractors</a>. The details
			are in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/chaos-game.md">docs</a>.
		</p>
	</details>

	<References references={REFERENCES} />
</div>

<style>
	.layout {
		display: grid;
		gap: var(--sp-3);
		margin-bottom: var(--sp-3);
	}

	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			align-items: start;
		}

		.plot-col {
			position: sticky;
			top: calc(var(--topbar-h) + var(--sp-3));
		}
	}

	.plot-col {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.controls-col {
		min-width: 0;
	}

	.progress {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.ratio {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.ratio input[type='range'] {
		flex: 1;
		min-width: 0;
	}

	.ratio .control {
		width: 5.5rem;
	}

	/* One quiet line under the plot: the count, then link-style actions */
	.run-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
		min-height: var(--control-h-sm);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
	}

	.custom {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
		font-size: var(--text-sm);
	}

	.how p {
		margin: var(--sp-1) 0;
	}
</style>
