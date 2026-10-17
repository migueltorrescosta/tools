<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { createPersistGate } from '$lib/persist-gate';
	import { copyToClipboard } from '$lib/clipboard';
	import { EXAMPLES } from '$lib/data/symbolic-regression-examples';
	import { parseCsv, type ParsedCsv } from '$lib/symbolic-regression/csv';
	import {
		analyzeColumns,
		buildDataset,
		defaultInputs,
		splitDataset
	} from '$lib/symbolic-regression/dataset';
	import { evaluate } from '$lib/symbolic-regression/expr';
	import {
		toJavaScript,
		toLatex,
		toPython,
		toText,
		formatNumber
	} from '$lib/symbolic-regression/format';
	import { toMathML } from '$lib/symbolic-regression/mathml';
	import { recommendedIndex } from '$lib/symbolic-regression/front';
	import { WorkerSearchEngine, defaultWorkerCount } from '$lib/symbolic-regression/worker-engine';
	import {
		DATASET_KEY,
		FRONT_KEY,
		SETTINGS_KEY,
		canSaveCsv,
		clearSaved,
		decodeShareParams,
		encodeShareParams,
		hasShareParams,
		readJson,
		type SavedDataset,
		type ShareState
	} from '$lib/symbolic-regression/state';
	import {
		ALL_OPERATORS,
		DEFAULT_OPERATORS,
		DEFAULT_SETTINGS,
		UNARY_OPS,
		type FrontEntry,
		type OperatorName,
		type PreparedData
	} from '$lib/symbolic-regression/types';
	import ScatterPlot from './lib/ScatterPlot.svelte';
	import { thin, type Point } from './lib/plot';

	const OPERATOR_LABELS: Record<OperatorName, string> = {
		add: '+',
		sub: '−',
		mul: '×',
		div: '÷',
		pow: 'pow',
		square: 'x²',
		cube: 'x³',
		sqrt: '√',
		exp: 'exp',
		log: 'log',
		sin: 'sin',
		cos: 'cos',
		abs: '|x|'
	};
	const MAX_PLOT_POINTS = 1500;

	// --- Data ---
	let csvText = $state.raw<string | null>(null);
	let sourceName = $state('');
	let exampleId = $state<string | null>(null);
	let parsed = $state.raw<ParsedCsv | null>(null);
	let datasetNotSaved = $state(false);
	let loadError = $state('');
	let dragging = $state(false);

	const columns = $derived(parsed ? analyzeColumns(parsed) : []);
	let targetIndex = $state(-1);
	let inputIndices = $state<number[]>([]);

	const built = $derived(
		parsed && targetIndex >= 0 && inputIndices.length > 0
			? buildDataset(parsed, targetIndex, inputIndices)
			: null
	);

	// --- Settings ---
	let operators = $state<OperatorName[]>([...DEFAULT_OPERATORS]);
	let timeBudgetSec = $state(DEFAULT_SETTINGS.timeBudgetSec);
	let validationPercent = $state(DEFAULT_SETTINGS.validationFraction * 100);
	let seed = $state(DEFAULT_SETTINGS.seed);
	let workers = $state(1);

	// --- Search ---
	let engine: WorkerSearchEngine | null = null;
	let running = $state(false);
	let canContinue = $state(false);
	let iterations = $state(0);
	let elapsedMs = $state(0);
	let runError = $state('');
	let front = $state.raw<FrontEntry[]>([]);
	/** Input names the front's `var` indices refer to. */
	let frontNames = $state.raw<string[]>([]);
	let frontTarget = $state('');
	let selected = $state(-1);
	/** The split the current front was scored on; rebuilt from settings after a reload. */
	let runData = $state.raw<PreparedData | null>(null);

	const recommended = $derived(recommendedIndex(front));
	const selectedEntry = $derived(front[selected] ?? null);

	// Pending column choices from the URL or saved settings, applied when matching data loads
	let pendingTarget: string | null = null;
	let pendingInputs: string[] | null = null;

	let hydrated = $state(false);
	let routerReady = $state(false);

	function getStorage(): Storage | null {
		if (!browser) return null;
		try {
			return localStorage;
		} catch {
			return null;
		}
	}
	const storage = getStorage();
	const persist = createPersistGate(storage);

	// --- Loading data ---
	function loadCsv(text: string, name: string, example: string | null) {
		loadError = '';
		let result: ParsedCsv;
		try {
			result = parseCsv(text);
		} catch (e) {
			loadError = `Could not parse ${name}: ${(e as Error).message}`;
			return;
		}
		if (result.header.length === 0) {
			loadError = `${name} has no header row.`;
			return;
		}
		csvText = text;
		sourceName = name;
		exampleId = example;
		parsed = result;
		resetResults();
		const cols = analyzeColumns(result);
		const byName = (n: string) => cols.find((c) => c.name === n && c.numeric)?.index ?? -1;
		let target = pendingTarget !== null ? byName(pendingTarget) : -1;
		if (target < 0) target = [...cols].reverse().find((c) => c.numeric)?.index ?? -1;
		targetIndex = target;
		const fromPending = (pendingInputs ?? []).map(byName).filter((i) => i >= 0 && i !== target);
		inputIndices =
			pendingInputs && fromPending.length > 0 ? fromPending : defaultInputs(cols, target);
		pendingTarget = null;
		pendingInputs = null;
	}

	/** `columns` (from a share URL or saved settings) override the example's own choice. */
	function loadExample(id: string, columns?: Partial<ShareState>) {
		const ex = EXAMPLES.find((e) => e.id === id);
		if (!ex) return;
		pendingTarget = columns?.target ?? ex.target;
		pendingInputs = columns?.inputs ?? ex.inputs;
		if (ex.operators) operators = [...ex.operators];
		loadCsv(ex.csv, ex.name, ex.id);
	}

	async function loadFile(file: File) {
		const text = await file.text();
		// Yield once so the "Loading" state paints before a large parse
		await new Promise((r) => setTimeout(r));
		loadCsv(text, file.name, null);
	}

	function onFileInput(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (file) void loadFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) void loadFile(file);
	}

	function setTarget(index: number) {
		targetIndex = index;
		inputIndices = defaultInputs(columns, index);
	}

	function toggleInput(index: number, on: boolean) {
		inputIndices = on
			? [...inputIndices, index].sort((a, b) => a - b)
			: inputIndices.filter((i) => i !== index);
	}

	function toggleOperator(op: OperatorName, on: boolean) {
		operators = on
			? ALL_OPERATORS.filter((o) => o === op || operators.includes(o))
			: operators.filter((o) => o !== op);
	}

	// --- Search control ---
	function resetResults() {
		engine?.dispose();
		engine = null;
		running = false;
		canContinue = false;
		front = [];
		frontNames = [];
		selected = -1;
		runData = null;
		iterations = 0;
		elapsedMs = 0;
	}

	function settingsForRun() {
		return {
			...DEFAULT_SETTINGS,
			operators: [...operators],
			seed,
			workers,
			timeBudgetSec,
			validationFraction: validationPercent / 100
		};
	}

	function start() {
		if (!built || built.data.y.length < 2) return;
		resetResults();
		runError = '';
		const settings = settingsForRun();
		const data = splitDataset(built, settings.validationFraction, settings.seed);
		runData = data;
		frontNames = data.inputNames;
		frontTarget = data.targetName;
		engine = new WorkerSearchEngine(
			() =>
				new Worker(new URL('$lib/symbolic-regression/search.worker.ts', import.meta.url), {
					type: 'module'
				})
		);
		engine.subscribe((event) => {
			if (event.type === 'progress') {
				iterations = event.iterations;
				elapsedMs = event.elapsedMs;
				showFront(event.front);
			} else if (event.type === 'stopped') {
				showFront(event.front);
				running = false;
				canContinue = true;
			} else {
				runError = event.message;
				running = false;
			}
		});
		running = true;
		engine.start(data, settings);
	}

	function showFront(next: FrontEntry[]) {
		const followRecommended = selected < 0 || selected === recommended;
		const prevComplexity = front[selected]?.complexity;
		front = next;
		const rec = recommendedIndex(next);
		if (followRecommended) selected = rec;
		else
			selected = Math.max(
				0,
				next.findIndex((f) => f.complexity === prevComplexity)
			);
	}

	function stop() {
		engine?.stop();
	}

	function resume() {
		if (!engine) return;
		running = true;
		canContinue = false;
		engine.continue();
	}

	onDestroy(() => engine?.dispose());

	// --- Predictions for the plots ---
	const plotData = $derived.by(() => {
		const data = runData ?? (built ? splitDataset(built, validationPercent / 100, seed) : null);
		if (!selectedEntry || !data) return null;
		const val = data.validation;
		const pred = evaluate(selectedEntry.expr, val.x);
		if (!pred) return null;
		return { val, pred };
	});

	let plotInput = $state(0);

	const paretoPoints = $derived<Point[]>(
		front.map((f, i) => ({ x: f.complexity, y: f.valMse, id: i }))
	);
	const predictedPoints = $derived.by<Point[]>(() => {
		if (!plotData) return [];
		const { val, pred } = plotData;
		return thin(
			Array.from(val.y, (y, i) => ({ x: y, y: pred[i] })),
			MAX_PLOT_POINTS
		);
	});
	const residualPoints = $derived.by<Point[]>(() => {
		if (!plotData) return [];
		const { val, pred } = plotData;
		return thin(
			Array.from(val.y, (y, i) => ({ x: pred[i], y: y - pred[i] })),
			MAX_PLOT_POINTS
		);
	});
	/** Every row, for the target-against-input plot, while the columns match the front. */
	const allRows = $derived.by(() => {
		if (!selectedEntry || !built) return null;
		if (built.inputNames.join('\u0000') !== frontNames.join('\u0000')) return null;
		const pred = evaluate(selectedEntry.expr, built.data.x);
		return pred ? { data: built.data, pred } : null;
	});
	const inputPoints = $derived.by(() => {
		if (!allRows) return { actual: [] as Point[], predicted: [] as Point[] };
		const { data, pred } = allRows;
		const col = data.x[Math.min(plotInput, data.x.length - 1)];
		return {
			actual: thin(
				Array.from(data.y, (y, i) => ({ x: col[i], y })),
				MAX_PLOT_POINTS
			),
			predicted: thin(
				Array.from(pred, (p, i) => ({ x: col[i], y: p })),
				MAX_PLOT_POINTS
			)
		};
	});

	// --- Copy ---
	let copied = $state('');
	async function copy(kind: 'text' | 'latex' | 'python' | 'js') {
		if (!selectedEntry) return;
		const f = { text: toText, latex: toLatex, python: toPython, js: toJavaScript }[kind];
		try {
			await copyToClipboard(f(selectedEntry.expr, frontNames));
			copied = kind;
		} catch {
			copied = '';
		}
	}

	// --- Persistence and URL ---
	const shareState = $derived<ShareState>({
		operators: [...operators],
		target: columns[targetIndex]?.name ?? null,
		inputs: inputIndices.map((i) => columns[i]?.name).filter((n): n is string => !!n),
		timeBudgetSec,
		validationFraction: validationPercent / 100,
		seed,
		workers,
		exampleId
	});

	let shareUrl = $state('');

	$effect(() => {
		const json = JSON.stringify(shareState);
		const params = encodeShareParams(shareState).toString();
		if (!persist.isOpen) return;
		persist.write(SETTINGS_KEY, json);
		const url = untrack(() => new URL(page.url));
		url.search = params;
		shareUrl = url.toString();
		if (routerReady) replaceState(url, {});
	});

	$effect(() => {
		const json = JSON.stringify({ names: frontNames, target: frontTarget, front });
		if (!persist.isOpen || running) return;
		persist.write(FRONT_KEY, json);
	});

	$effect(() => {
		const text = csvText;
		const name = sourceName;
		const example = exampleId;
		if (!persist.isOpen || text === null) return;
		if (example) {
			storage?.removeItem(DATASET_KEY);
			datasetNotSaved = false;
		} else if (canSaveCsv(text)) {
			persist.write(DATASET_KEY, JSON.stringify({ name, csv: text } satisfies SavedDataset));
			datasetNotSaved = false;
		} else {
			storage?.removeItem(DATASET_KEY);
			datasetNotSaved = true;
		}
	});

	function applyShare(s: Partial<ShareState>) {
		if (s.operators) operators = s.operators;
		if (s.timeBudgetSec !== undefined) timeBudgetSec = s.timeBudgetSec;
		if (s.validationFraction !== undefined)
			validationPercent = Math.round(s.validationFraction * 1000) / 10;
		if (s.seed !== undefined) seed = s.seed;
		if (s.workers !== undefined) workers = s.workers;
	}

	function clearAll() {
		engine?.dispose();
		engine = null;
		if (storage) clearSaved(storage);
		// A fresh load resets every piece of state, and nothing is written back until the user acts
		window.location.replace(page.url.pathname);
	}

	onMount(() => {
		workers = defaultWorkerCount();
		const params = page.url.searchParams;
		const fromUrl = hasShareParams(params);
		const share = fromUrl
			? decodeShareParams(params)
			: (readJson<ShareState>(storage, SETTINGS_KEY) ?? {});
		const example = share.exampleId ?? null;
		const savedData = readJson<SavedDataset>(storage, DATASET_KEY);
		if (example) {
			loadExample(example, share);
		} else {
			// Column settings apply to a user CSV only where its names match
			pendingTarget = share.target ?? null;
			pendingInputs = share.inputs ?? null;
			if (!fromUrl && savedData) loadCsv(savedData.csv, savedData.name, null);
		}
		// After the example, so the URL's operators win over the example's
		applyShare(share);
		const savedFront = readJson<{ names: string[]; target: string; front: FrontEntry[] }>(
			storage,
			FRONT_KEY
		);
		if (
			savedFront &&
			savedFront.front.length > 0 &&
			built &&
			savedFront.target === built.targetName &&
			JSON.stringify(savedFront.names) === JSON.stringify(built.inputNames)
		) {
			front = savedFront.front;
			frontNames = savedFront.names;
			frontTarget = savedFront.target;
			selected = recommendedIndex(front);
		}
		persist.open();
		hydrated = true;
		const timer = setTimeout(() => (routerReady = true));
		return () => clearTimeout(timer);
	});

	function fmt(v: number): string {
		return Number.isFinite(v) ? formatNumber(v) : '—';
	}
