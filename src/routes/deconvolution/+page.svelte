<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import {
		Alert,
		Button,
		DataTable,
		Field,
		InfoTip,
		PageHeader,
		Panel,
		References,
		RunControls,
		SegmentedControl,
		ShareActions,
		type Column
	} from '$lib/ui';
	import { browserStorage, clearSaved, createPersistGate, readJson } from '$lib/persist-gate';
	import { dataColour } from '$lib/plot';
	import { makeDist } from '$lib/deconvolution/dist';
	import { FAMILIES, family, validateParams } from '$lib/deconvolution/families';
	import {
		chooseGrid,
		gridPoints,
		modelWindow,
		zAtoms,
		zDensityOnGrid
	} from '$lib/deconvolution/grid';
	import { bands, histogram, simulate } from '$lib/deconvolution/sample';
	import { parseSample, sampleCsv, type ParsedSample } from '$lib/deconvolution/upload';
	import { supportGrid } from '$lib/deconvolution/npmle';
	import { truthOnGrid, l1, wasserstein1 } from '$lib/deconvolution/metrics';
	import {
		unavailable,
		type GridMethod,
		type GridOptions,
		type GridResult
	} from '$lib/deconvolution/estimate';
	import { EstimatePool, StoppedError } from '$lib/deconvolution/engine';
	import type { MleResult } from '$lib/deconvolution/mle';
	import {
		AUTOSAVE_KEY,
		HASH_PARAM,
		MAX_BOOTSTRAP,
		MAX_N,
		METHODS,
		MIN_N,
		PRESETS,
		STORAGE_PREFIX,
		decodeSettings,
		encodeSettings,
		parseSettings,
		presetSettings,
		type Settings
	} from '$lib/deconvolution/state';
	import type { Dist, DistSpec, FamilyId, Grid, MethodId } from '$lib/deconvolution/types';
	import DistEditor from './lib/DistEditor.svelte';
	import DensityChart, { type Curve, type Stems, type Band } from './lib/DensityChart.svelte';
	import { REFERENCES } from './lib/references';

	const METHOD_NAMES: Record<MethodId, string> = {
		mle: 'Parametric MLE',
		npmle: 'NPMLE (grid)',
		gmodel: 'g-modeling',
		kernel: 'Kernel deconvolution',
		gmm: 'Gaussian mixture'
	};
	const METHOD_HINTS: Record<MethodId, string> = {
		mle: 'Fits the chosen families by maximum likelihood.',
		npmle: 'Any X on a grid, no tuning. Gives point masses.',
		gmodel: 'A smooth X from a penalised spline family.',
		kernel: 'The classic Fourier estimator. Slow to converge under normal noise.',
		gmm: 'X as a mix of 1–6 normals, picked by BIC. Normal noise only.'
	};
	const methodColour = (m: MethodId) => dataColour(METHODS.indexOf(m) + 1);

	let settings = $state<Settings>(presetSettings());

	// --- Model ---
	const specErrors = (spec: DistSpec) =>
		spec.family === 'mixture'
			? spec.components.some((c) => validateParams(c.family, c.params).length || !(c.weight > 0))
			: validateParams(spec.family, spec.params).length > 0;
	const nValid = $derived(
		Number.isInteger(settings.n) && settings.n >= MIN_N && settings.n <= MAX_N
	);
	const seedValid = $derived(Number.isInteger(settings.seed) && settings.seed >= 0);
	const modelValid = $derived(!specErrors(settings.x) && !specErrors(settings.y));

	const built = $derived.by((): { X: Dist; Y: Dist } | null => {
		if (!modelValid) return null;
		try {
			return {
				X: makeDist($state.snapshot(settings.x) as DistSpec, 'signal'),
				Y: makeDist($state.snapshot(settings.y), 'noise')
			};
		} catch {
			return null;
		}
	});
	const sample = $derived(
		built && nValid && seedValid ? simulate(built.X, built.Y, settings.n, settings.seed) : null
	);

	/** Curves or stems for one distribution on the chart's grid. */
	function marks(d: Dist, grid: Grid, key: string, label: string, colour: string, dashed = false) {
		if (d.pdf) {
			const xs = gridPoints(grid);
			return { curve: { key, label, colour, xs, ys: xs.map((x) => d.pdf!(x)), dashed } as Curve };
		}
		return { stems: { key, label, colour, x: d.atoms.x, p: d.atoms.p } as Stems };
	}

	const modelView = $derived.by(() => {
		if (!built) return null;
		const { X, Y } = built;
		const [zl, zh] = modelWindow(X, Y, 1e-3);
		const [yl, yh] = Y.range(1e-3);
		const lo = Math.min(zl, yl);
		const hi = Math.max(zh, yh);
		const grid = chooseGrid(lo, hi, X, Y, { baseNodes: 1024, maxNodes: 8192 });
		const curves: Curve[] = [];
		const stems: Stems[] = [];
		for (const m of [
			marks(X, grid, 'x', 'Signal X', dataColour(0)),
			marks(Y, grid, 'y', 'Noise Y', dataColour(3), true)
		]) {
			if (m.curve) curves.push(m.curve);
			if (m.stems) stems.push(m.stems);
		}
		if (X.pdf === null && Y.pdf === null) {
			const a = zAtoms(X, Y);
			stems.push({ key: 'z', label: 'Observed Z', colour: dataColour(2), x: a.x, p: a.p });
		} else {
			curves.push({
				key: 'z',
				label: 'Observed Z',
				colour: dataColour(2),
				xs: gridPoints(grid),
				ys: zDensityOnGrid(X, Y, grid)
			});
		}
		const bins = sample ? Math.round(Math.min(80, Math.max(20, Math.sqrt(sample.length)))) : 0;
		return {
			range: [lo, hi] as [number, number],
			curves,
			stems,
			histogram: sample ? histogram(sample, zl, zh, bins) : undefined
		};
	});

	function applyPreset(id: string) {
		const p = presetSettings(id);
		settings.x = p.x;
		settings.y = p.y;
		settings.fitNoise = p.fitNoise;
		settings.noiseFor = p.noiseFor;
	}

	function download(name: string, text: string) {
		const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}

	// --- Data ---
	let uploadText = $state('');
	let uploaded = $state<ParsedSample | null>(null);
	let uploadName = $state('');

	function parseUpload(text: string, name = '') {
		uploadText = text;
		uploadName = name;
		uploaded = text.trim() ? parseSample(text) : null;
	}
	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 10 * 1024 * 1024) {
			uploaded = {
				dim: 1,
				data: new Float64Array(0),
				data2: new Float64Array(0),
				header: false,
				invalid: [],
				invalidCount: 0,
				error: 'The file is larger than 10 MB.'
			};
			return;
		}
		parseUpload(await file.text(), file.name);
	}

	const data = $derived(
		settings.source === 'simulated' ? sample : uploaded && !uploaded.error ? uploaded.data : null
	);
	const truth = $derived(settings.source === 'simulated' ? built?.X : undefined);

	// --- Methods ---
	const reasons = $derived(
		Object.fromEntries(
			METHODS.map((m) => [m, unavailable(m, $state.snapshot(settings.y))])
		) as Record<MethodId, string | null>
	);
	const chosen = $derived(settings.methods.filter((m) => !reasons[m]));
	function toggle(m: MethodId, on: boolean) {
		settings.methods = on
			? [...new Set([...settings.methods, m])].sort(
					(a, b) => METHODS.indexOf(a) - METHODS.indexOf(b)
				)
			: settings.methods.filter((x) => x !== m);
	}
	const usesFitted = $derived(
		settings.noiseFor === 'fitted' && settings.fitNoise && chosen.some((m) => m !== 'mle')
	);

	// --- Running ---
	let pool: EstimatePool | null = null;
	const getPool = () =>
		(pool ??= new EstimatePool(
			() =>
				new Worker(new URL('$lib/deconvolution/estimate.worker.ts', import.meta.url), {
					type: 'module'
				})
		));

	interface Run {
		data: Float64Array;
		truth: Dist | undefined;
		grid: Grid;
		mle: MleResult | null;
		grids: GridResult[];
		failures: { method: MethodId; message: string }[];
		noise: DistSpec;
		options: GridOptions;
		ms: number;
	}
	let run = $state.raw<Run | null>(null);
	let running = $state(false);
	let runError = $state('');

	const canRun = $derived(!!data && modelValid && chosen.length > 0 && !running);

	async function start() {
		if (!data || !canRun) return;
		running = true;
		runError = '';
		const t0 = performance.now();
		const snap = $state.snapshot(settings) as Settings;
		const d = data;
		// Everything the run reads, fixed now: the inputs stay editable while it fits.
		const methods = [...chosen];
		const gridMethods = methods.filter((m) => m !== 'mle') as GridMethod[];
		const fitted = usesFitted;
		const runTruth = snap.source === 'simulated' ? truth : undefined;
		const options = { df: snap.df, c0: snap.c0, bandwidth: snap.bandwidth, seed: snap.seed };
		const grid = supportGrid(d, 300);
		const failures: Run['failures'] = [];
		const p = getPool();
		try {
			let mle: MleResult | null = null;
			if (methods.includes('mle') || fitted) {
				try {
					const r = await p.run({
						kind: 'mle',
						input: {
							data: d,
							x: snap.x,
							y: snap.y,
							fixedY: snap.fitNoise ? undefined : snap.y.params.map(() => true),
							seed: snap.seed
						}
					});
					if (r.kind === 'mle') mle = r.result;
				} catch (err) {
					if (err instanceof StoppedError) throw err;
					failures.push({ method: 'mle', message: (err as Error).message });
				}
			}
			const noise = fitted && mle ? mle.y : snap.y;
			const results = await Promise.allSettled(
				gridMethods.map((method) =>
					p.run({
						kind: 'grid',
						method,
						data: d,
						y: noise,
						grid,
						options
					})
				)
			);
			const grids: GridResult[] = [];
			results.forEach((r, i) => {
				const method = gridMethods[i];
				if (r.status === 'fulfilled' && r.value.kind === 'grid') grids.push(r.value.result);
				else if (r.status === 'rejected') {
					if (r.reason instanceof StoppedError) throw r.reason;
					failures.push({ method, message: (r.reason as Error).message });
				}
			});
			run = {
				data: d,
				truth: runTruth,
				grid,
				mle,
				grids,
				failures,
				noise,
				options,
				ms: performance.now() - t0
			};
			boot = null;
			bootMethod = grids.find((g) => g.method !== 'npmle')?.method ?? null;
		} catch (err) {
			runError = err instanceof StoppedError ? 'Stopped.' : (err as Error).message;
		} finally {
			running = false;
		}
	}

	function stop() {
		pool?.stop();
	}

	// --- Results ---
	const fmt = (v: number | undefined, digits = 3) =>
		v === undefined || !Number.isFinite(v)
			? '–'
			: Number(v.toPrecision(digits)).toLocaleString('en');

	const mleOnGrid = $derived(
		run?.mle ? truthOnGrid(makeDist(run.mle.x, 'signal'), run.grid) : null
	);
	const truthMass = $derived(run?.truth ? truthOnGrid(run.truth, run.grid) : null);

	type Row = {
		method: string;
		logLik: number;
		k: number | undefined;
		aic: number | undefined;
		bic: number | undefined;
		w1: number | undefined;
		l1: number | undefined;
		note: string;
	};
	const rows = $derived.by((): Row[] => {
		if (!run) return [];
		const out: Row[] = [];
		const dist = (mass: { grid: Grid; mass: Float64Array }) =>
			truthMass
				? { w1: wasserstein1(mass, truthMass), l1: l1(mass, truthMass) }
				: { w1: undefined, l1: undefined };
		if (run.mle && mleOnGrid) {
			const r = run.mle;
			out.push({
				method: METHOD_NAMES.mle,
				logLik: r.logLik,
				k: r.k,
				aic: r.aic,
				bic: r.bic,
				...dist(mleOnGrid),
				note:
					r.identifiability.flat || r.identifiability.boundary.length
						? 'Not identifiable: see below'
						: ''
			});
		}
		for (const g of run.grids) {
			const n = run.data.length;
			const k = g.k;
			out.push({
				method: METHOD_NAMES[g.method],
				logLik: g.logLik,
				k,
				aic: k === undefined ? undefined : 2 * k - 2 * g.logLik,
				bic: k === undefined ? undefined : k * Math.log(n) - 2 * g.logLik,
				...dist(g),
				note: [
					g.converged === false ? 'Not converged' : '',
					g.bandwidth ? `bandwidth ${fmt(g.bandwidth)}` : '',
					g.negativeMass ? `${fmt(100 * g.negativeMass, 2)}% negative mass clipped` : ''
				]
					.filter(Boolean)
					.join('; ')
			});
		}
		return out;
	});
	const columns: Column<Row>[] = [
		{ key: 'method', label: 'Method' },
		{ key: 'logLik', label: 'Log-lik', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'k', label: 'Params', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'aic', label: 'AIC', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'bic', label: 'BIC', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'w1', label: 'W₁ to truth', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'l1', label: 'L₁ to truth', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'note', label: 'Note' }
	];

	type ParamRow = {
		id: string;
		role: string;
		param: string;
		value: number;
		ci: string;
	};
	const paramRows = $derived.by((): ParamRow[] =>
		(run?.mle?.params ?? []).map((p, i) => ({
			id: `${i}`,
			role:
				(p.role === 'signal' ? 'X' : 'Y') + (p.component === null ? '' : ` (${p.component + 1})`),
			param: p.label,
			value: p.value,
			ci:
				p.key === 'weight'
					? '–'
					: !p.fitted
						? 'held fixed'
						: Number.isFinite(p.lower)
							? `${fmt(p.lower)} – ${fmt(p.upper)}`
							: '–'
		}))
	);
	const paramColumns: Column<ParamRow>[] = [
		{ key: 'role', label: 'Of' },
		{ key: 'param', label: 'Parameter' },
		{ key: 'value', label: 'Estimate', align: 'right', format: (v) => fmt(v as number, 4) },
		{ key: 'ci', label: '95% interval', align: 'right' }
	];

	const estimateView = $derived.by(() => {
		if (!run) return null;
		const xs = gridPoints(run.grid);
		const h = run.grid.h;
		const curves: Curve[] = [];
		const stems: Stems[] = [];
		const bandList: Band[] = [];
		const lo = run.grid.x0;
		const hi = run.grid.x0 + (run.grid.m - 1) * h;
		if (run.truth) {
			const m = marks(run.truth, run.grid, 'truth', 'True X', 'var(--text)', true);
			if (m.curve) curves.push(m.curve);
			if (m.stems) stems.push({ ...m.stems, colour: 'var(--text-muted)' });
		}
		if (run.mle) {
			const X = makeDist(run.mle.x, 'signal');
			const m = marks(X, run.grid, 'mle', `${METHOD_NAMES.mle} X`, methodColour('mle'));
			if (m.curve) curves.push(m.curve);
			if (m.stems) stems.push(m.stems);
		}
		for (const g of run.grids) {
			if (g.method === 'npmle')
				stems.push({
					key: 'npmle',
					label: METHOD_NAMES.npmle,
					colour: methodColour('npmle'),
					x: xs,
					p: g.mass
				});
			else
				curves.push({
					key: g.method,
					label: METHOD_NAMES[g.method],
					colour: methodColour(g.method),
					xs,
					ys: g.mass.map((v) => v / h)
				});
		}
		if (boot && boot.lower.length === xs.length)
			bandList.push({
				key: boot.method,
				label: `${METHOD_NAMES[boot.method]}, 90% bootstrap band`,
				colour: methodColour(boot.method),
				xs,
				lower: boot.lower,
				upper: boot.upper
			});
		// f̂_Y: the parametric fit's noise, and the grid methods' noise when it differs.
		const noises: { spec: DistSpec; key: string; label: string; colour: string }[] = [];
		if (run.mle)
			noises.push({
				spec: run.mle.y,
				key: 'noise-mle',
				label: 'Noise Y, parametric fit',
				colour: methodColour('mle')
			});
		if (run.grids.length && !(run.mle && JSON.stringify(run.mle.y) === JSON.stringify(run.noise)))
			noises.push({
				spec: run.noise,
				key: 'noise',
				label: 'Noise Y, other methods',
				colour: dataColour(3)
			});
		for (const n of noises) {
			const Y = makeDist(n.spec, 'noise');
			const m = marks(
				Y,
				chooseGrid(...Y.range(1e-3), Y, Y, { baseNodes: 512 }),
				n.key,
				n.label,
				n.colour,
				true
			);
			if (m.curve) curves.push(m.curve);
			if (m.stems) stems.push(m.stems);
		}
		const bins = Math.round(Math.min(80, Math.max(20, Math.sqrt(run.data.length))));
		return {
			range: [lo, hi] as [number, number],
			curves,
			stems,
			bands: bandList,
			histogram: histogram(run.data, lo, hi, bins)
		};
	});

	const flat = $derived(run?.mle?.identifiability.flat ? run.mle.identifiability : null);
	const edges = $derived(run?.mle?.identifiability.boundary ?? []);
	const of = (d: { label: string; role: 'signal' | 'noise'; component: number | null }) =>
		`${d.label} of ${d.role === 'signal' ? 'X' : 'Y'}${d.component === null ? '' : ` (component ${d.component + 1})`}`;
	const runGrids = $derived(run?.grids ?? []);

	// --- Compare X families ---
	let comparing = $state(false);
	let compareRows = $state.raw<
		{ id: string; family: string; logLik: number; k: number; bic: number; delta: number }[]
	>([]);
	async function compare() {
		if (!data) return;
		comparing = true;
		runError = '';
		try {
			const snap = $state.snapshot(settings) as Settings;
			const fixedY = snap.y.params.map(() => !snap.fitNoise);
			// One task per family, so the pool fits them in parallel.
			const parts = await Promise.all(
				FAMILIES.map((f) =>
					getPool().run({
						kind: 'compare',
						data,
						y: snap.y,
						families: [f.id as FamilyId],
						fixedY,
						seed: snap.seed
					})
				)
			);
			const results = parts
				.flatMap((r) => (r.kind === 'compare' ? r.results : []))
				.sort((a, b) => a.result.bic - b.result.bic);
			const best = results[0]?.result.bic ?? 0;
			compareRows = results.map(({ family: id, result }) => ({
				id,
				family: family(id).name,
				logLik: result.logLik,
				k: result.k,
				bic: result.bic,
				delta: result.bic - best
			}));
		} catch (err) {
			runError = err instanceof StoppedError ? 'Stopped.' : (err as Error).message;
		} finally {
			comparing = false;
		}
	}

	// --- Bootstrap ---
	let bootMethod = $state<GridMethod | null>(null);
	let boot = $state.raw<{ method: GridMethod; lower: Float64Array; upper: Float64Array } | null>(
		null
	);
	let booting = $state(false);
	let bootDone = $state(0);

	async function bootstrap() {
		if (!run || !bootMethod) return;
		const current = run;
		const method = bootMethod;
		const snap = $state.snapshot(settings) as Settings;
		const B = snap.bootstrapB;
		const p = getPool();
		const chunk = Math.max(1, Math.ceil(B / (p.size * 4)));
		booting = true;
		bootDone = 0;
		boot = null;
		const masses: Float64Array[] = [];
		try {
			const tasks: Promise<void>[] = [];
			for (let start = 0; start < B; start += chunk) {
				const count = Math.min(chunk, B - start);
				tasks.push(
					p
						.run({
							kind: 'bootstrap',
							method,
							data: current.data,
							y: current.noise as typeof snap.y,
							grid: current.grid,
							options: current.options,
							seed: snap.seed * 7919 + start,
							count
						})
						.then((r) => {
							if (r.kind === 'bootstrap') masses.push(...r.masses);
							bootDone = masses.length;
						})
				);
			}
			await Promise.all(tasks);
			const h = current.grid.h;
			const b = bands(masses.map((m) => m.map((v) => v / h)));
			boot = { method, ...b };
		} catch (err) {
			runError = err instanceof StoppedError ? 'Bootstrap stopped.' : (err as Error).message;
		} finally {
			booting = false;
		}
	}

	// --- Saving and the share link ---
	const storage = browserStorage();
	const persist = createPersistGate(storage);
	let hydrated = $state(false);
	let shareUrl = $state('');
	let linkError = $state('');

	$effect(() => {
		const snap = $state.snapshot(settings) as Settings;
		if (!hydrated) return;
		const valid = parseSettings(snap);
		if (!valid) return;
		persist.write(AUTOSAVE_KEY, JSON.stringify(valid));
		const url = new URL(page.url);
		url.hash = `${HASH_PARAM}=${encodeSettings(valid)}`;
		shareUrl = url.toString();
	});

	function loadLink(): boolean {
		const encoded = new URLSearchParams(location.hash.slice(1)).get(HASH_PARAM);
		if (encoded === null) return false;
		const s = decodeSettings(encoded);
		if (s) {
			settings = s;
			linkError = '';
		} else linkError = 'This link is damaged or from another version, so the defaults are shown.';
		setTimeout(() => replaceState(location.pathname + location.search, {}));
		return true;
	}

	function clearAll() {
		pool?.stop();
		if (storage) clearSaved(storage, STORAGE_PREFIX);
		window.location.replace(location.pathname);
	}

	onMount(() => {
		const onHash = () => loadLink();
		window.addEventListener('hashchange', onHash);
		if (!loadLink()) {
			const saved = parseSettings(readJson(storage, AUTOSAVE_KEY));
			if (saved) settings = saved;
		}
		persist.open();
		hydrated = true;
		return () => {
			window.removeEventListener('hashchange', onHash);
			pool?.stop();
		};
	});
