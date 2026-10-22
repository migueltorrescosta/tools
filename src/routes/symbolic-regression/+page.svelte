<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { browserStorage, clearSaved, createPersistGate, readJson } from '$lib/persist-gate';
	import { copyToClipboard } from '$lib/clipboard';
	import { EXAMPLES } from '$lib/data/symbolic-regression-examples';
	import { parseCsv, type ParsedCsv } from '$lib/symbolic-regression/csv';
	import {
		analyzeColumns,
		buildDataset,
		canBeCategorical,
		defaultModes,
		inputChoices,
		splitDataset,
		validationIndices
	} from '$lib/symbolic-regression/dataset';
	import { predictionsCsv } from '$lib/symbolic-regression/export';
	import { evaluate } from '$lib/symbolic-regression/expr';
	import {
		toJavaScript,
		toLatex,
		toPython,
		toText,
		formatNumber,
		type Levels
	} from '$lib/symbolic-regression/format';
	import { renderTex } from '$lib/tex';
	import { recommendedIndex } from '$lib/symbolic-regression/front';
	import { WorkerSearchEngine } from '$lib/symbolic-regression/worker-engine';
	import { defaultWorkerCount } from '$lib/worker-pool';
	import {
		DATASET_KEY,
		FRONT_KEY,
		SETTINGS_KEY,
		STORAGE_PREFIX,
		canSaveCsv,
		decodeShareParams,
		encodeShareParams,
		hasShareParams,
		type SavedDataset,
		type ShareState
	} from '$lib/symbolic-regression/state';
	import {
		ALL_OPERATORS,
		CATEGORY_MAX,
		CATEGORY_WARN,
		DEFAULT_OPERATORS,
		DEFAULT_SETTINGS,
		UNARY_OPS,
		type FrontEntry,
		type InputMode,
		type OperatorName,
		type PreparedData
	} from '$lib/symbolic-regression/types';
	import {
		Alert,
		Button,
		Field,
		InfoTip,
		PageHeader,
		Panel,
		SegmentedControl,
		ShareActions
	} from '$lib/ui';
	import Tex from '$lib/ui/Tex.svelte';
	import ScatterPlot from './lib/ScatterPlot.svelte';
	import FrontPlot from './lib/FrontPlot.svelte';
	import { GLOSSARY } from './lib/glossary';
	import { thin, type Point } from '$lib/plot';

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
	/** Plot height in the side column, short enough for all three to fit a 1080p screen. */
	const PLOT_H = 220;

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
	/** How each column (by index) enters the search. */
	let modes = $state<InputMode[]>([]);
	const choices = $derived(inputChoices(modes));

	const built = $derived(
		parsed && targetIndex >= 0 && choices.length > 0
			? buildDataset(parsed, targetIndex, choices)
			: null
	);

	const MODE_LABELS: Record<InputMode, string> = {
		exclude: 'Exclude',
		include: 'Include',
		categorical: 'Categorical'
	};
	function modeOptions(c: (typeof columns)[number]) {
		return (['exclude', 'include', 'categorical'] as const).map((value) => {
			const disabled =
				(value === 'include' && !c.numeric) || (value === 'categorical' && !canBeCategorical(c));
			const title = !disabled
				? undefined
				: value === 'include'
					? 'Not numeric'
					: c.levels > CATEGORY_MAX
						? `More than ${CATEGORY_MAX} distinct values`
						: 'Only one distinct value';
			return { value, label: MODE_LABELS[value], disabled, title };
		});
	}

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
	/** Level names of the front's categorical inputs. */
	let frontLevels = $state.raw<Levels>([]);
	let frontTarget = $state('');
	let selected = $state(-1);
	/** The split the current front was scored on; rebuilt from settings after a reload. */
	let runData = $state.raw<PreparedData | null>(null);
	let runSplit = $state.raw<{ fraction: number; seed: number } | null>(null);

	const recommended = $derived(recommendedIndex(front));
	const selectedEntry = $derived(front[selected] ?? null);

	// Pending column choices from the URL or saved settings, applied when matching data loads
	let pendingTarget: string | null = null;
	let pendingInputs: string[] | null = null;
	let pendingCategorical: string[] | null = null;

	let hydrated = $state(false);
	let routerReady = $state(false);

	const storage = browserStorage();
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
		const fromPending = cols.map((): InputMode => 'exclude');
		for (const name of pendingInputs ?? []) {
			const i = byName(name);
			if (i >= 0 && i !== target) fromPending[i] = 'include';
		}
		for (const name of pendingCategorical ?? []) {
			const c = cols.find((c) => c.name === name);
			if (c && c.index !== target && canBeCategorical(c)) fromPending[c.index] = 'categorical';
		}
		const anyPending = pendingInputs !== null || pendingCategorical !== null;
		modes =
			anyPending && fromPending.some((m) => m !== 'exclude')
				? fromPending
				: defaultModes(cols, target);
		pendingTarget = null;
		pendingInputs = null;
		pendingCategorical = null;
	}

	/** `columns` (from a share URL or saved settings) override the example's own choice. */
	function loadExample(id: string, columns?: Partial<ShareState>) {
		const ex = EXAMPLES.find((e) => e.id === id);
		if (!ex) return;
		pendingTarget = columns?.target ?? ex.target;
		pendingInputs = columns?.inputs ?? ex.inputs;
		pendingCategorical = columns?.categorical ?? ex.categorical ?? [];
		if (ex.operators) operators = [...ex.operators];
		loadCsv(ex.csv, ex.name, ex.id);
		examplesOpen = false;
	}
	let examplesOpen = $state(false);

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
		modes = defaultModes(columns, index);
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
		frontLevels = [];
		selected = -1;
		runData = null;
		runSplit = null;
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
		runSplit = { fraction: settings.validationFraction, seed: settings.seed };
		frontNames = data.inputNames;
		frontLevels = data.levels;
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
	/** The equation hovered or focused in the list or on the Pareto plot; the plots preview it. */
	let previewed = $state<number | null>(null);
	const plotIndex = $derived(previewed !== null && front[previewed] ? previewed : selected);
	const plotEntry = $derived(front[plotIndex] ?? null);

	const plotData = $derived.by(() => {
		const data = runData ?? (built ? splitDataset(built, validationPercent / 100, seed) : null);
		if (!plotEntry || !data) return null;
		const val = data.validation;
		const pred = evaluate(plotEntry.expr, val.x);
		if (!pred) return null;
		return { val, pred };
	});

	let plotInput = $state(0);

	/**
	 * Colour by validation R², shared by the chips and the plot: 0 at R² ≤ 0, 1 at R² = 1,
	 * scaled as 1 − √(1 − R²), the share of the target's standard deviation explained
	 * (1 − RMSE/σ). Mediocre fits separate clearly; 0.99 and 0.9999 look alike.
	 */
	const shades = $derived(
		front.map((f) =>
			Number.isFinite(f.valR2) ? 1 - Math.sqrt(1 - Math.min(1, Math.max(0, f.valR2))) : 0
		)
	);
	/** Red, through orange and yellow, to green. */
	const hue = (t: number) =>
		`color-mix(in oklch, var(--success) ${Math.round(t * 100)}%, var(--danger))`;
	const colors = $derived(shades.map(hue));
	const tints = $derived(shades.map((t) => `color-mix(in oklab, ${hue(t)} 30%, var(--surface))`));
	const equationsTex = $derived(
		front.map((f) => renderTex(toLatex(f.expr, frontNames, frontLevels)))
	);
	const selectedTex = $derived(
		selectedEntry
			? renderTex(
					`${toLatex({ kind: 'var', index: 0 }, [frontTarget])} = ${toLatex(selectedEntry.expr, frontNames, frontLevels)}`,
					true
				)
			: ''
	);
	const METRICS = [
		['trainMse', 'Train MSE'],
		['valMse', 'Validation MSE'],
		['valR2', 'Validation R²'],
		['valRmse', 'Validation RMSE'],
		['score', 'Score']
	] as const;
	const predictedPoints = $derived.by<Point[]>(() => {
		if (!plotData) return [];
		const { val, pred } = plotData;
		return thin(
			Array.from(val.y, (y, i) => ({ x: y, y: pred[i] })),
			MAX_PLOT_POINTS
		);
	});
	/** True while the loaded columns are the ones the front was found on. */
	const columnsMatch = $derived(
		!!built && columnsKey(built.inputNames, built.levels) === columnsKey(frontNames, frontLevels)
	);
	/** Every row, for the target-against-input plot. */
	const allRows = $derived.by(() => {
		if (!plotEntry || !built || !columnsMatch) return null;
		const pred = evaluate(plotEntry.expr, built.data.x);
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

	// --- Download ---
	function downloadCsv() {
		if (!selectedEntry || !parsed || !built || !columnsMatch) return;
		const pred = evaluate(selectedEntry.expr, built.data.x);
		if (!pred) return;
		const split = runSplit ?? { fraction: validationPercent / 100, seed };
		const val = validationIndices(built.data.y.length, split.fraction, split.seed);
		const blob = new Blob([predictionsCsv(parsed, built, pred, val)], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `${sourceName.replace(/\.[^.]*$/, '') || 'data'}-predicted.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	/** Equal for the same inputs coded the same way. */
	function columnsKey(names: string[], levels: Levels): string {
		return JSON.stringify([names, levels]);
	}

	// --- Copy ---
	let copied = $state('');
	async function copy(kind: 'text' | 'latex' | 'python' | 'js') {
		if (!selectedEntry) return;
		const f = { text: toText, latex: toLatex, python: toPython, js: toJavaScript }[kind];
		try {
			await copyToClipboard(f(selectedEntry.expr, frontNames, frontLevels));
			copied = kind;
		} catch {
			copied = '';
		}
	}

	// --- Persistence and URL ---
	const shareState = $derived<ShareState>({
		operators: [...operators],
		target: columns[targetIndex]?.name ?? null,
		inputs: choices
			.filter((c) => !c.categorical)
			.map((c) => columns[c.index]?.name)
			.filter((n): n is string => !!n),
		categorical: choices
			.filter((c) => c.categorical)
			.map((c) => columns[c.index]?.name)
			.filter((n): n is string => !!n),
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
		const json = JSON.stringify({
			names: frontNames,
			levels: frontLevels,
			target: frontTarget,
			front
		});
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
		if (storage) clearSaved(storage, STORAGE_PREFIX);
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
			pendingCategorical = share.categorical ?? null;
			if (!fromUrl && savedData) loadCsv(savedData.csv, savedData.name, null);
		}
		// After the example, so the URL's operators win over the example's
		applyShare(share);
		const savedFront = readJson<{
			names: string[];
			levels?: Levels;
			target: string;
			front: FrontEntry[];
		}>(storage, FRONT_KEY);
		if (
			savedFront &&
			savedFront.front.length > 0 &&
			built &&
			savedFront.target === built.targetName &&
			columnsKey(savedFront.names, savedFront.levels ?? []) ===
				columnsKey(built.inputNames, built.levels)
		) {
			front = savedFront.front;
			frontNames = savedFront.names;
			frontLevels = savedFront.levels ?? [];
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

	const progressText = $derived(
		[
			running ? 'Searching…' : '',
			iterations > 0 ? `${iterations} iterations, ${(elapsedMs / 1000).toFixed(1)} s` : ''
		]
			.filter(Boolean)
			.join(' ')
	);

	/** Announced politely when a search starts or stops, not on every progress tick. */
	const announcement = $derived(
		running
			? 'Searching…'
			: canContinue && selectedEntry
				? `Search stopped with ${front.length} equations. Selected: ${frontTarget} = ${toText(selectedEntry.expr, frontNames, frontLevels)}`
				: ''
	);

	function fmt(v: number): string {
		return Number.isFinite(v) ? formatNumber(v) : '—';
	}
</script>

<div class="container sr-page" data-hydrated={hydrated || undefined}>
	<PageHeader path="/symbolic-regression">
		{#snippet actions()}<ShareActions
				url={shareUrl}
				onClear={clearAll}
				description="settings only, never your data"
			/>{/snippet}
		Fit compact, interpretable equations to a CSV. Everything runs in your browser.</PageHeader
	>

	{#snippet metricsTip(i: number)}
		{@const f = front[i]}
		<div class="tip-eq"><Tex html={equationsTex[i]} /></div>
		<dl class="tip-metrics">
			<dt>Complexity</dt>
			<dd>{f.complexity}</dd>
			{#each METRICS as [key, label] (key)}<dt>{label}</dt>
				<dd>{fmt(f[key])}</dd>{/each}
		</dl>
		{#if i === recommended}<p class="muted">Best: {GLOSSARY.best}</p>{/if}
	{/snippet}

	<div class="layout" class:has-plots={front.length > 0}>
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
					<details class="examples" bind:open={examplesOpen} data-testid="examples">
						<summary>Example datasets</summary>
						<ul>
							{#each EXAMPLES as ex (ex.id)}
								<li>
									<Button size="sm" onclick={() => loadExample(ex.id)}>{ex.name}</Button>
									<span class="muted">{ex.description}</span>
								</li>
							{/each}
						</ul>
					</details>
					{#if loadError}<Alert tone="danger">{loadError}</Alert>{/if}
					{#if parsed}
						<p class="status" data-testid="data-status">
							{#if exampleId}Example dataset{/if}
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
						<fieldset class="columns" data-testid="inputs">
							<legend>
								<span class="legend-row"
									>Inputs <InfoTip label="input modes">{GLOSSARY.inputs}</InfoTip></span
								>
							</legend>
							<div class="column-list">
								{#each columns as c (c.index)}
									{#if c.index !== targetIndex && modes[c.index] !== undefined}
										<div class="column" data-column={c.name}>
											<SegmentedControl
												legend="{c.name} ({c.levels > 1000 ? '1000+' : c.levels} values)"
												options={modeOptions(c)}
												bind:value={modes[c.index]}
											/>
											{#if modes[c.index] === 'categorical' && c.levels > CATEGORY_WARN}
												<p class="warn" data-testid="levels-warning">
													{c.levels} categories: the search over subsets slows down and may overfit. Merge
													rare values if you can.
												</p>
											{/if}
										</div>
									{/if}
								{/each}
							</div>
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
							{#snippet info()}<InfoTip label="validation">{GLOSSARY.validation}</InfoTip>{/snippet}
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
				</div>
			</Panel>
		</div>

		<div class="results">
			<p class="sr-only" role="status">{announcement}</p>
			<Panel title="Results">
				{#snippet actions()}
					<span class="muted" data-testid="progress">
						{progressText}
					</span>
					<Button
						size="sm"
						variant="primary"
						onclick={start}
						disabled={!built || running || operators.length === 0}>Start</Button
					>
					<Button size="sm" variant="danger" onclick={stop} disabled={!running}>Stop</Button>
					<Button size="sm" onclick={resume} disabled={!canContinue || running}>Continue</Button>
				{/snippet}
				{#if runError}<Alert tone="danger">{runError}</Alert>{/if}
				{#if front.length === 0}
					<p class="muted placeholder">
						Load data, pick a target and press Start. The equations found appear here, from the
						simplest to the most accurate.
					</p>
				{:else}
					<div class="stack">
						{#if selectedEntry}
							<div
								class="equation"
								data-testid="equation"
								data-equation={toText(selectedEntry.expr, frontNames, frontLevels)}
							>
								<Tex html={selectedTex} />
							</div>
							<dl class="metrics" data-testid="metrics">
								<div>
									<dt>Complexity <InfoTip label="complexity">{GLOSSARY.complexity}</InfoTip></dt>
									<dd>{selectedEntry.complexity}</dd>
								</div>
								{#each METRICS as [key, label] (key)}
									<div>
										<dt>{label} <InfoTip {label}>{GLOSSARY[key]}</InfoTip></dt>
										<dd data-testid={key === 'valR2' ? 'r2' : undefined}>
											{fmt(selectedEntry[key])}
										</dd>
									</div>
								{/each}
							</dl>
							<div class="cluster copy-row">
								<span class="muted">Copy as</span>
								<Button size="sm" onclick={() => copy('text')}>Text</Button>
								<Button size="sm" onclick={() => copy('latex')}>LaTeX</Button>
								<Button size="sm" onclick={() => copy('python')}>Python</Button>
								<Button size="sm" onclick={() => copy('js')}>JavaScript</Button>
								<Button
									size="sm"
									onclick={downloadCsv}
									disabled={!columnsMatch}
									title={columnsMatch
										? `Every row, with ${frontTarget}_predicted from this equation and the split`
										: 'The loaded columns differ from the ones these equations use'}
									>Download CSV</Button
								>
								<span class="copied" role="status"
									>{#if copied}<span data-testid="copied">Copied {copied}</span>{/if}</span
								>
							</div>
						{/if}

						<div class="front-head">
							<h3>
								Equations by complexity <InfoTip label="complexity">{GLOSSARY.complexity}</InfoTip>
							</h3>
							<span class="r2-legend">
								<span aria-hidden="true">R² 0</span><span class="ramp"></span><span
									aria-hidden="true">1</span
								>
								<InfoTip label="colour">{GLOSSARY.colour}</InfoTip>
							</span>
						</div>
						<ol class="chips" data-testid="front">
							{#each front as f, i (f.complexity)}
								<li>
									<button
										type="button"
										class="chip"
										class:selected={i === selected}
										style:background={tints[i]}
										aria-pressed={i === selected}
										aria-label="Select the equation of complexity {f.complexity}{i === recommended
											? ' (best)'
											: ''}"
										aria-describedby={previewed === i ? 'chip-tip' : undefined}
										data-complexity={f.complexity}
										data-equation={toText(f.expr, frontNames, frontLevels)}
										onclick={() => (selected = i)}
										onmouseenter={() => (previewed = i)}
										onmouseleave={() => (previewed = null)}
										onfocus={() => (previewed = i)}
										onblur={() => (previewed = null)}
										onkeydown={(e) => {
											if (e.key === 'Escape') previewed = null;
										}}
									>
										<span class="complexity">{f.complexity}</span>
										<span class="row-eq" data-testid="row-equation"
											><Tex html={equationsTex[i]} /></span
										>
										{#if i === recommended}<span class="badge" data-testid="best">best</span>{/if}
									</button>
									{#if previewed === i}
										<div
											class="tip chip-tip"
											id="chip-tip"
											role="tooltip"
											data-testid="chip-tooltip"
										>
											{@render metricsTip(i)}
										</div>
									{/if}
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</Panel>
		</div>

		{#if front.length > 0}
			<aside class="plots" aria-label="Plots" data-testid="plots">
				<p class="muted plots-for" data-testid="plots-for">
					{#if plotEntry}Complexity {plotEntry.complexity}{previewed !== null
							? ' (preview)'
							: ''}{/if}
				</p>
				<FrontPlot
					{front}
					{colors}
					{selected}
					{recommended}
					height={PLOT_H}
					highlighted={previewed}
					onSelect={(i) => (selected = i)}
					onHover={(i) => (previewed = i)}
					tooltip={metricsTip}
				/>
				<ScatterPlot
					title="Predicted vs actual (validation)"
					testId="predicted-plot"
					height={PLOT_H}
					points={predictedPoints}
					xLabel="Actual {frontTarget}"
					yLabel="Predicted"
					identityLine
				/>
				<ScatterPlot
					title="{frontTarget} against {frontNames[plotInput] ?? ''}"
					testId="input-plot"
					height={PLOT_H}
					points={inputPoints.actual}
					overlay={inputPoints.predicted}
					pointsLabel="Actual"
					overlayLabel="Predicted"
					xLabel={frontNames[plotInput] ?? ''}
					yLabel={frontTarget}
				>
					{#snippet caption()}
						{frontTarget} against
						<select
							class="control input-select"
							aria-label="Plot against input"
							bind:value={plotInput}
						>
							{#each frontNames as name, i (i)}<option value={i}>{name}</option>{/each}
						</select>
					{/snippet}
				</ScatterPlot>
			</aside>
		{/if}
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
			keeps a Pareto front: the most accurate equation at each complexity. The equation marked
			<strong>best</strong> balances accuracy against simplicity; select any equation or point on the
			Pareto plot to inspect it, or hover one to preview it in the plots. Download CSV saves your data
			with the selected equation's predictions and each row's split. Stop pauses the search and Continue
			resumes it.
		</p>
		<p>
			Your data never leaves the browser. Datasets under about 2 MB and the last results are saved
			in local storage; the share link carries only the settings and, for an example, its name.
		</p>
	</details>
</div>

<style>
	.sr-page {
		max-width: 1920px;
	}
	.layout {
		display: grid;
		gap: var(--sp-3);
		align-items: start;
	}
	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
		}
		.plots {
			grid-column: 2;
		}
	}
	/* Plots in a column of their own, kept in view while the equations scroll */
	@media (min-width: 1400px) {
		.layout.has-plots {
			grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) minmax(360px, 420px);
		}
		.plots {
			grid-column: 3;
			position: sticky;
			top: calc(var(--topbar-h) + var(--sp-2));
			max-height: calc(100vh - var(--topbar-h) - var(--sp-3));
			overflow-y: auto;
		}
	}
	.inputs,
	.results,
	.plots {
		min-width: 0;
	}
	.plots {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.plots-for {
		min-height: 1lh;
	}
	.input-select {
		width: auto;
		max-width: 12rem;
		min-height: var(--control-h-sm);
		padding-block: 0;
		font-size: var(--text-sm);
	}
	.examples summary {
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.examples ul {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: var(--sp-2) 0 0;
		padding: 0;
		list-style: none;
	}
	.examples li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-0);
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
	.columns {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.column-list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		max-height: 24rem;
		overflow-y: auto;
	}
	.columns > legend {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.legend-row {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-0);
	}
	.column :global(legend) {
		font-weight: 400;
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	.column :global(.ui-options label) {
		min-height: var(--control-h-sm);
		padding: 0 var(--sp-2);
		font-size: var(--text-sm);
	}
	.warn {
		margin-top: var(--sp-1);
		font-size: var(--text-xs);
		color: var(--warning-text);
	}
	.metrics {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-4);
		margin: 0;
		font-size: var(--text-sm);
	}
	.metrics dt {
		display: flex;
		align-items: center;
		color: var(--text-muted);
		font-size: var(--text-xs);
	}
	.metrics dd {
		margin: 0;
		font-family: var(--font-mono);
	}
	.front-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--sp-1);
	}
	.front-head h3 {
		display: inline-flex;
		align-items: center;
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.r2-legend {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.ramp {
		width: 4rem;
		height: 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: linear-gradient(
			in oklch to right,
			color-mix(in oklab, var(--danger) 30%, var(--surface)),
			color-mix(in oklab, var(--success) 30%, var(--surface))
		);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips li {
		position: relative;
		min-width: 0;
		max-width: 100%;
	}
	.chip {
		font-size: var(--text-sm);
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		max-width: 100%;
		min-height: 32px;
		padding: var(--sp-0) var(--sp-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-align: left;
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--border-strong);
	}
	.chip.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.complexity {
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.row-eq {
		min-width: 0;
		overflow: auto hidden;
	}
	.tip {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 10;
		width: max-content;
		max-width: min(22rem, 90vw);
		padding: var(--sp-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
		font-size: var(--text-xs);
		pointer-events: none;
	}
	.tip-eq {
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
	}
	.tip-metrics {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 var(--sp-2);
		margin: 0;
	}
	.tip-metrics dt {
		color: var(--text-muted);
	}
	.tip-metrics dd {
		margin: 0;
		font-family: var(--font-mono);
		text-align: right;
	}
	.tip-metrics + p {
		margin-top: var(--sp-1);
		max-width: 18rem;
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
</style>
