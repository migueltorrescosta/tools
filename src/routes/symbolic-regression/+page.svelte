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
	import { Alert, Button, Field, PageHeader, Panel } from '$lib/ui';
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
	/** The settings a fresh page starts with; set in onMount. */
	let defaultSettingsJson = '';
	/** False until the settings leave their defaults, so a fresh or cleared page writes nothing. */
	let settingsTouched = false;

	$effect(() => {
		const json = JSON.stringify(shareState);
		const params = encodeShareParams(shareState).toString();
		if (!persist.isOpen) return;
		const url = untrack(() => new URL(page.url));
		url.search = params;
		shareUrl = url.toString();
		if (json !== defaultSettingsJson) settingsTouched = true;
		if (!settingsTouched) return;
		persist.write(SETTINGS_KEY, json);
		if (routerReady) replaceState(url, {});
	});

	$effect(() => {
		const json = JSON.stringify({ names: frontNames, target: frontTarget, front });
		if (!persist.isOpen || running) return;
		if (front.length === 0) storage?.removeItem(FRONT_KEY);
		else persist.write(FRONT_KEY, json);
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
		defaultSettingsJson = JSON.stringify(shareState);
		const params = page.url.searchParams;
		const fromUrl = hasShareParams(params);
		settingsTouched = fromUrl || readJson(storage, SETTINGS_KEY) !== null;
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
		// A macrotask runs after SvelteKit starts the router; e2e tests wait for hydrated
		const timer = setTimeout(() => {
			routerReady = true;
			hydrated = true;
		});
		return () => clearTimeout(timer);
	});

	/** Announced politely when a search starts or stops, not on every progress tick. */
	const announcement = $derived(
		running
			? 'Searching…'
			: canContinue && selectedEntry
				? `Search stopped with ${front.length} equations. Selected: ${frontTarget} = ${toText(selectedEntry.expr, frontNames)}`
				: ''
	);

	function fmt(v: number): string {
		return Number.isFinite(v) ? formatNumber(v) : '—';
	}
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/symbolic-regression"
		>Fit compact, interpretable equations to a CSV. Everything runs in your browser.</PageHeader
	>

	<div class="layout">
		<div class="stack inputs">
			<Panel title="Data">
				<div class="stack">
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
							Choose a CSV file, or drop one here
							<input type="file" accept=".csv,.tsv,.txt,text/csv" onchange={onFileInput} />
						</label>
					</div>
					<div class="cluster">
						<span class="muted">Examples</span>
						{#each EXAMPLES as ex (ex.id)}
							<Button size="sm" onclick={() => loadExample(ex.id)} title={ex.description}
								>{ex.name}</Button
							>
						{/each}
					</div>
					{#if loadError}<Alert tone="danger">{loadError}</Alert>{/if}
					{#if parsed}
						<p class="status" data-testid="data-status">
							<strong>{sourceName}</strong>: {parsed.rows.length} rows, {parsed.header.length} columns.
							{#if built}
								<span data-testid="dropped">
									{built.droppedRows} row{built.droppedRows === 1 ? '' : 's'} dropped for missing or non-numeric
									values; {built.data.y.length} used.
								</span>
							{/if}
						</p>
						{#if datasetNotSaved}
							<div data-testid="not-saved">
								<Alert tone="warning"
									>This dataset is larger than about 2 MB, so it was not saved in the browser.</Alert
								>
							</div>
						{/if}
						<Field label="Target">
							{#snippet children(props)}
								<select
									class="control"
									{...props}
									value={targetIndex}
									onchange={(e) => setTarget(Number(e.currentTarget.value))}
									data-testid="target"
								>
									{#each columns as c (c.index)}
										<option value={c.index} disabled={!c.numeric}>{c.name}</option>
									{/each}
								</select>
							{/snippet}
						</Field>
						<fieldset class="checks" data-testid="inputs">
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
					{/if}
				</div>
			</Panel>

			<Panel title="Settings">
				<div class="stack">
					<fieldset class="checks">
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
						<Field label="Time budget (s)">
							{#snippet children(props)}
								<input
									class="control"
									type="number"
									min="1"
									bind:value={timeBudgetSec}
									{...props}
								/>
							{/snippet}
						</Field>
						<Field label="Validation (%)">
							{#snippet children(props)}
								<input
									class="control"
									type="number"
									min="5"
									max="50"
									bind:value={validationPercent}
									{...props}
								/>
							{/snippet}
						</Field>
						<Field label="Seed">
							{#snippet children(props)}
								<input class="control" type="number" step="1" bind:value={seed} {...props} />
							{/snippet}
						</Field>
						<Field label="Workers">
							{#snippet children(props)}
								<input
									class="control"
									type="number"
									min="1"
									max="16"
									bind:value={workers}
									{...props}
								/>
							{/snippet}
						</Field>
					</div>
					<div class="cluster">
						<Button
							variant="primary"
							onclick={start}
							disabled={!built || running || operators.length === 0}>Start</Button
						>
						<Button variant="danger" onclick={stop} disabled={!running}>Stop</Button>
						<Button onclick={resume} disabled={!canContinue || running}>Continue</Button>
						<span class="muted" data-testid="progress">
							{#if running}Searching…
							{/if}{#if iterations > 0}{iterations} iterations, {(elapsedMs / 1000).toFixed(1)} s{/if}
						</span>
					</div>
					{#if runError}<Alert tone="danger">{runError}</Alert>{/if}
				</div>
			</Panel>
		</div>

		<div class="results">
			<p class="sr-only" role="status">{announcement}</p>
			<Panel title="Results">
				{#if front.length === 0}
					<p class="muted placeholder">
						Load data, pick a target and press Start. The equations found appear here, from the
						simplest to the most accurate.
					</p>
				{:else}
					<div class="stack">
						{#if selectedEntry}
							<div class="equation" data-testid="equation">
								<span class="eq-target">{frontTarget} =</span>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- MathML generated from the tree, names XML-escaped -->
								{@html toMathML(selectedEntry.expr, frontNames)}
							</div>
							<p class="mono eq-text" data-testid="equation-text">
								{toText(selectedEntry.expr, frontNames)}
							</p>
							<div class="cluster copy-row">
								<span class="muted">Copy as</span>
								<Button size="sm" onclick={() => copy('text')}>Text</Button>
								<Button size="sm" onclick={() => copy('latex')}>LaTeX</Button>
								<Button size="sm" onclick={() => copy('python')}>Python</Button>
								<Button size="sm" onclick={() => copy('js')}>JavaScript</Button>
								<span class="copied" role="status"
									>{#if copied}<span data-testid="copied">Copied {copied}</span>{/if}</span
								>
							</div>
						{/if}

						<div class="table-wrap">
							<table data-testid="front">
								<caption class="sr-only"
									>Pareto front: one equation per complexity. Select a row to show it.</caption
								>
								<thead>
									<tr>
										<th scope="col">Complexity</th>
										<th scope="col">Equation</th>
										<th scope="col" class="num">Train MSE</th>
										<th scope="col" class="num">Val. MSE</th>
										<th scope="col" class="num">Val. R²</th>
										<th scope="col" class="num">Val. RMSE</th>
										<th scope="col" class="num">Score</th>
									</tr>
								</thead>
								<tbody>
									{#each front as f, i (f.complexity)}
										<tr
											class:selected={i === selected}
											onclick={() => (selected = i)}
											data-complexity={f.complexity}
										>
											<td>
												<Button
													size="sm"
													variant="ghost"
													pressed={i === selected}
													aria-label="Select the equation of complexity {f.complexity}"
													>{f.complexity}</Button
												>{#if i === recommended}<span class="badge" data-testid="best">best</span
													>{/if}
											</td>
											<td class="mono" data-testid="row-equation">{toText(f.expr, frontNames)}</td>
											<td class="num">{fmt(f.trainMse)}</td>
											<td class="num">{fmt(f.valMse)}</td>
											<td class="num" data-testid="r2">{fmt(f.valR2)}</td>
											<td class="num">{fmt(f.valRmse)}</td>
											<td class="num">{fmt(f.score)}</td>
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
							<div class="stack input-plot">
								<ScatterPlot
									title="{frontTarget} against {frontNames[plotInput] ?? ''}"
									points={inputPoints.actual}
									overlay={inputPoints.predicted}
									pointsLabel="Actual"
									overlayLabel="Predicted"
									xLabel={frontNames[plotInput] ?? ''}
									yLabel={frontTarget}
								/>
								<Field label="Plot against input">
									{#snippet children(props)}
										<select class="control" {...props} bind:value={plotInput}>
											{#each frontNames as name, i (i)}<option value={i}>{name}</option>{/each}
										</select>
									{/snippet}
								</Field>
							</div>
						</div>
					</div>
				{/if}
			</Panel>
		</div>
	</div>

	<div class="share">
		<Panel title="Share and saved data">
			<div class="share-row">
				<Field label="Share link (settings only, never your data)">
					{#snippet children(props)}
						<input
							class="control"
							type="text"
							readonly
							value={shareUrl}
							data-testid="share-url"
							{...props}
						/>
					{/snippet}
				</Field>
				<div class="cluster">
					<Button onclick={() => copyToClipboard(shareUrl)}>Copy link</Button>
					<Button variant="danger" onclick={clearAll}>Clear saved data</Button>
				</div>
			</div>
		</Panel>
	</div>

	<details class="how">
		<summary>How it works</summary>
		<p>
			Load a CSV (comma, semicolon and tab delimiters are detected), pick the column to predict and
			the inputs to use. Rows with missing or non-numeric values are dropped. A random share of the
			rows, set by Validation (%), is held back to score each equation.
		</p>
		<p>
			A genetic search runs on Web Workers for the time budget, combining the chosen operators. It
			keeps a Pareto front: the most accurate equation at each complexity. The row marked
			<strong>best</strong> balances accuracy against simplicity; select any row or point on the Pareto
			plot to inspect it. Stop pauses the search and Continue resumes it.
		</p>
		<p>
			Your data never leaves the browser. Datasets under about 2 MB and the last results are saved
			in local storage; the share link carries only the settings and, for an example, its name.
		</p>
	</details>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--sp-3);
		align-items: start;
	}
	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
		}
	}
	.inputs,
	.results {
		min-width: 0;
	}
	.share {
		margin-top: var(--sp-3);
	}
	.muted {
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	p {
		margin: 0;
	}
	.dropzone {
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius);
		padding: var(--sp-2) var(--sp-3);
		background: var(--sunken);
	}
	.dropzone.dragging {
		border-color: var(--accent);
		border-style: solid;
		background: var(--accent-bg);
	}
	.file-label {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.file-label input {
		max-width: 100%;
		min-height: 24px;
	}
	.status {
		font-size: var(--text-sm);
	}
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.checks legend {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: 28px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: var(--text-sm);
		white-space: nowrap;
		cursor: pointer;
	}
	.check:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-bg);
	}
	.check input {
		margin: 0;
		accent-color: var(--accent);
	}
	.check.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.settings-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-2) var(--sp-3);
	}
	.placeholder {
		padding: var(--sp-4) 0;
	}
	.equation {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--text-xl);
		overflow-x: auto;
	}
	.eq-target {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.eq-text {
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}
	.copy-row {
		--gap: var(--sp-1);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.copied {
		margin-left: var(--sp-1);
		font-size: var(--text-sm);
		color: var(--success-text);
	}
	.table-wrap {
		max-height: 18rem;
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: var(--text-sm);
	}
	th,
	td {
		height: 32px;
		padding: var(--sp-0) var(--sp-2);
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--border);
	}
	th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--surface-2);
		color: var(--text-muted);
		font-weight: 600;
	}
	.num {
		text-align: right;
	}
	td.mono {
		min-width: 14rem;
		white-space: normal;
		overflow-wrap: anywhere;
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: var(--surface-2);
	}
	tr.selected {
		background: var(--accent-bg);
		box-shadow: inset 3px 0 0 var(--accent);
	}
	tr.selected:hover {
		background: var(--accent-bg);
	}
	.badge {
		margin-left: var(--sp-1);
		padding: 0 var(--sp-1);
		border: 1px solid var(--warning);
		border-radius: var(--radius-sm);
		color: var(--warning-text);
		background: var(--warning-bg);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.plots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: var(--sp-3);
	}
	.input-plot {
		--gap: var(--sp-2);
	}
	.share-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-3);
		align-items: end;
	}
	.share-row > :global(:first-child) {
		flex: 1 1 20rem;
	}
</style>
