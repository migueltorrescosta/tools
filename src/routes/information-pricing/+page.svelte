<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { createAnalyser, type Analyser } from '$lib/information-pricing/analyser';
	import type { Analysis } from '$lib/information-pricing/analysis';
	import { scenariosCsv } from '$lib/information-pricing/csv';
	import { validateParams } from '$lib/information-pricing/distributions';
	import { compileModel, decisionLabels, renameSymbol } from '$lib/information-pricing/model';
	import {
		DEFAULT_PRESET,
		PRESETS,
		matchPreset,
		presetModel,
		type PresetId
	} from '$lib/information-pricing/presets';
	import {
		HASH_PARAM,
		STORAGE_PREFIX,
		decodeModel,
		encodeModel,
		loadSaved,
		saveModel
	} from '$lib/information-pricing/state';
	import { MAX_SAMPLES, type Model } from '$lib/information-pricing/types';
	import {
		createSimulationEngine,
		runSpec,
		type EngineEvent,
		type SimulationEngine
	} from '$lib/information-pricing/worker-engine';
	import { browserStorage, clearSaved, createPersistGate } from '$lib/persist-gate';
	import { Alert, Button, Field, PageHeader, Panel, ShareActions } from '$lib/ui';
	import { defaultWorkerCount } from '$lib/worker-pool';
	import ConstantsEditor from './lib/ConstantsEditor.svelte';
	import DecisionsEditor from './lib/DecisionsEditor.svelte';
	import {
		DEFAULT_TREE,
		allFinite,
		describeLocation,
		rowIds,
		samplesProblem,
		seedProblem,
		treeOptions,
		type RowIds,
		type TreeSettings
	} from './lib/editor';
	import HowItWorks from './lib/HowItWorks.svelte';
	import InputsEditor from './lib/InputsEditor.svelte';
	import IntermediatesEditor from './lib/IntermediatesEditor.svelte';
	import NumberInput from './lib/NumberInput.svelte';
	import Results from './lib/Results.svelte';

	// --- Model ---
	const initial = presetModel(DEFAULT_PRESET);
	let model = $state<Model>(initial);
	let ids = $state<RowIds>(rowIds(initial));

	/** The model as JSON: the key for staleness, preset matching and saving. */
	const modelKey = $derived(JSON.stringify(model));
	const preset = $derived(matchPreset(JSON.parse(modelKey) as Model));
	const compiled = $derived(compileModel(JSON.parse(modelKey) as Model, validateParams));
	const errors = $derived(compiled.ok ? [] : compiled.errors);
	const samplesError = $derived(samplesProblem(model.samples, MAX_SAMPLES) ?? undefined);
	const seedError = $derived(seedProblem(model.seed) ?? undefined);
	const problems = $derived([
		...errors.map((e) => `${describeLocation(model, e.where)}: ${e.message}`),
		...(samplesError ? [`Samples: ${samplesError}`] : []),
		...(seedError ? [`Seed: ${seedError}`] : [])
	]);

	function setModel(next: Model) {
		model = next;
		ids = rowIds(next);
	}

	function choosePreset(id: string) {
		if (id === 'custom') return;
		setModel(presetModel(id as PresetId));
	}

	function rename(from: string, to: string) {
		model = renameSymbol($state.snapshot(model) as Model, from, to);
	}

	// --- Engine ---
	let engine: SimulationEngine | null = null;
	let analyser: Analyser | null = null;
	let running = $state(false);
	let progress = $state.raw<Extract<EngineEvent, { type: 'progress' }> | null>(null);
	let runError = $state('');
	let analysis = $state.raw<Analysis | null>(null);
	let scenarioCount = $state(0);
	let doneMs = $state<number | null>(null);
	/** Completed jobs (runs, adds and tree updates), exposed as `data-done` for tests. */
	let completed = $state(0);
	/** The model the shown scenarios were drawn with, and its key. */
	let runModel = $state.raw<Model | null>(null);
	let runKey = $state<string | null>(null);
	let tree = $state<TreeSettings>({ ...DEFAULT_TREE });
	let appliedTree = $state.raw<TreeSettings>({ ...DEFAULT_TREE });
	/** What the job in flight adopts when it completes. */
	let pending: { model?: Model; key?: string; tree?: TreeSettings } | null = null;

	const stale = $derived(runKey !== null && runKey !== modelKey);

	function onEvent(event: EngineEvent) {
		switch (event.type) {
			case 'progress':
				progress = event;
				break;
			case 'done':
				analysis = event.analysis;
				scenarioCount = event.scenarios.n;
				doneMs = event.elapsedMs;
				completed++;
				if (pending?.model) {
					runModel = pending.model;
					runKey = pending.key ?? null;
				}
				if (pending?.tree) appliedTree = pending.tree;
				pending = null;
				running = false;
				progress = null;
				break;
			case 'cancelled':
				pending = null;
				running = false;
				progress = null;
				break;
			case 'error':
				runError = event.message;
				pending = null;
				running = false;
				progress = null;
				break;
		}
	}

	function ensureEngine(): SimulationEngine {
		if (engine) return engine;
		analyser = createAnalyser(
			() =>
				new Worker(new URL('$lib/information-pricing/analysis.worker.ts', import.meta.url), {
					type: 'module'
				})
		);
		engine = createSimulationEngine(
			() =>
				new Worker(new URL('$lib/information-pricing/simulate.worker.ts', import.meta.url), {
					type: 'module'
				}),
			{ workers: defaultWorkerCount(), analyser }
		);
		engine.subscribe(onEvent);
		return engine;
	}

	const treeValid = (t: TreeSettings) =>
		Number.isInteger(t.maxDepth) &&
		t.maxDepth >= 1 &&
		t.maxDepth <= 6 &&
		t.minLeafPercent > 0 &&
		t.minLeafPercent < 50 &&
		t.minImpurityDecrease >= 0 &&
		t.minImpurityDecrease < 1;

	function run() {
		if (running || problems.length > 0) return;
		const snap = JSON.parse(modelKey) as Model;
		const result = compileModel(snap, validateParams);
		if (!result.ok) return;
		const settings = treeValid(tree) ? { ...tree } : appliedTree;
		const spec = runSpec(snap, result.compiled);
		spec.analysis = { ...spec.analysis, tree: treeOptions(settings) };
		pending = { model: snap, key: modelKey, tree: settings };
		runError = '';
		running = true;
		ensureEngine().run(spec, snap.samples);
	}

	function addScenarios() {
		if (running || !analysis || samplesError) return;
		pending = {};
		runError = '';
		running = true;
		ensureEngine().add(model.samples);
	}

	function retree() {
		if (running || !analysis || !runModel) return;
		const settings = { ...tree };
		pending = { tree: settings };
		runError = '';
		running = true;
		ensureEngine().reanalyse({ unit: runModel.decisions.unit, tree: treeOptions(settings) });
	}

	function cancel() {
		engine?.cancel();
	}

	onDestroy(() => {
		engine?.dispose();
		analyser?.dispose();
	});

	// --- Download ---
	function downloadCsv() {
		const s = engine?.scenarios;
		if (!s || running || !runModel) return;
		const names = new Map<string, string>();
		for (const x of [...runModel.inputs, ...runModel.intermediates]) names.set(x.symbol, x.name);
		const blob = new Blob([...scenariosCsv(s, { names })], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'scenarios.csv';
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	// --- Labels for the results ---
	const inputLabels = $derived(
		runModel?.inputs.map((i) => (i.name ? `${i.name} (${i.symbol})` : i.symbol)) ?? []
	);
	const decisionNames = $derived(runModel ? decisionLabels(runModel.decisions) : []);
	const count = (n: number) => n.toLocaleString('en');
	const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
	const stage = $derived(
		progress?.stage === 'analysing'
			? 'Analysing'
			: progress
				? `Simulating ${count(progress.done)} of ${count(progress.total)}`
				: ''
	);

	// --- Saving and the share link ---
	const storage = browserStorage();
	const persist = createPersistGate(storage);
	let hydrated = $state(false);
	let linkError = $state('');
	let shareUrl = $state('');
	let shareSeq = 0;

	$effect(() => {
		const key = modelKey;
		if (!hydrated) return;
		const snap = JSON.parse(key) as Model;
		if (!allFinite(model)) return;
		saveModel(persist, snap);
		const seq = ++shareSeq;
		void encodeModel(snap).then((encoded) => {
			if (seq !== shareSeq) return;
			const url = new URL(page.url);
			url.hash = `${HASH_PARAM}=${encoded}`;
			shareUrl = url.toString();
		});
	});

	/** Load a `#m=` link if there is one; true when the hash held a link (good or bad). */
	async function loadLink(): Promise<boolean> {
		const encoded = new URLSearchParams(location.hash.slice(1)).get(HASH_PARAM);
		if (encoded === null) return false;
		const result = await decodeModel(encoded);
		if (result.ok) {
			linkError = '';
			setModel(result.model);
		} else {
			linkError = result.error;
			setModel(presetModel(DEFAULT_PRESET));
		}
		// The link has been read; from here on autosave keeps the edits.
		setTimeout(() => replaceState(location.pathname + location.search, {}));
		return true;
	}

	function clearAll() {
		engine?.dispose();
		engine = null;
		if (storage) clearSaved(storage, STORAGE_PREFIX);
		window.location.replace(location.pathname);
	}

	onMount(() => {
		const onHash = () => void loadLink();
		window.addEventListener('hashchange', onHash);
		void (async () => {
			if (!(await loadLink())) {
				const saved = loadSaved(storage);
				if (saved) setModel(saved);
			}
			persist.open();
			hydrated = true;
		})();
		return () => window.removeEventListener('hashchange', onHash);
	});
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/information-pricing">
		{#snippet actions()}<ShareActions
				url={shareUrl}
				onClear={clearAll}
				description="the model, never results"
			/>{/snippet}
		What is it worth to know before you decide? Build a model, simulate it and price the uncertainty.
		Everything runs in your browser.
	</PageHeader>

	{#if linkError}
		<div class="link-error" data-testid="link-error">
			<Alert tone="danger">Couldn't open that link: {linkError} Showing the default model.</Alert>
		</div>
	{/if}

	<div class="layout">
		<div class="stack editor">
			<Panel title="Run">
				<div class="stack">
					<div class="grid-2">
						<NumberInput
							label="Samples"
							value={model.samples}
							onchange={(v) => (model.samples = v)}
							error={samplesError}
							hint="Up to {count(MAX_SAMPLES)}."
						/>
						<NumberInput
							label="Seed"
							value={model.seed}
							onchange={(v) => (model.seed = v)}
							error={seedError}
						/>
					</div>
					<div class="cluster">
						<Button
							variant="primary"
							onclick={run}
							disabled={running || problems.length > 0}
							aria-describedby={problems.length > 0 ? 'run-reason' : undefined}>Run</Button
						>
						<Button
							onclick={addScenarios}
							disabled={running || !analysis || !!samplesError}
							aria-describedby="add-hint">Add scenarios</Button
						>
						{#if running}<Button variant="danger" onclick={cancel}>Cancel</Button>{/if}
					</div>
					<p id="add-hint" class="muted">
						{#if analysis}Add scenarios appends {count(model.samples || 0)} to the {count(
								scenarioCount
							)} you have.{:else}Run first, then add more scenarios to the same set.{/if}
					</p>
					{#if running && progress}
						<div class="progress" data-testid="progress">
							<label for="run-progress">{stage}</label>
							<progress
								id="run-progress"
								max={progress.total || 1}
								value={progress.stage === 'analysing' ? undefined : progress.done}
							></progress>
							<span class="muted" data-testid="elapsed">{seconds(progress.elapsedMs)}</span>
						</div>
					{/if}
					<p class="muted" role="status" data-testid="run-status" data-done={completed}>
						{#if !running && analysis && doneMs !== null}{count(scenarioCount)} scenarios · done in {seconds(
								doneMs
							)}{/if}
					</p>
					{#if problems.length > 0}
						<div id="run-reason" data-testid="run-reason">
							<Alert tone="warning">
								Fix the model to run:
								<ul class="problems">
									{#each problems.slice(0, 8) as p, i (i)}<li>{p}</li>{/each}
									{#if problems.length > 8}<li>…and {problems.length - 8} more.</li>{/if}
								</ul>
							</Alert>
						</div>
					{/if}
					{#if runError}<Alert tone="danger">The run failed: {runError}</Alert>{/if}
					<div>
						<Button
							size="sm"
							onclick={downloadCsv}
							disabled={running || !analysis}
							data-testid="download-csv">Download scenarios (CSV)</Button
						>
					</div>
				</div>
			</Panel>

			<Panel title="Model">
				<div class="stack model">
					<Field label="Preset" hint={preset ? undefined : 'Your own model.'}>
						{#snippet children(props)}
							<select
								class="control"
								value={preset ?? 'custom'}
								onchange={(e) => choosePreset(e.currentTarget.value)}
								data-testid="preset"
								{...props}
							>
								{#each PRESETS as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
								<option value="custom" disabled>Custom</option>
							</select>
						{/snippet}
					</Field>
					<InputsEditor bind:model bind:ids {errors} onrename={rename} />
					<ConstantsEditor bind:model bind:ids {errors} onrename={rename} />
					<IntermediatesEditor bind:model bind:ids {errors} onrename={rename} />
					<DecisionsEditor bind:model bind:ids {errors} onrename={rename} />
					{#each errors.filter((e) => e.where.kind === 'model') as e, i (i)}
						<Alert tone="warning">{e.message}</Alert>
					{/each}
				</div>
			</Panel>
		</div>

		<div class="stack output">
			{#if stale}
				<div data-testid="stale">
					<Alert tone="warning">Results are out of date, run again.</Alert>
				</div>
			{/if}
			{#if analysis && runModel}
				<Results
					{analysis}
					decisions={decisionNames}
					inputs={inputLabels}
					unit={runModel.decisions.unit}
					bind:tree
					applied={appliedTree}
					busy={running}
					onretree={retree}
				/>
			{:else}
				<Panel title="Results">
					<p class="muted placeholder">
						Pick a preset or build your own model, then press Run. Results show up here.
					</p>
				</Panel>
			{/if}
		</div>
	</div>

	<HowItWorks />
</div>

<style>
	.layout {
		display: grid;
		gap: var(--sp-3);
		align-items: start;
	}
	@media (min-width: 1000px) {
		.layout {
			grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
		}
	}
	.editor,
	.output {
		min-width: 0;
	}
	.link-error {
		margin-bottom: var(--sp-3);
	}
	.muted {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.muted:empty {
		display: none;
	}
	.placeholder {
		padding: var(--sp-4) 0;
	}
	.grid-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-2) var(--sp-3);
	}
	.progress {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: var(--sp-1) var(--sp-2);
		font-size: var(--text-sm);
	}
	.progress label {
		grid-column: 1 / -1;
	}
	progress {
		width: 100%;
		accent-color: var(--accent);
	}
	.problems {
		margin: var(--sp-1) 0 0;
		padding-left: var(--sp-4);
	}
	.model :global(.section) {
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
		--gap: var(--sp-2);
	}
	.model :global(.section h3) {
		margin: 0;
		font-size: var(--text-md);
	}
	.model :global(.row) {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-1);
		padding: var(--sp-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.model :global(.fields) {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: var(--sp-2);
	}
	.model :global(.wide) {
		grid-column: 1 / -1;
		min-width: 0;
	}
	.model :global(.remove) {
		flex: none;
		margin-top: 20px;
	}
	.model :global(.muted) {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
</style>