</script>

<svelte:head>
	<title>Symbolic Regression</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>SYMBOLIC REGRESSION</h1>
		<p class="subtitle">
			Fit compact, interpretable equations to a CSV. Everything runs in your browser.
		</p>
	</header>

	<section class="panel" aria-labelledby="data-heading">
		<h2 id="data-heading">Data</h2>
		<div
			class="dropzone"
			class:dragging
			role="region"
			aria-label="Drop a CSV file here"
			data-testid="dropzone"
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
		>
			<label class="file-label">
				Choose a CSV file
				<input type="file" accept=".csv,.tsv,.txt,text/csv" onchange={onFileInput} />
			</label>
			<span>or drop one here. Comma, semicolon and tab delimiters are detected.</span>
		</div>
		<div class="examples">
			<span>Examples:</span>
			{#each EXAMPLES as ex (ex.id)}
				<button class="btn" onclick={() => loadExample(ex.id)} title={ex.description}
					>{ex.name}</button
				>
			{/each}
		</div>
		{#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
		{#if parsed}
			<p class="status" data-testid="data-status">
				<strong>{sourceName}</strong>: {parsed.rows.length} rows, {parsed.header.length} columns.
				{#if built}
					<span data-testid="dropped">
						{built.droppedRows} row{built.droppedRows === 1 ? '' : 's'} dropped for missing or non-numeric
						values; {built.data.y.length} used.
					</span>
				{/if}
				{#if datasetNotSaved}
					<span class="warn" data-testid="not-saved"
						>This dataset is larger than about 2 MB, so it was not saved in the browser.</span
					>
				{/if}
			</p>
			<div class="columns">
				<label>
					Target
					<select
						value={targetIndex}
						onchange={(e) => setTarget(Number(e.currentTarget.value))}
						data-testid="target"
					>
						{#each columns as c (c.index)}
							<option value={c.index} disabled={!c.numeric}>{c.name}</option>
						{/each}
					</select>
				</label>
				<fieldset data-testid="inputs">
					<legend>Inputs</legend>
					{#each columns as c (c.index)}
						{#if c.index !== targetIndex}
							<label class="check" class:disabled={!c.numeric}>
								<input
									type="checkbox"
									disabled={!c.numeric}
									checked={inputIndices.includes(c.index)}
									onchange={(e) => toggleInput(c.index, e.currentTarget.checked)}
								/>
								{c.name}
							</label>
						{/if}
					{/each}
				</fieldset>
			</div>
		{/if}
	</section>

	<section class="panel" aria-labelledby="settings-heading">
		<h2 id="settings-heading">Settings</h2>
		<fieldset>
			<legend>Operators</legend>
			{#each ALL_OPERATORS as op (op)}
				<label class="check" class:unary={UNARY_OPS.includes(op as never)}>
					<input
						type="checkbox"
						checked={operators.includes(op)}
						onchange={(e) => toggleOperator(op, e.currentTarget.checked)}
						aria-label="Operator {op}"
					/>
					{OPERATOR_LABELS[op]}
				</label>
			{/each}
		</fieldset>
		<div class="settings-grid">
			<label>Time budget (s) <input type="number" min="1" bind:value={timeBudgetSec} /></label>
			<label
				>Validation (%) <input
					type="number"
					min="5"
					max="50"
					bind:value={validationPercent}
				/></label
			>
			<label>Seed <input type="number" step="1" bind:value={seed} /></label>
			<label>Workers <input type="number" min="1" max="16" bind:value={workers} /></label>
		</div>
		<div class="controls">
			<button
				class="btn primary"
				onclick={start}
				disabled={!built || running || operators.length === 0}>Start</button
			>
			<button class="btn" onclick={stop} disabled={!running}>Stop</button>
			<button class="btn" onclick={resume} disabled={!canContinue || running}>Continue</button>
			<span class="progress" data-testid="progress">
				{#if running}Searching…
				{/if}{#if iterations > 0}{iterations} iterations, {(elapsedMs / 1000).toFixed(1)} s{/if}
			</span>
		</div>
		{#if runError}<p class="error" role="alert">{runError}</p>{/if}
	</section>

	{#if front.length > 0}
		<section class="panel" aria-labelledby="results-heading">
			<h2 id="results-heading">Results</h2>
			{#if selectedEntry}
				<div class="equation" data-testid="equation">
					<span class="eq-target">{frontTarget} =</span>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- MathML generated from the tree, names XML-escaped -->
					{@html toMathML(selectedEntry.expr, frontNames)}
				</div>
				<p class="eq-text" data-testid="equation-text">{toText(selectedEntry.expr, frontNames)}</p>
				<div class="copy-row">
					<span>Copy as:</span>
					<button class="btn" onclick={() => copy('text')}>Text</button>
					<button class="btn" onclick={() => copy('latex')}>LaTeX</button>
					<button class="btn" onclick={() => copy('python')}>Python</button>
					<button class="btn" onclick={() => copy('js')}>JavaScript</button>
					{#if copied}<span class="copied" data-testid="copied">Copied {copied}</span>{/if}
				</div>
			{/if}

			<div class="table-wrap">
				<table data-testid="front">
					<thead>
						<tr>
							<th>Complexity</th>
							<th>Equation</th>
							<th>Train MSE</th>
							<th>Val. MSE</th>
							<th>Val. R²</th>
							<th>Val. RMSE</th>
							<th>Score</th>
						</tr>
					</thead>
					<tbody>
						{#each front as f, i (f.complexity)}
							<tr
								class:selected={i === selected}
								class:recommended={i === recommended}
								onclick={() => (selected = i)}
								data-complexity={f.complexity}
							>
								<td
									>{f.complexity}{#if i === recommended}<span class="badge">best</span>{/if}</td
								>
								<td class="mono">{toText(f.expr, frontNames)}</td>
								<td>{fmt(f.trainMse)}</td>
								<td>{fmt(f.valMse)}</td>
								<td data-testid="r2">{fmt(f.valR2)}</td>
								<td>{fmt(f.valRmse)}</td>
								<td>{fmt(f.score)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="plots">
				<ScatterPlot
					title="Pareto front (click to select)"
					testId="pareto-plot"
					points={paretoPoints}
					xLabel="Complexity"
					yLabel="Validation MSE"
					logY
					connect
					selectedId={selected}
					recommendedId={recommended}
					onSelect={(id) => (selected = id)}
				/>
				<ScatterPlot
					title="Predicted vs actual (validation)"
					points={predictedPoints}
					xLabel="Actual {frontTarget}"
					yLabel="Predicted"
					identityLine
				/>
				<ScatterPlot
					title="Residuals (validation)"
					points={residualPoints}
					xLabel="Predicted"
					yLabel="Actual − predicted"
					zeroLine
				/>
				<div>
					<ScatterPlot
						title="{frontTarget} against {frontNames[plotInput] ?? ''}"
						points={inputPoints.actual}
						overlay={inputPoints.predicted}
						xLabel={frontNames[plotInput] ?? ''}
						yLabel={frontTarget}
					/>
					<label class="plot-input"
						>Input
						<select bind:value={plotInput}>
							{#each frontNames as name, i (i)}<option value={i}>{name}</option>{/each}
						</select>
					</label>
				</div>
			</div>
		</section>
	{/if}

	<section class="panel footer-actions">
		<label class="share">
			Share link (settings only, never your data)
			<input type="text" readonly value={shareUrl} data-testid="share-url" />
		</label>
		<button class="btn" onclick={() => copyToClipboard(shareUrl)}>Copy link</button>
		<button class="btn danger" onclick={clearAll}>Clear saved data</button>
	</section>
</div>

<style>
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1rem;
		width: 100%;
	}
	header h1 {
		font-family: 'Orbitron', sans-serif;
		color: var(--futuristic-cyan);
		margin-bottom: 0.25rem;
	}
	.subtitle {
		color: var(--futuristic-text-dim);
		margin-top: 0;
	}
	.panel {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: var(--futuristic-cyan);
	}
	.dropzone {
		border: 2px dashed var(--futuristic-border);
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.dropzone.dragging {
		border-color: var(--futuristic-cyan);
		background: rgba(0, 245, 255, 0.05);
	}
	.file-label input {
		display: block;
		margin-top: 0.25rem;
	}
	.examples,
	.controls,
	.copy-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.btn {
		background: transparent;
		color: var(--futuristic-text);
		border: 1px solid var(--futuristic-border);
		border-radius: 4px;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.9rem;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn.primary {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}
	.btn.danger {
		border-color: #ff5c7a;
		color: #ff5c7a;
	}
	.error {
		color: #ff5c7a;
	}
	.warn {
		color: #ffd84d;
		display: block;
	}
	.status {
		font-size: 0.9rem;
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(12rem, auto) 1fr;
		gap: 1rem;
		align-items: start;
	}
	fieldset {
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
	}
	.check {
		white-space: nowrap;
	}
	.check.disabled {
		opacity: 0.45;
	}
	select,
	input[type='number'],
	input[type='text'] {
		background: var(--futuristic-bg);
		color: var(--futuristic-text);
		border: 1px solid var(--futuristic-border);
		border-radius: 4px;
		padding: 0.25rem 0.4rem;
		font: inherit;
		font-size: 0.9rem;
	}
	.settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.settings-grid label {
		display: flex;
		flex-direction: column;
		font-size: 0.85rem;
	}
	.progress {
		color: var(--futuristic-text-dim);
		font-size: 0.9rem;
	}
	.equation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.4rem;
		overflow-x: auto;
	}
	.eq-text,
	.mono {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
	}
	.copied {
		color: var(--futuristic-cyan);
		font-size: 0.85rem;
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 1rem;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.85rem;
	}
	th,
	td {
		padding: 0.3rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	tbody tr {
		cursor: pointer;
	}
	tr.recommended td:first-child {
		color: #ffd84d;
	}
	tr.selected {
		background: rgba(0, 245, 255, 0.1);
	}
	.badge {
		margin-left: 0.4rem;
		font-size: 0.7rem;
		border: 1px solid #ffd84d;
		border-radius: 3px;
		padding: 0 0.25rem;
	}
	.plots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}
	.plot-input {
		font-size: 0.85rem;
	}
	.footer-actions {
		display: flex;
		gap: 0.75rem;
		align-items: end;
		flex-wrap: wrap;
	}
	.share {
		flex: 1;
		display: flex;
		flex-direction: column;
		font-size: 0.85rem;
	}
	@media (max-width: 640px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
</style>
