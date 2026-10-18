<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		Character,
		Charger,
		SimulationResults,
		SimulationJob,
		WorkerMessage
	} from '$lib/warhammer-simulator/types';
	import {
		MAX_SIMULATIONS,
		MIN_SIMULATIONS,
		parseSeed,
		parseSimCount
	} from '$lib/warhammer-simulator/simulation';
	import { Alert, Button, Field, PageHeader, Panel } from '$lib/ui';
	import CharacterBuilder from './lib/CharacterBuilder.svelte';
	import BarChart from './lib/BarChart.svelte';
	import WinnerBar from './lib/WinnerBar.svelte';
	import { GIFT_POINT_LIMIT, totalGiftPoints } from './lib/traits';

	function createDefaultChar(label: string): Character {
		return {
			name: `Character ${label}`,
			faction: 'empire',
			ws: 4,
			s: 4,
			t: 4,
			a: 3,
			i: 4,
			wounds: 3,
			wardSave: 0,
			weapon: 'hand-weapon',
			armour: 'none',
			shield: 'none',
			traits: [],
			specialRules: []
		};
	}

	let charA = $state<Character>(createDefaultChar('A'));
	let charB = $state<Character>(createDefaultChar('B'));

	// ── Simulation state ──
	let simCount = $state<number | null>(MAX_SIMULATIONS);
	let seedInput = $state('');
	let charger = $state<Charger>('none');
	let isRunning = $state(false);
	let progress = $state(0);
	let elapsedMs = $state(0);
	let results = $state<SimulationResults | null>(null);
	let errorMessage = $state('');
	let worker: Worker | null = null;
	let hydrated = $state(false);

	// Inputs of the run that produced `results`, so labels stay those of the run
	// and later edits are flagged instead of silently mislabelling old results.
	function inputsKey(): string {
		return JSON.stringify({ charA, charB, charger });
	}
	let resultsKey = $state('');
	let resultNames = $state({ a: '', b: '' });
	let resultsStale = $derived(results !== null && inputsKey() !== resultsKey);

	function startSimulation() {
		if (isRunning) return;

		for (const [label, char] of [
			['A', charA],
			['B', charB]
		] as const) {
			const points = totalGiftPoints(char.traits);
			if (points > GIFT_POINT_LIMIT) {
				errorMessage = `Character ${label} exceeds ${GIFT_POINT_LIMIT} gift points (${points})`;
				return;
			}
		}
		const count = parseSimCount(simCount);
		if (!count.ok) {
			errorMessage = count.error;
			return;
		}
		const seed = parseSeed(seedInput);
		if (!seed.ok) {
			errorMessage = seed.error;
			return;
		}
		errorMessage = '';
		const runKey = inputsKey();
		const runNames = { a: charA.name, b: charB.name };

		isRunning = true;
		progress = 0;
		elapsedMs = 0;
		results = null;

		worker = new Worker(new URL('$lib/warhammer-simulator/simulation.worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
			const data = e.data;
			if (data.type === 'progress') {
				progress = data.progress;
				elapsedMs = data.elapsedMs;
			} else if (data.type === 'complete') {
				results = data.results;
				resultsKey = runKey;
				resultNames = runNames;
				isRunning = false;
				worker?.terminate();
				worker = null;
			}
		};

		worker.onerror = (err) => {
			errorMessage = `Worker error: ${err.message}`;
			isRunning = false;
			worker?.terminate();
			worker = null;
		};

		const job: SimulationJob = {
			charA: JSON.parse(JSON.stringify(charA)),
			charB: JSON.parse(JSON.stringify(charB)),
			totalSimulations: count.value,
			seed: seed.value,
			charger
		};

		worker.postMessage(job);
	}

	// ── Chart data and one-sentence summaries ──
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

	/** Index of the largest value (the first one on ties). */
	const argmax = (values: number[]) =>
		values.reduce((best, v, i) => (v > values[best] ? i : best), 0);

	const winnerSummary = $derived(
		results
			? `${resultNames.a} wins ${pct(results.winRateA)} of duels, ${resultNames.b} ${pct(results.winRateB)}; ${pct(results.mutualKillRate + results.drawRate)} end in a mutual kill or draw.`
			: ''
	);

	const rounds = $derived.by(() => {
		if (!results) return null;
		const r = results;
		const last = r.roundDistribution.findLastIndex((c) => c > 0);
		const values = r.roundDistribution
			.slice(0, Math.max(last + 1, 1))
			.map((c) => (c / r.totalRuns) * 100);
		const mode = argmax(values);
		return {
			categories: values.map((_, i) => String(i + 1)),
			values,
			summary: `Most duels end in round ${mode + 1} (${values[mode].toFixed(1)}%); the average is ${r.avgRounds.toFixed(1)} rounds.`
		};
	});

	const damage = $derived.by(() => {
		if (!results) return null;
		const r = results;
		// Pre-binned by the aggregator: index = wounds dealt.
		const bins = Math.max(r.damageHistogramA.length, r.damageHistogramB.length, 2);
		const toPct = (h: number[]) =>
			Array.from({ length: bins }, (_, d) => ((h[d] ?? 0) / r.totalRuns) * 100);
		const a = toPct(r.damageHistogramA);
		const b = toPct(r.damageHistogramB);
		const ma = argmax(a);
		const mb = argmax(b);
		return {
			categories: a.map((_, d) => String(d)),
			series: [
				{ name: resultNames.a, color: 'var(--data-1)', values: a },
				{ name: resultNames.b, color: 'var(--data-2)', values: b }
			],
			summary: `${resultNames.a} most often deals ${ma} wounds (${a[ma].toFixed(1)}%), ${resultNames.b} ${mb} wounds (${b[mb].toFixed(1)}%); averages ${r.avgDamageA.toFixed(1)} and ${r.avgDamageB.toFixed(1)}.`
		};
	});

	onMount(() => {
		// A macrotask runs after SvelteKit starts the router; e2e tests wait for hydrated
		const timer = setTimeout(() => (hydrated = true));
		return () => {
			clearTimeout(timer);
			worker?.terminate();
		};
	});
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/warhammer-simulator"
		>Monte Carlo duels for Warhammer: The Old World, 100 000 simulations by default.</PageHeader
	>

	<div class="wh-builders">
		<CharacterBuilder side="A" bind:char={charA} opponent={charB} />
		<CharacterBuilder side="B" bind:char={charB} opponent={charA} />
	</div>

	<section class="wh-bar" aria-labelledby="wh-sim-heading">
		<h2 id="wh-sim-heading" class="sr-only">Simulation</h2>
		<div class="wh-bar-row">
			<Field label="Simulations" id="sim-count">
				{#snippet children(props)}
					<input
						class="control wh-num"
						type="number"
						min={MIN_SIMULATIONS}
						max={MAX_SIMULATIONS}
						step="1"
						{...props}
						bind:value={simCount}
					/>
				{/snippet}
			</Field>
			<Field label="Seed (optional)" id="sim-seed">
				{#snippet children(props)}
					<input
						class="control wh-num"
						type="text"
						inputmode="numeric"
						placeholder="random"
						{...props}
						bind:value={seedInput}
					/>
				{/snippet}
			</Field>
			<Field label="Charger" id="charger">
				{#snippet children(props)}
					<select class="control" {...props} bind:value={charger}>
						<option value="none">No charge</option>
						<option value="A">{charA.name}</option>
						<option value="B">{charB.name}</option>
					</select>
				{/snippet}
			</Field>
			<Button variant="primary" onclick={startSimulation} disabled={isRunning}
				>{isRunning ? 'Running…' : 'Run simulation'}</Button
			>
			{#if isRunning || results}
				<div class="wh-progress">
					<progress max="1" value={isRunning ? progress : 1} aria-label="Simulation progress"
					></progress>
					<span class="wh-progress-text"
						>{isRunning ? `${(progress * 100).toFixed(0)}%` : '100%'}
						({(elapsedMs / 1000).toFixed(1)} s)</span
					>
				</div>
			{/if}
		</div>
		<p class="wh-hint">
			The charger strikes first in round 1 regardless of Initiative (a great weapon still Strikes
			Last); later rounds use Initiative order. Faction matters only for Hatred.
		</p>
		<p class="wh-meta" aria-live="polite">
			{#if results}
				<span class="sr-only">Simulation finished. {winnerSummary}</span>
				Seed <span data-testid="seed-used">{results.seedUsed}</span> · {results.totalRuns.toLocaleString(
					'en-US'
				)} runs
			{/if}
		</p>
		{#if errorMessage}
			<Alert tone="danger">{errorMessage}</Alert>
		{/if}
		{#if resultsStale}
			<div data-testid="stale-warning">
				<Alert tone="warning"
					>Inputs changed since this run: the results below are for the previous setup. Run again to
					update.</Alert
				>
			</div>
		{/if}
	</section>

	{#if results && rounds && damage}
		<div class="wh-results" data-testid="results">
			<Panel title="Winner">
				<WinnerBar {results} nameA={resultNames.a} nameB={resultNames.b} summary={winnerSummary} />
			</Panel>
			<Panel title="Round distribution">
				<BarChart
					label="Share of duels ending in each round"
					categories={rounds.categories}
					series={[{ name: 'Duels', color: 'var(--data-1)', values: rounds.values }]}
					xLabel="Round"
					summary={rounds.summary}
				/>
			</Panel>
			<Panel title="Damage distribution">
				<BarChart
					label="Wounds dealt per duel by each character"
					categories={damage.categories}
					series={damage.series}
					xLabel="Wounds dealt"
					summary={damage.summary}
				/>
			</Panel>
		</div>
	{/if}
</div>

<style>
	.wh-builders {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
	}
	.wh-bar {
		margin-top: var(--sp-3);
		padding: var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.wh-bar-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-2) var(--sp-3);
	}
	.wh-bar-row > :global(.ui-field) {
		width: 9rem;
	}
	.wh-bar-row > :global(.ui-field:nth-child(3)) {
		width: 12rem;
	}
	.wh-num {
		font-family: var(--font-mono);
	}
	.wh-progress {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex: 1 1 12rem;
		min-height: var(--control-h);
	}
	progress {
		flex: 1;
		height: 8px;
		accent-color: var(--accent);
	}
	.wh-progress-text,
	.wh-meta {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.wh-hint {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.wh-meta {
		margin: var(--sp-1) 0 0;
		white-space: normal;
	}
	.wh-bar :global(.ui-alert) {
		margin-top: var(--sp-2);
	}
	.wh-results {
		display: grid;
		gap: var(--sp-3);
		margin-top: var(--sp-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
	}
	@media (min-width: 1000px) {
		.wh-results {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