</script>

<svelte:head>
	<title>Deconvolution</title>
</svelte:head>

<div class="container deconv" data-hydrated={hydrated || undefined}>
	<PageHeader path="/deconvolution">
		{#snippet actions()}<ShareActions
				url={shareUrl}
				onClear={clearAll}
				description="the settings, never your data or results"
			/>{/snippet}
		We only see Z = X + Y: a signal X blurred by noise Y. Simulate it, or bring your own data, and estimate
		the signal and the noise. Everything runs in your browser.
	</PageHeader>

	{#if linkError}<Alert tone="warning">{linkError}</Alert>{/if}

	<details class="how" data-testid="how">
		<summary>How it works</summary>
		<p>
			Pick a signal and a noise, and see what you would observe. Then press Run to estimate them
			back from the sample. The parametric fit needs you to name both families. The other methods
			take any shape of signal but use the noise as given.
		</p>
		<p>
			One sample can't tell every signal from its noise: two normals only show their summed
			variance. The fit says when that happens. The details are in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/deconvolution.md">docs</a>.
		</p>
	</details>

	<Panel title="Model">
		<div class="model">
			<div class="controls">
				<Field label="Preset">
					{#snippet children(props)}
						<select
							class="control"
							value=""
							onchange={(e) => {
								applyPreset(e.currentTarget.value);
								e.currentTarget.value = '';
							}}
							data-testid="preset"
							{...props}
						>
							<option value="" disabled>Load a preset…</option>
							{#each PRESETS as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
						</select>
					{/snippet}
				</Field>
				<DistEditor bind:spec={settings.x} role="signal" testId="x" />
				<DistEditor bind:spec={settings.y as DistSpec} role="noise" testId="y" />
				<div class="row">
					<Field
						label="Sample size n"
						error={nValid ? undefined : `Between ${MIN_N} and ${MAX_N.toLocaleString('en')}.`}
					>
						{#snippet children(props)}
							<input
								class="control"
								type="number"
								min={MIN_N}
								max={MAX_N}
								step="1"
								bind:value={settings.n}
								data-testid="n"
								{...props}
							/>
						{/snippet}
					</Field>
					<Field label="Seed" error={seedValid ? undefined : 'A whole number ≥ 0.'}>
						{#snippet children(props)}
							<input
								class="control"
								type="number"
								min="0"
								step="1"
								bind:value={settings.seed}
								data-testid="seed"
								{...props}
							/>
						{/snippet}
					</Field>
				</div>
				{#if sample}
					<div>
						<Button
							size="sm"
							variant="secondary"
							onclick={() => download('deconvolution-sample.csv', sampleCsv(sample))}
							data-testid="export">Download the sample (CSV)</Button
						>
					</div>
				{/if}
			</div>
			<div class="plot">
				{#if modelView}
					<DensityChart
						title="Signal, noise and what we observe"
						testId="model-chart"
						xRange={modelView.range}
						curves={modelView.curves}
						stems={modelView.stems}
						histogram={modelView.histogram}
						summary="Densities of the signal X, the noise Y and the observed Z = X + Y, with a histogram of the simulated sample."
					/>
				{:else}
					<p class="muted">Fix the parameters to see the distributions.</p>
				{/if}
			</div>
		</div>
	</Panel>

	<h2 class="section">Estimate</h2>

	<Panel title="Data" level={3}>
		<SegmentedControl
			legend="Data to estimate from"
			options={[
				{ value: 'simulated', label: 'Simulated sample' },
				{ value: 'uploaded', label: 'Your data' }
			]}
			bind:value={settings.source}
		/>
		{#if settings.source === 'uploaded'}
			<div class="upload">
				<Field label="CSV or text file" hint="One column of numbers; a header line is fine.">
					{#snippet children(props)}
						<input
							class="control"
							type="file"
							accept=".csv,.txt,.tsv,text/csv,text/plain"
							onchange={onFile}
							data-testid="file"
							{...props}
						/>
					{/snippet}
				</Field>
				<Field label="Or paste numbers">
					{#snippet children(props)}
						<textarea
							class="control paste"
							rows="4"
							value={uploadText}
							oninput={(e) => parseUpload(e.currentTarget.value)}
							data-testid="paste"
							{...props}
						></textarea>
					{/snippet}
				</Field>
				{#if uploaded}
					{#if uploaded.error}
						<Alert tone="danger">{uploaded.error}</Alert>
					{:else}
						<p class="muted" data-testid="upload-status">
							{uploaded.data.length.toLocaleString('en')} numbers{uploadName
								? ` from ${uploadName}`
								: ''}{uploaded.header ? ', header skipped' : ''}.
						</p>
					{/if}
					{#if uploaded.invalidCount}
						<Alert tone="warning">
							Skipped {uploaded.invalidCount} line{uploaded.invalidCount === 1 ? '' : 's'} without a single
							number:
							{uploaded.invalid
								.map((r) => `line ${r.line} (“${r.text}”)`)
								.join(', ')}{uploaded.invalidCount > uploaded.invalid.length ? ', …' : ''}.
						</Alert>
					{/if}
				{/if}
				<p class="muted">Your data stays in this browser and isn't saved.</p>
			</div>
		{/if}
	</Panel>

	<Panel title="Methods" level={3}>
		<fieldset class="methods">
			<legend class="sr-only">Estimators</legend>
			{#each METHODS as m (m)}
				<label class="method" class:off={!!reasons[m]}>
					<input
						type="checkbox"
						checked={settings.methods.includes(m)}
						disabled={!!reasons[m]}
						onchange={(e) => toggle(m, e.currentTarget.checked)}
						data-testid="method-{m}"
					/>
					<span>
						<strong>{METHOD_NAMES[m]}</strong>
						<span class="muted">{reasons[m] ?? METHOD_HINTS[m]}</span>
					</span>
				</label>
			{/each}
		</fieldset>
		<div class="row">
			<label class="check">
				<input type="checkbox" bind:checked={settings.fitNoise} data-testid="fit-noise" />
				The parametric fit also fits the noise
			</label>
		</div>
		<SegmentedControl
			legend="Noise used by the other methods"
			options={[
				{ value: 'entered', label: 'As entered' },
				{ value: 'fitted', label: 'From the parametric fit', disabled: !settings.fitNoise }
			]}
			bind:value={settings.noiseFor}
		/>
		<div class="row">
			{#if settings.methods.includes('gmodel')}
				<Field label="g-modeling spline df">
					{#snippet children(props)}
						<input
							class="control"
							type="number"
							min="2"
							max="12"
							step="1"
							bind:value={settings.df}
							{...props}
						/>
					{/snippet}
				</Field>
				<Field label="g-modeling penalty c₀">
					{#snippet info()}<InfoTip label="About the penalty"
							>Larger values give a smoother signal.</InfoTip
						>{/snippet}
					{#snippet children(props)}
						<input
							class="control"
							type="number"
							min="0"
							max="1000"
							step="any"
							bind:value={settings.c0}
							{...props}
						/>
					{/snippet}
				</Field>
			{/if}
			{#if settings.methods.includes('kernel')}
				<Field label="Kernel bandwidth" hint="Leave empty for the default rule.">
					{#snippet children(props)}
						<input
							class="control"
							type="number"
							min="0"
							step="any"
							value={settings.bandwidth ?? ''}
							oninput={(e) => {
								const v = e.currentTarget.value;
								settings.bandwidth = v === '' ? null : Number(v) > 0 ? Number(v) : null;
							}}
							data-testid="bandwidth"
							{...props}
						/>
					{/snippet}
				</Field>
			{/if}
		</div>
	</Panel>

	<RunControls onrun={start} {running} disabled={!canRun} describedby="run-why" onstop={stop}>
		{#if !data}
			<p id="run-why" class="muted">
				{settings.source === 'uploaded' ? 'Add your data above first.' : 'Fix the model first.'}
			</p>
		{:else if chosen.length === 0}
			<p id="run-why" class="muted">Pick at least one method.</p>
		{/if}
		{#if running}<p class="muted" role="status">Fitting…</p>{/if}
		{#if runError}<Alert tone="danger">{runError}</Alert>{/if}
		{#if run && !running}<p class="muted" role="status" data-testid="run-status">
				Done in {(run.ms / 1000).toFixed(1)} s on {run.data.length.toLocaleString('en')} points.
			</p>{/if}
	</RunControls>

	{#if run && estimateView}
		<Panel title="Results" level={3}>
			<div class="results" data-testid="results">
				<DensityChart
					title="Estimated signal over the data"
					testId="estimate-chart"
					xRange={estimateView.range}
					curves={estimateView.curves}
					stems={estimateView.stems}
					bands={estimateView.bands}
					histogram={estimateView.histogram}
					histogramLabel="Data Z"
					summary="Each method's estimate of the signal X over a histogram of the data{run.truth
						? ', with the true X'
						: ''}."
				/>
				{#each run.failures as f (f.method)}
					<Alert tone="warning">{METHOD_NAMES[f.method]} failed: {f.message}</Alert>
				{/each}
				<DataTable caption="Fits" {columns} {rows} rowKey={(r) => r.method} />
				{#if !run.truth}<p class="muted">
						W₁ and L₁ need the true signal, so they show for simulated data only.
					</p>{/if}
				{#if flat}
					<Alert tone="warning">
						<span data-testid="identifiability">
							The data can't separate these parameters: {flat.direction.map(of).join(' and ')} trade off
							against each other. Fix the noise (untick "also fits the noise") or pick families that differ
							in shape.
						</span>
					</Alert>
				{/if}
				{#if edges.length}
					<Alert tone="warning">
						<span data-testid="boundary">
							{edges.map(of).join(' and ')} ended at the edge of {edges.length === 1
								? 'its'
								: 'their'} range. The data may not pin {edges.length === 1 ? 'it' : 'them'} down: a trade-off
							with the noise often ends there. Fix the noise and fit again.
						</span>
					</Alert>
				{/if}
				{#if paramRows.length}
					<DataTable
						caption="Parametric fit"
						columns={paramColumns}
						rows={paramRows}
						rowKey={(r) => r.id}
					/>
				{/if}

				<div class="subsection">
					<h4>Compare signal families</h4>
					<p class="muted">
						Fits every family for X with this noise and ranks them by BIC (lower is better).
					</p>
					<div>
						<Button
							onclick={compare}
							disabled={comparing || running || booting}
							data-testid="compare"
						>
							{comparing ? 'Comparing…' : 'Compare families'}
						</Button>
					</div>
					{#if compareRows.length}
						<DataTable
							caption="Signal families by BIC"
							columns={[
								{ key: 'family', label: 'X family' },
								{
									key: 'logLik',
									label: 'Log-lik',
									align: 'right',
									format: (v) => fmt(v as number, 6)
								},
								{ key: 'k', label: 'Params', align: 'right' },
								{ key: 'bic', label: 'BIC', align: 'right', format: (v) => fmt(v as number, 6) },
								{ key: 'delta', label: 'ΔBIC', align: 'right', format: (v) => fmt(v as number, 4) }
							]}
							rows={compareRows}
							rowKey={(r) => r.id}
						/>
					{/if}
				</div>

				{#if runGrids.some((g) => g.method !== 'npmle')}
					<div class="subsection">
						<h4>Bootstrap bands</h4>
						<p class="muted">Refits on resampled data and shades where 90% of the refits fall.</p>
						<div class="row">
							<Field label="Method">
								{#snippet children(props)}
									<select
										class="control"
										bind:value={bootMethod}
										data-testid="boot-method"
										{...props}
									>
										{#each runGrids.filter((g) => g.method !== 'npmle') as g (g.method)}<option
												value={g.method}>{METHOD_NAMES[g.method]}</option
											>{/each}
									</select>
								{/snippet}
							</Field>
							<Field label="Resamples B">
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="10"
										max={MAX_BOOTSTRAP}
										step="1"
										bind:value={settings.bootstrapB}
										{...props}
									/>
								{/snippet}
							</Field>
						</div>
						<div class="buttons">
							<Button
								onclick={bootstrap}
								disabled={booting || running || !bootMethod}
								data-testid="bootstrap">Run bootstrap</Button
							>
							<Button variant="danger" onclick={stop} disabled={!booting}>Stop</Button>
							{#if booting}<span class="muted" role="status"
									>{bootDone} / {settings.bootstrapB}</span
								>{/if}
						</div>
					</div>
				{/if}
			</div>
		</Panel>
	{/if}

	<Panel title="References" level={2}>
		<References references={REFERENCES} />
	</Panel>
</div>

<style>
	.deconv {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.model {
		display: grid;
		grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
		gap: var(--sp-4);
	}
	@media (max-width: 52rem) {
		.model {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.controls,
	.upload,
	.results,
	.subsection {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--sp-2);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		align-items: center;
	}
	.section {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-lg);
	}
	.subsection h4 {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-md);
	}
	.methods {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--sp-2);
	}
	.method {
		display: flex;
		gap: var(--sp-1);
		align-items: flex-start;
	}
	.method > span {
		display: flex;
		flex-direction: column;
	}
	.method.off strong {
		color: var(--text-muted);
	}
	.check {
		display: flex;
		gap: var(--sp-1);
		align-items: center;
	}
	.muted {
		color: var(--text-muted);
		font-size: var(--text-sm);
		margin: 0;
	}
	.paste {
		font-family: var(--font-mono);
		min-height: 5rem;
		height: auto;
	}
	.how p {
		margin: var(--sp-1) 0;
	}
</style>
