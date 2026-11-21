<script lang="ts">
	import { onMount } from 'svelte';
	import { browserStorage, clearSaved, readJson } from '#lib/persist-gate.js';
	import {
		Alert,
		Button,
		DataTable,
		Fold,
		PageHeader,
		Panel,
		References,
		Select,
		ShareActions,
		type Column
	} from '#lib/ui/index.js';
	import { dotRows, heatMap, scoreAll } from '#lib/implicit-association/history.js';
	import { PRESETS, title } from '#lib/implicit-association/presets.js';
	import { band, score } from '#lib/implicit-association/score.js';
	import {
		CUSTOM_KEY,
		decodeShare,
		encodeShare,
		isWordOnly,
		merge,
		parseBackup,
		RUNS_KEY,
		type Backup
	} from '#lib/implicit-association/storage.js';
	import type { Comparison, Run } from '#lib/implicit-association/types.js';
	import Builder from './lib/Builder.svelte';
	import DotPlot from './lib/DotPlot.svelte';
	import HeatMap from './lib/HeatMap.svelte';
	import Runner from './lib/Runner.svelte';
	import Scale from './lib/Scale.svelte';
	import { REFERENCES } from './lib/references.js';

	const PREFIX = 'implicit-association:';
	let hydrated = $state(false);
	let runs: Run[] = $state([]);
	let custom: Comparison[] = $state([]);
	let selectedId = $state(PRESETS[0].id);
	let mode: 'pick' | 'build' | 'run' = $state('pick');
	let last: Run | undefined = $state();
	let storageError = $state('');
	let importMessage = $state('');
	let importInput: HTMLInputElement | undefined = $state();
	/** Bumped for every new run, so the runner remounts with a fresh plan. */
	let runKey = $state(0);

	const comparisons = $derived([...PRESETS, ...custom]);
	const selected = $derived(comparisons.find((c) => c.id === selectedId) ?? PRESETS[0]);
	const options = $derived(
		comparisons.map((c) => ({ value: c.id, label: (c.custom ? 'Yours: ' : '') + title(c) }))
	);
	const scored = $derived(scoreAll(runs));
	const rows = $derived(dotRows(scored));
	const map = $derived(heatMap(scored));
	const lastScore = $derived(last && score(last.responses, last.firstFocal));

	const shareHash = $derived(
		!selected.custom ? `p=${selected.id}` : isWordOnly(selected) ? `c=${encodeShare(selected)}` : ''
	);
	let origin = $state('');
	const shareUrl = $derived(`${origin}/implicit-association${shareHash ? `#${shareHash}` : ''}`);

	function save() {
		const storage = browserStorage();
		if (!storage) return;
		try {
			storage.setItem(RUNS_KEY, JSON.stringify(runs));
			storage.setItem(CUSTOM_KEY, JSON.stringify(custom));
			storageError = '';
		} catch {
			storageError =
				'Your browser storage is full. Export your history, then remove some image comparisons.';
		}
	}

	function addCustom(c: Comparison) {
		if (!custom.some((x) => x.id === c.id)) custom = [...custom, c];
		selectedId = c.id;
	}

	function readHash() {
		const params = new URLSearchParams(location.hash.slice(1));
		const preset = params.get('p');
		const code = params.get('c');
		if (preset && PRESETS.some((p) => p.id === preset)) selectedId = preset;
		else if (code) {
			const shared = decodeShare(code);
			if (shared) {
				addCustom(shared);
				save();
			}
		}
	}

	onMount(() => {
		origin = location.origin;
		const storage = browserStorage();
		runs = readJson<Run[]>(storage, RUNS_KEY) ?? [];
		custom = readJson<Comparison[]>(storage, CUSTOM_KEY) ?? [];
		readHash();
		hydrated = true;
	});

	function start() {
		last = undefined;
		runKey += 1;
		mode = 'run';
	}

	function finish(run: Run) {
		runs = [...runs, run];
		last = run;
		mode = 'pick';
		save();
	}

	function created(c: Comparison) {
		addCustom(c);
		mode = 'pick';
		save();
	}

	function clearAll() {
		const storage = browserStorage();
		if (storage) clearSaved(storage, PREFIX);
		runs = [];
		custom = [];
		last = undefined;
		selectedId = PRESETS[0].id;
	}

	function exportJson() {
		const backup: Backup = { version: 1, runs, custom };
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(backup)], { type: 'application/json' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = `implicit-association-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importJson(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		const backup = parseBackup(await file.text());
		if (!backup) {
			importMessage = 'That file is not an export from this tool.';
			return;
		}
		const before = runs.length;
		const merged = merge({ version: 1, runs, custom }, backup);
		runs = merged.runs;
		custom = merged.custom;
		save();
		importMessage = `Added ${runs.length - before} run${runs.length - before === 1 ? '' : 's'}.`;
	}

	const fmt = (d: number) => (d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2));
	const BAND_WORD = { none: '', slight: 'Slight', moderate: 'Moderate', strong: 'Strong' } as const;

	type TableRow = {
		id: string;
		date: string;
		comparison: string;
		input: string;
		d: string;
		counted: string;
	};
	const tableRows = $derived(
		[...scored].reverse().map((s): TableRow => ({
			id: s.run.id,
			date: new Date(s.run.date).toLocaleString(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short'
			}),
			comparison: `${s.run.labels.targets.join(' / ')} × ${s.run.labels.attributes.join(' / ')}`,
			input: s.run.input === 'touch' ? 'Touch' : 'Keyboard',
			d: fmt(s.score.d),
			counted: s.score.flagged ? 'No: too fast' : 'Yes'
		}))
	);
	const columns: Column<TableRow>[] = [
		{ key: 'date', label: 'Date' },
		{ key: 'comparison', label: 'Comparison' },
		{ key: 'input', label: 'Input' },
		{ key: 'd', label: 'D', align: 'right' },
		{ key: 'counted', label: 'Counted' }
	];
</script>

<PageHeader path="/implicit-association">
	{#snippet actions()}
		<ShareActions url={shareUrl} onClear={clearAll} description="this comparison" />
	{/snippet}
</PageHeader>

<div class="container" data-hydrated={hydrated || undefined}>
	{#if mode === 'run'}
		<Panel title={title(selected)}>
			{#key runKey}
				<Runner comparison={selected} onfinish={finish} oncancel={() => (mode = 'pick')} />
			{/key}
		</Panel>
	{:else if mode === 'build'}
		<Panel title="New comparison">
			<Builder oncreate={created} oncancel={() => (mode = 'pick')} />
		</Panel>
	{:else}
		<Panel title="Take a test">
			<div class="pick">
				<Select label="Comparison" {options} bind:value={selectedId} />
				<div class="actions">
					<Button variant="primary" onclick={start}>Start</Button>
					<Button variant="link" onclick={() => (mode = 'build')}>New comparison</Button>
				</div>
				<p class="muted">
					Sort words and faces with the E and I keys, or tap on a phone. It takes about 2 minutes.
				</p>
			</div>
		</Panel>

		{#if last && lastScore}
			<Panel title="Your result">
				<div class="result" data-testid="result">
					{#if lastScore.flagged}
						<Alert tone="warning">
							More than 1 in 10 answers came in under 0.3 seconds, so this run doesn't count in your
							averages. Slow down a little.
						</Alert>
					{/if}
					{#if band(lastScore.d) === 'none'}
						<p class="headline">
							No clear association <span class="d">D = {fmt(lastScore.d)}</span>
						</p>
					{:else}
						{@const first = lastScore.d > 0 ? 0 : 1}
						<p class="headline">
							{BAND_WORD[band(lastScore.d)]} association of {last.labels.targets[first]} with {last
								.labels.attributes[0]}, compared with {last.labels.targets[1 - first]}
							<span class="d">D = {fmt(lastScore.d)}</span>
						</p>
					{/if}
					<Scale d={lastScore.d} labels={last.labels} />
					<p class="muted">One run is noisy. Your average over several runs is a better read.</p>
				</div>
			</Panel>
		{/if}
	{/if}

	{#if storageError}<Alert tone="danger">{storageError}</Alert>{/if}

	<Panel title="Your results">
		{#if scored.length === 0}
			<p class="muted">
				Your results appear here after your first test. They stay in this browser.
			</p>
		{:else}
			<div class="charts">
				<section aria-labelledby="by-comparison">
					<h3 id="by-comparison">By comparison</h3>
					<DotPlot {rows} />
				</section>
				{#if map.rows.length}
					<section aria-labelledby="overview">
						<h3 id="overview">Overview</h3>
						<HeatMap {map} />
					</section>
				{/if}
				<Fold label="All runs" summary={String(scored.length)}>
					<DataTable
						caption="All runs"
						hideCaption
						{columns}
						rows={tableRows}
						rowKey={(r) => r.id}
					/>
				</Fold>
			</div>
		{/if}
		<div class="backup">
			{#if scored.length}<Button size="sm" onclick={exportJson}>Export</Button>{/if}
			<Button size="sm" onclick={() => importInput?.click()}>Import</Button>
			<input
				bind:this={importInput}
				hidden
				type="file"
				accept="application/json,.json"
				aria-label="Import file"
				onchange={(e) => importJson(e.currentTarget.files)}
			/>
			{#if importMessage}<span class="muted" role="status">{importMessage}</span>{/if}
		</div>
	</Panel>

	<Fold label="About this test" boxed>
		<div class="about">
			<p>
				This is a Brief Implicit Association Test. It measures how much faster you sort when two
				categories share a key. A positive D means the first group goes with the first attribute
				more easily.
			</p>
			<p>
				Single scores move a lot between runs, so a result says little about one person. Take a test
				several times and look at your average.
			</p>
			<p>
				Faces: Face Research Lab London Set by Lisa DeBruine and Benedict Jones, <a
					href="https://doi.org/10.6084/m9.figshare.5047666.v5"
					target="_blank"
					rel="noreferrer">CC BY 4.0</a
				>, cropped.
			</p>
		</div>
		<References references={REFERENCES} />
	</Fold>
</div>

<style>
	.container {
		display: grid;
		gap: var(--sp-4);
	}
	.pick {
		display: grid;
		gap: var(--sp-3);
		max-width: 36rem;
	}
	.actions,
	.backup {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-3);
	}
	.backup {
		margin-top: var(--sp-3);
	}
	.muted {
		color: var(--text-muted);
	}
	.result {
		display: grid;
		gap: var(--sp-3);
	}
	.headline {
		font-size: var(--text-xl);
		font-weight: 600;
	}
	.d {
		display: block;
		font-size: var(--text-md);
		font-weight: 400;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.charts {
		display: grid;
		gap: var(--sp-4);
	}
	h3 {
		font-size: var(--text-md);
		font-weight: 600;
		margin-bottom: var(--sp-2);
	}
	.about {
		display: grid;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
	}
</style>
