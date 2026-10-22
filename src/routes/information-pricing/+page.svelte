<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { createAnalyser, type Analyser } from '$lib/information-pricing/analyser';
	import type { PartialAnalysis } from '$lib/information-pricing/analysis';
	import { scenariosCsv } from '$lib/information-pricing/csv';
	import { dataflow } from '$lib/information-pricing/dataflow';
	import { validateParams } from '$lib/information-pricing/distributions';
	import {
		compileModel,
		decisionLabels,
		randomInputs,
		renameSymbol
	} from '$lib/information-pricing/model';
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
	import {
		Alert,
		Button,
		Field,
		InfoTip,
		Maximizable,
		PageHeader,
		References,
		ShareActions,
		Stepper
	} from '$lib/ui';
	import { defaultWorkerCount } from '$lib/worker-pool';
	import DataflowGraph from './lib/DataflowGraph.svelte';
	import DecisionsEditor from './lib/DecisionsEditor.svelte';
	import {
		DEFAULT_TREE,
		allFinite,
		describeLocation,
		inputNode,
		intermediateNode,
		rowIds,
		samplesProblem,
		seedProblem,
		treeOptions,
		treeValid,
		type RowIds,
		type TreeSettings
	} from './lib/editor';
	import HowItWorks from './lib/HowItWorks.svelte';
	import InputsEditor from './lib/InputsEditor.svelte';
	import IntermediatesEditor from './lib/IntermediatesEditor.svelte';
	import NumberInput from './lib/NumberInput.svelte';
	import { REFERENCES } from './lib/references';
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

	// --- Dataflow ---
	const graph = $derived(
		dataflow(
			model,
			{
				input: (i) => inputNode(ids.inputs[i]),
				intermediate: (i) => intermediateNode(ids.intermediates[i])
			},
			{
				intermediates: new Set(
					errors.flatMap((e) =>
						e.where.kind === 'intermediate' && e.where.field === 'formula' ? [e.where.index] : []
					)
				),
				reward: errors.some((e) => e.where.kind === 'reward')
			}
		)
	);
	/** The dataflow node picked in the graph; its table row is highlighted. */
	let picked = $state<string | null>(null);
	/** The node picked in the maximized graph: it lights up there only. */
	let pickedMax = $state<string | null>(null);
	$effect(() => {
		if (!picked) return;
		document
			.querySelector(`[data-testid="setup"] [data-node="${picked}"]`)
			?.scrollIntoView({ block: 'nearest' });
	});

	// --- Steps ---
	const STEPS = ['Setup', 'Results'] as const;
	/** Current step, page state only (never in the link or the saved model). */
	let step = $state(0);

	// --- Engine ---
	let engine: SimulationEngine | null = null;
	let analyser: Analyser | null = null;
	let running = $state(false);
	let progress = $state.raw<Extract<EngineEvent, { type: 'progress' }> | null>(null);
	let runError = $state('');
	/** What Results shows: the analysis so far while a job runs, else the last complete one. */
	let analysis = $state.raw<PartialAnalysis | null>(null);
	/** True once a job has completed: the CSV and Add scenarios need complete scenarios. */
	let hasScenarios = $state(false);
	let scenarioCount = $state(0);
	let doneMs = $state<number | null>(null);
	/** Completed jobs (runs, adds and tree updates), exposed as `data-done` for tests. */
	let completed = $state(0);
	/** The model the shown scenarios were drawn with, and its key. */
	let runModel = $state.raw<Model | null>(null);
	let runKey = $state<string | null>(null);
	/** Symbols of the decision-independent intermediates of `runModel`, analysis order. */
	let runShared = $state.raw<string[]>([]);
	/** What the last completed job showed, restored when a later one is cancelled or fails. */
	let last: {
		analysis: PartialAnalysis | null;
		model: Model | null;
		key: string | null;
		shared: string[];
	} = { analysis: null, model: null, key: null, shared: [] };
	let tree = $state<TreeSettings>({ ...DEFAULT_TREE });
	let appliedTree = $state.raw<TreeSettings>({ ...DEFAULT_TREE });
	/** What the job in flight adopts when it completes. */
	let pending: {
		model?: Model;
		key?: string;
		shared?: string[];
		tree?: TreeSettings;
		/** The first partial is in (a fresh run shows Results then). */
		shown?: boolean;
	} | null = null;

	const stale = $derived(runKey !== null && runKey !== modelKey);

	/** Show the new run's model with its first partial results. */
	function adoptRun() {
		if (!pending?.model || pending.shown) return;
		pending.shown = true;
		runModel = pending.model;
		runKey = pending.key ?? null;
		runShared = pending.shared ?? [];
		// A fresh run (not Add scenarios or a tree update) shows its results.
		step = 1;
	}

	/** A job ended without results: back to what the last completed one showed. */
	function restore() {
		if (pending?.shown) {
			({ analysis, model: runModel, key: runKey, shared: runShared } = last);
			if (!analysis) step = 0;
		} else if (pending) analysis = last.analysis;
		pending = null;
		running = false;
		progress = null;
	}

	function onEvent(event: EngineEvent) {
		switch (event.type) {
			case 'progress':
				progress = event;
				break;
			case 'partial':
				analysis = event.analysis;
				adoptRun();
				break;
			case 'done':
				analysis = event.analysis;
				adoptRun();
				hasScenarios = true;
				scenarioCount = event.scenarios.n;
				doneMs = event.elapsedMs;
				completed++;
				last = { analysis, model: runModel, key: runKey, shared: runShared };
				if (pending?.tree) appliedTree = pending.tree;
				pending = null;
				running = false;
				progress = null;
				break;
			case 'cancelled':
				restore();
				break;
			case 'error':
				runError = event.message;
				restore();
				break;
		}
	}

	function ensureEngine(): SimulationEngine {
		if (engine) return engine;
		analyser = createAnalyser(
			() =>
				new Worker(new URL('$lib/information-pricing/analysis.worker.ts', import.meta.url), {
					type: 'module'
				}),
			() =>
				new Worker(new URL('$lib/information-pricing/tree.worker.ts', import.meta.url), {
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

	function run() {
		if (running || problems.length > 0) return;
		const snap = JSON.parse(modelKey) as Model;
		const result = compileModel(snap, validateParams);
		if (!result.ok) return;
		const settings = treeValid(tree) ? { ...tree } : appliedTree;
		const spec = runSpec(snap, result.compiled);
		spec.analysis = { ...spec.analysis, tree: treeOptions(settings) };
		pending = {
			model: snap,
			key: modelKey,
			shared: [...result.compiled.slots.shared],
			tree: settings
		};
		runError = '';
		running = true;
		ensureEngine().run(spec, snap.samples);
	}

	function addScenarios() {
		if (running || !hasScenarios || samplesError) return;
		pending = {};
		runError = '';
		running = true;
		ensureEngine().add(model.samples);
	}

	function retree() {
		if (running || !hasScenarios || !runModel) return;
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

	// --- Labels for the results (random inputs only: fixed ones have no column) ---
	const resultInputs = $derived(runModel ? randomInputs(runModel) : []);
	/** "Name (S)", or the symbol when unnamed. */
	const label = (x: { name: string; symbol: string }) =>
		x.name ? `${x.name} (${x.symbol})` : x.symbol;
	const inputLabels = $derived(resultInputs.map(label));
	/** Input names for the tree's splits; the symbol when the name is empty. */
	const inputNames = $derived(resultInputs.map((i) => i.name || i.symbol));
	const decisionNames = $derived(runModel ? decisionLabels(runModel.decisions) : []);
	/** Decision-independent intermediates (analysis order) and the ones that use the decision. */
	const sharedLabels = $derived(
		runShared.map((sym) => {
			const x = runModel?.intermediates.find((i) => i.symbol === sym);
			return x ? label(x) : sym;
		})
	);
	const dependentLabels = $derived(
		(runModel?.intermediates ?? []).filter((i) => !runShared.includes(i.symbol)).map(label)
	);
	const count = (n: number) => n.toLocaleString('en');
	const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
	const stage = $derived(
		progress ? `${progress.step} · ${Math.floor(progress.fraction * 100)} %` : ''
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

{#snippet flow(maximized: boolean)}
	{#if maximized}
		<DataflowGraph {graph} maximized bind:selected={pickedMax} />
	{:else}
		<DataflowGraph {graph} bind:selected={picked} />
	{/if}
{/snippet}

<div class="container ip" data-hydrated={hydrated || undefined}>
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

	<Stepper
		label="Steps"
		current={step}
		steps={STEPS.map((label, i) => ({ label, disabled: i === 1 && !analysis }))}
		onselect={(i) => (step = i)}
	/>

	<div class="runbar" data-testid="run-bar">
		<div class="run-fields">
			<NumberInput
				label="Samples"
				value={model.samples}
				onchange={(v) => (model.samples = v)}
				error={samplesError}
			/>
			<NumberInput
				label="Seed"
				value={model.seed}
				onchange={(v) => (model.seed = v)}
				error={seedError}
			/>
		</div>
		<div class="run-actions">
			<Button
				variant="primary"
				onclick={run}
				disabled={running || problems.length > 0}
				aria-describedby={problems.length > 0 ? 'run-reason' : undefined}>Run</Button
			>
			<Button
				onclick={addScenarios}
				disabled={running || !hasScenarios || !!samplesError}
				aria-describedby="add-hint">Add scenarios</Button
			>
			{#if running}<Button variant="danger" onclick={cancel}>Cancel</Button>{/if}
			<Button
				variant="ghost"
				onclick={downloadCsv}
				disabled={running || !hasScenarios}
				data-testid="download-csv"
				><span aria-hidden="true">↓</span><span class="sr-only">Download</span> Scenarios (CSV)</Button
			>
			<InfoTip label="the scenarios CSV"
				>Downloads every simulated scenario: inputs, intermediates, each decision's reward and
				opportunity loss, and the optimal reward.</InfoTip
			>
		</div>
		<div class="run-status">
			{#if running && progress}
				<span class="progress" data-testid="progress">
					<label for="run-progress" data-testid="progress-label">{stage}</label>
					<progress id="run-progress" max="1" value={progress.fraction}></progress>
					<span data-testid="elapsed">{seconds(progress.elapsedMs)}</span>
				</span>
			{/if}
			<span role="status" data-testid="run-status" data-done={completed}
				>{#if !running && hasScenarios && doneMs !== null}{count(scenarioCount)} scenarios · {seconds(
						doneMs
					)}{/if}</span
			>
			{#if stale}<span class="stale" data-testid="stale">Out of date, run again</span>{/if}
		</div>
		<p id="add-hint" class="sr-only">
			{#if hasScenarios}Appends {count(model.samples || 0)} to the {count(scenarioCount)} scenarios you
				have.{:else}Run first.{/if}
		</p>
	</div>

	{#if problems.length > 0}
		<div id="run-reason" class="notice" data-testid="run-reason">
			<Alert tone="warning">
				Fix the model to run:
				<ul class="problems">
					{#each problems.slice(0, 8) as p, i (i)}<li>{p}</li>{/each}
					{#if problems.length > 8}<li>…and {problems.length - 8} more.</li>{/if}
				</ul>
			</Alert>
		</div>
	{/if}
	{#if runError}<div class="notice">
			<Alert tone="danger">The run failed: {runError}</Alert>
		</div>{/if}

	{#if step === 0}
		<div class="setup" data-testid="setup">
			<div class="preset">
				<Field label="Preset">
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
			</div>
			{#each errors.filter((e) => e.where.kind === 'model') as e, i (i)}
				<Alert tone="warning">{e.message}</Alert>
			{/each}
			<div class="tables" data-testid="setup-tables">
				<div class="column">
					<div class="card">
						<InputsEditor bind:model bind:ids {errors} onrename={rename} selected={picked} />
					</div>
					<div class="card">
						<DecisionsEditor bind:model bind:ids {errors} onrename={rename} selected={picked} />
					</div>
				</div>
				<div class="column">
					<div class="card">
						<IntermediatesEditor bind:model bind:ids {errors} onrename={rename} selected={picked} />
					</div>
					<Maximizable title="Dataflow" plot={flow}>
						{#snippet frame(button)}
							<section
								class="card dataflow"
								data-testid="dataflow-card"
								aria-labelledby="dataflow-heading"
							>
								<div class="section-head">
									<h3 id="dataflow-heading">Dataflow</h3>
									<InfoTip label="the dataflow"
										>How the numbers feed each other, from inputs down to the reward. Click a box to
										find its row and light up what it uses and what uses it.</InfoTip
									>
									{@render button()}
								</div>
								{@render flow(false)}
							</section>
						{/snippet}
					</Maximizable>
				</div>
			</div>
		</div>
	{:else if analysis && runModel}
		<Results
			{analysis}
			decisions={decisionNames}
			inputs={inputLabels}
			names={inputNames}
			intermediates={sharedLabels}
			dependent={dependentLabels}
			bind:tree
			applied={appliedTree}
			busy={running}
			onretree={retree}
		/>
	{/if}

	<HowItWorks />
	<References references={REFERENCES} />
</div>

<style>
	.link-error,
	.notice {
		margin-bottom: var(--sp-3);
	}

	/* Run bar: one wrapping row under the stepper. */
	.runbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-2) var(--sp-3);
		margin-bottom: var(--sp-3);
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.run-fields {
		display: flex;
		gap: var(--sp-2) var(--sp-3);
		flex-wrap: wrap;
	}
	.run-fields :global(.ui-field) {
		display: grid;
		grid-template-columns: auto 6.5rem;
		align-items: center;
		gap: var(--sp-0) var(--sp-1);
	}
	.run-fields :global(.ui-field > .ui-error) {
		grid-column: 1 / -1;
		max-width: 12rem;
	}
	.run-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}
	.run-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-1) var(--sp-3);
		min-height: var(--control-h);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.progress {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-variant-numeric: tabular-nums;
	}
	progress {
		width: 8rem;
		accent-color: var(--accent);
	}
	.stale {
		padding: var(--sp-0) var(--sp-2);
		border: 1px solid var(--warning);
		border-radius: 999px;
		background: var(--warning-bg);
		color: var(--warning-text);
		font-size: var(--text-xs);
	}
	.problems {
		margin: var(--sp-1) 0 0;
		padding-left: var(--sp-4);
	}

	/* This page uses the full window width. */
	.ip {
		max-width: none;
	}

	/*
	 * Setup: two columns, inputs over decisions | intermediates over dataflow,
	 * each its own stack so a tall card leaves no gap beside it; one column
	 * (in that order) on phones.
	 */
	.setup {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		container-type: inline-size;
	}
	.preset :global(.ui-field) {
		flex-direction: row;
		align-items: center;
		gap: var(--sp-2);
	}
	.preset select {
		width: auto;
		min-width: 14rem;
		max-width: 100%;
	}
	.tables {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--sp-3);
		align-items: start;
	}
	.column {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}
	@container (min-width: 64rem) {
		.tables {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
	.setup :global(.card) {
		container-type: inline-size;
		min-width: 0;
		padding: var(--sp-2) var(--sp-3) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.setup :global(.section) {
		--gap: var(--sp-2);
	}
	.setup :global(.section-head) {
		display: flex;
		align-items: center;
		gap: var(--sp-0);
		margin-bottom: calc(-1 * var(--sp-1));
	}
	.dataflow .section-head {
		margin-bottom: var(--sp-1);
	}
	.setup :global(.section-head h3) {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.setup :global(.cols) {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-bottom: calc(-1 * var(--sp-1));
	}
	.setup :global(.input-cols),
	.setup :global(.intermediate-cols) {
		display: grid;
		gap: var(--sp-1) var(--sp-2);
		align-items: start;
	}
	/* Distribution, name, symbol, parameters, remove. */
	.setup :global(.input-cols) {
		grid-template-columns: 4.75rem minmax(6rem, 1fr) 2.75rem minmax(13.5rem, 1.4fr) 1.75rem;
	}
	/* Symbol, name, formula, remove. */
	.setup :global(.intermediate-cols) {
		grid-template-columns: 4rem minmax(0, 1.1fr) minmax(0, 1.2fr) 1.75rem;
	}
	/* Narrow: parameters and formulas get their own line. */
	@container (max-width: 44rem) {
		.setup :global(.input-cols) {
			grid-template-columns: 5rem minmax(0, 1fr) 2.75rem 1.75rem;
		}
		.setup :global(.input-cols .params) {
			grid-column: 1 / -2;
			grid-row: 2;
		}
		.setup :global(.input-cols .params-head) {
			display: none;
		}
	}
	@container (max-width: 33rem) {
		.setup :global(.intermediate-cols) {
			grid-template-columns: 4rem minmax(0, 1fr) 1.75rem;
		}
		.setup :global(.intermediate-cols .formula) {
			grid-column: 1 / -2;
			grid-row: 2;
		}
		.setup :global(.cols.intermediate-cols span:nth-child(3)) {
			display: none;
		}
	}
	.setup :global(.formula) {
		min-width: 0;
	}
	.setup :global(.row) {
		border-radius: var(--radius-sm);
	}
	.setup :global(.selected) {
		background: var(--accent-bg);
		box-shadow:
			0 0 0 4px var(--accent-bg),
			0 0 0 5px var(--accent);
	}
	.setup :global(.remove) {
		margin-top: 2px;
	}
</style>
