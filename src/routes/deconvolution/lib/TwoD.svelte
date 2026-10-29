<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Alert, Button, DataTable, Field, Panel, RunControls, type Column } from '$lib/ui';
	import { dataColour } from '$lib/plot';
	import {
		continuousNoise2,
		makeDist2,
		marginal,
		validate2,
		type Grid2,
		type GridEstimate2,
		type Noise2Spec,
		type Spec2
	} from '$lib/deconvolution/dist2';
	import { chooseGrid2, modelBox2, zDensityOnGrid2 } from '$lib/deconvolution/grid2';
	import {
		truthOnGrid2,
		unavailable2,
		type GridMethod2,
		type GridResult2,
		type Method2
	} from '$lib/deconvolution/estimate2';
	import { EstimatePool, StoppedError } from '$lib/deconvolution/engine';
	import { l1_2, slicedW1 } from '$lib/deconvolution/metrics2';
	import type { Mle2Input, Mle2Result } from '$lib/deconvolution/mle2';
	import { summarise, type Chain, type ParamPosterior } from '$lib/deconvolution/bayes';
	import { runChains } from './chains';
	import { supportGrid2 } from '$lib/deconvolution/npmle2';
	import { bands, histogram, simulate2 } from '$lib/deconvolution/sample';
	import {
		MAX_BOOTSTRAP,
		MAX_N,
		METHODS2,
		MIN_N,
		PRESETS2,
		type Settings
	} from '$lib/deconvolution/state';
	import { sampleCsv2, type ParsedSample } from '$lib/deconvolution/upload';
	import DensityChart, { type Band, type Curve, type Stems } from './DensityChart.svelte';
	import Dist2Editor from './Dist2Editor.svelte';
	import Heatmap from './Heatmap.svelte';

	/** The 2D model, estimate and results. The page owns the settings, the data panel and the pool. */
	let {
		settings = $bindable(),
		uploaded,
		getPool,
		dataPanel,
		download
	}: {
		settings: Settings;
		uploaded: ParsedSample | null;
		getPool: () => EstimatePool;
		dataPanel: Snippet;
		download: (name: string, text: string) => void;
	} = $props();

	const NAMES: Record<Method2, string> = {
		mle: 'Parametric MLE',
		npmle: 'NPMLE (64 × 64 grid)',
		gmm: 'Gaussian mixture'
	};
	const HINTS: Record<Method2, string> = {
		mle: 'Fits the chosen 2D families by maximum likelihood.',
		npmle: 'Any X on a 64 × 64 grid, no tuning.',
		gmm: 'X as a mix of 1–6 correlated Gaussians, picked by BIC. Gaussian noise only.'
	};
	const colourOf = (m: Method2) => dataColour(['mle', 'npmle', 'gmm'].indexOf(m) + 1);

	// --- Model ---
	const nValid = $derived(
		Number.isInteger(settings.n) && settings.n >= MIN_N && settings.n <= MAX_N
	);
	const seedValid = $derived(Number.isInteger(settings.seed) && settings.seed >= 0);
	const noiseOk = $derived(continuousNoise2(settings.y2));
	const modelValid = $derived(
		validate2(settings.x2).length === 0 && validate2(settings.y2).length === 0 && noiseOk
	);
	const built = $derived.by(() => {
		if (!modelValid) return null;
		try {
			return {
				X: makeDist2($state.snapshot(settings.x2) as Spec2, 'signal'),
				Y: makeDist2($state.snapshot(settings.y2) as Noise2Spec, 'noise')
			};
		} catch {
			return null;
		}
	});
	const sample = $derived(
		built && nValid && seedValid ? simulate2(built.X, built.Y, settings.n, settings.seed) : null
	);

	/** The node positions of a 1D grid. */
	const nodes = (g: { x0: number; h: number; m: number }) =>
		Float64Array.from({ length: g.m }, (_, i) => g.x0 + i * g.h);

	/** A 1D view of a 2D estimate's marginal, as a density curve on its axis. */
	function marginalCurve(
		est: GridEstimate2,
		axis: 0 | 1,
		key: string,
		label: string,
		colour: string,
		dashed = false
	): Curve {
		const m = marginal(est, axis);
		return { key, label, colour, xs: nodes(m.grid), ys: m.mass.map((v) => v / m.grid.h), dashed };
	}

	const modelView = $derived.by(() => {
		if (!built) return null;
		const { X, Y } = built;
		const box = modelBox2(X, Y, 1e-3);
		const grid = chooseGrid2(box, X, Y, { baseNodes: 64, maxNodes: 128 });
		const cell = grid.hx * grid.hy;
		const fz = zDensityOnGrid2(X, Y, grid);
		const fx = X.masses(grid).map((v) => v / cell);
		const yBox = Y.box(1e-3);
		const yGrid = chooseGrid2(yBox, Y, Y, { baseNodes: 48, maxNodes: 96 });
		const fy = Y.masses(yGrid).map((v) => v / (yGrid.hx * yGrid.hy));
		const xEst = { grid, mass: fx.map((v) => v * cell) };
		const zEst = { grid, mass: fz.map((v) => v * cell) };
		const charts = ([0, 1] as const).map((axis) => ({
			axis,
			range: (axis === 0 ? [box[0], box[1]] : [box[2], box[3]]) as [number, number],
			curves: [
				marginalCurve(xEst, axis, 'x', 'Signal X', dataColour(0)),
				marginalCurve(zEst, axis, 'z', 'Observed Z', dataColour(2))
			],
			histogram: sample
				? histogram(
						axis === 0 ? sample.xs : sample.ys,
						axis === 0 ? box[0] : box[2],
						axis === 0 ? box[1] : box[3],
						50
					)
				: undefined
		}));
		return { box, grid, fx, fz, yGrid, fy, charts };
	});

	function applyPreset(id: string) {
		const p = PRESETS2.find((q) => q.id === id);
		if (!p) return;
		settings.x2 = structuredClone(p.x);
		settings.y2 = structuredClone(p.y);
		settings.fitNoise2 = p.fitNoise;
	}

	// --- Data and methods ---
	const data = $derived(
		settings.source === 'simulated'
			? sample
			: uploaded && !uploaded.error && uploaded.dim === 2
				? { xs: uploaded.data, ys: uploaded.data2 }
				: null
	);
	const reasons = $derived(
		Object.fromEntries(
			METHODS2.map((m) => [m, unavailable2(m, $state.snapshot(settings.y2) as Noise2Spec)])
		) as Record<Method2, string | null>
	);
	const chosen = $derived(settings.methods2.filter((m) => !reasons[m]));
	function toggle(m: Method2, on: boolean) {
		settings.methods2 = on
			? METHODS2.filter((q) => q === m || settings.methods2.includes(q))
			: settings.methods2.filter((q) => q !== m);
	}

	// --- Running ---
	interface Run {
		xs: Float64Array;
		ys: Float64Array;
		truth: Spec2 | undefined;
		y: Noise2Spec;
		grid: Grid2;
		mle: Mle2Result | null;
		mleInput: Mle2Input;
		grids: GridResult2[];
		failures: { method: Method2; message: string }[];
		seed: number;
		ms: number;
	}
	let run = $state.raw<Run | null>(null);
	let running = $state(false);
	let runError = $state('');
	let booting = $state(false);
	let bayes = $state.raw<ParamPosterior[] | null>(null);
	let npost = $state.raw<
		{ axis: 0 | 1; mean: Float64Array; lower: Float64Array; upper: Float64Array }[] | null
	>(null);
	let chainProgress = $state<{ what: 'bayes' | 'npmle'; done: number; total: number } | null>(null);
	let bayesDraws = $state(2000);
	const canRun = $derived(!!data && modelValid && chosen.length > 0 && !running && !booting);

	async function start() {
		if (!data || !canRun) return;
		running = true;
		runError = '';
		const t0 = performance.now();
		const snap = $state.snapshot(settings) as Settings;
		const { xs, ys } = data;
		const methods = [...chosen];
		const truth = snap.source === 'simulated' ? snap.x2 : undefined;
		const grid = supportGrid2(xs, ys, 64);
		const pool = getPool();
		const failures: Run['failures'] = [];
		const mleInput: Mle2Input = {
			xs,
			ys,
			x: snap.x2,
			y: snap.y2,
			fixNoise: !snap.fitNoise2,
			seed: snap.seed
		};
		try {
			const tasks = methods.map((method) =>
				method === 'mle'
					? pool.run({
							kind: 'mle2',
							input: mleInput
						})
					: pool.run({ kind: 'grid2', method, xs, ys, y: snap.y2, grid, seed: snap.seed })
			);
			const results = await Promise.allSettled(tasks);
			let mle: Mle2Result | null = null;
			const grids: GridResult2[] = [];
			results.forEach((r, i) => {
				if (r.status === 'rejected') {
					if (r.reason instanceof StoppedError) throw r.reason;
					failures.push({ method: methods[i], message: (r.reason as Error).message });
				} else if (r.value.kind === 'mle2') mle = r.value.result;
				else if (r.value.kind === 'grid2') grids.push(r.value.result);
			});
			run = {
				xs,
				ys,
				truth,
				y: snap.y2,
				grid,
				mle,
				mleInput,
				grids,
				failures,
				seed: snap.seed,
				ms: performance.now() - t0
			};
			boot = null;
			bayes = null;
			npost = null;
		} catch (err) {
			runError = err instanceof StoppedError ? 'Stopped.' : (err as Error).message;
		} finally {
			running = false;
		}
	}
	const stop = () => getPool().stop();

	// --- Results ---
	const fmt = (v: number | undefined, digits = 3) =>
		v === undefined || !Number.isFinite(v)
			? '–'
			: Number(v.toPrecision(digits)).toLocaleString('en');
	const truthMass = $derived(run?.truth ? truthOnGrid2(run.truth, run.grid) : null);
	const mleMass = $derived(run?.mle ? truthOnGrid2(run.mle.x, run.grid) : null);

	/** Every estimate on the shared grid, in method order. */
	const estimates = $derived.by(() => {
		if (!run) return [];
		const out: { method: Method2; est: GridEstimate2 }[] = [];
		if (mleMass) out.push({ method: 'mle', est: mleMass });
		for (const g of run.grids) out.push({ method: g.method, est: g });
		return out;
	});

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
		const n = run.xs.length;
		const dist = (est: GridEstimate2) =>
			truthMass
				? { w1: slicedW1(est, truthMass), l1: l1_2(est, truthMass) }
				: { w1: undefined, l1: undefined };
		const out: Row[] = [];
		if (run.mle && mleMass) {
			const r = run.mle;
			out.push({
				method: NAMES.mle,
				logLik: r.logLik,
				k: r.k,
				aic: r.aic,
				bic: r.bic,
				...dist(mleMass),
				note:
					r.identifiability.flat || r.identifiability.boundary.length
						? 'Not identifiable: see below'
						: ''
			});
		}
		for (const g of run.grids)
			out.push({
				method: NAMES[g.method],
				logLik: g.logLik,
				k: g.k,
				aic: g.k === undefined ? undefined : 2 * g.k - 2 * g.logLik,
				bic: g.k === undefined ? undefined : g.k * Math.log(n) - 2 * g.logLik,
				...dist(g),
				note: g.converged === false ? 'Not converged' : ''
			});
		return out;
	});
	const columns: Column<Row>[] = [
		{ key: 'method', label: 'Method' },
		{ key: 'logLik', label: 'Log-lik', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'k', label: 'Params', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'aic', label: 'AIC', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'bic', label: 'BIC', align: 'right', format: (v) => fmt(v as number, 6) },
		{ key: 'w1', label: 'Sliced W₁ to truth', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'l1', label: 'L₁ to truth', align: 'right', format: (v) => fmt(v as number) },
		{ key: 'note', label: 'Note' }
	];

	type ParamRow = {
		id: string;
		role: string;
		param: string;
		value: number;
		ci: string;
		median?: number;
		cri?: string;
		rhat?: number;
		ess?: number;
	};
	const posteriorOf = (p: { role: string; component: number | null; key: string }) =>
		bayes?.find((b) => b.role === p.role && b.component === p.component && b.key === p.key);
	function bayesCells(b: ParamPosterior | undefined): Partial<ParamRow> {
		if (!b) return {};
		return {
			median: b.median,
			cri: `${fmt(b.lower)} – ${fmt(b.upper)}`,
			rhat: b.rhat,
			ess: b.ess
		};
	}
	const paramRows = $derived.by((): ParamRow[] =>
		(run?.mle?.params ?? []).map((p, i) => ({
			...bayesCells(posteriorOf(p)),
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
	const paramColumns = $derived<Column<ParamRow>[]>([
		{ key: 'role', label: 'Of' },
		{ key: 'param', label: 'Parameter' },
		{ key: 'value', label: 'Estimate', align: 'right', format: (v) => fmt(v as number, 4) },
		{ key: 'ci', label: '95% interval', align: 'right' },
		...(bayes
			? ([
					{
						key: 'median',
						label: 'Posterior median',
						align: 'right',
						format: (v) => fmt(v as number | undefined, 4)
					},
					{
						key: 'cri',
						label: '95% credible',
						align: 'right',
						format: (v) => (v as string) ?? '–'
					},
					{
						key: 'rhat',
						label: 'R̂',
						align: 'right',
						format: (v) => fmt(v as number | undefined, 4)
					},
					{
						key: 'ess',
						label: 'ESS',
						align: 'right',
						format: (v) => fmt(v as number | undefined, 2)
					}
				] satisfies Column<ParamRow>[])
			: [])
	]);
	const id = $derived(run?.mle?.identifiability ?? null);
	const of = (d: { label: string; role: 'signal' | 'noise'; component: number | null }) =>
		`${d.label} of ${d.role === 'signal' ? 'X' : 'Y'}${d.component === null ? '' : ` (component ${d.component + 1})`}`;
	const bayesBlocked = $derived(
		!run?.mle
			? null
			: run.mle.x.family === 'mixture2'
				? 'Not offered for mixtures: their components swap labels and have no objective prior. The NPMLE posterior below gives bands without a model.'
				: run.mle.identifiability.flat
					? 'The data can’t separate these parameters (see above), so no prior makes the posterior proper.'
					: null
	);
	const unconverged = $derived(bayes?.filter((b) => b.rhat > 1.01) ?? []);
	const atBoxEdge = $derived(bayes?.filter((b) => b.edge) ?? []);
	const labelOf = (b: ParamPosterior) =>
		run?.mle?.params.find(
			(p) => p.role === b.role && p.component === b.component && p.key === b.key
		)?.label ?? b.key;

	// --- Bootstrap (Gaussian mixture only: the NPMLE gives point masses) ---
	let boot = $state.raw<{ lower: Float64Array; upper: Float64Array; axis: 0 | 1 }[] | null>(null);
	let bootDone = $state(0);

	async function bootstrap() {
		const current = run;
		if (!current || !current.grids.some((g) => g.method === 'gmm')) return;
		const B = settings.bootstrapB;
		const pool = getPool();
		const chunk = Math.max(1, Math.ceil(B / (pool.size * 4)));
		booting = true;
		bootDone = 0;
		boot = null;
		const masses: Float64Array[] = [];
		try {
			const tasks: Promise<void>[] = [];
			for (let s = 0; s < B; s += chunk)
				tasks.push(
					pool
						.run({
							kind: 'bootstrap2',
							method: 'gmm',
							xs: current.xs,
							ys: current.ys,
							y: current.y,
							grid: current.grid,
							seed: current.seed * 7919 + s,
							count: Math.min(chunk, B - s)
						})
						.then((r) => {
							if (r.kind === 'bootstrap2') masses.push(...r.masses);
							bootDone = masses.length;
						})
				);
			await Promise.all(tasks);
			boot = ([0, 1] as const).map((axis) => {
				const ms = masses.map((mass) => {
					const m = marginal({ grid: current.grid, mass }, axis);
					return m.mass.map((v) => v / m.grid.h);
				});
				return { axis, ...bands(ms) };
			});
		} catch (err) {
			runError = err instanceof StoppedError ? 'Bootstrap stopped.' : (err as Error).message;
		} finally {
			booting = false;
		}
	}

	const resultCharts = $derived.by(() => {
		if (!run) return [];
		const g = run.grid;
		return ([0, 1] as const).map((axis) => {
			const lo = axis === 0 ? g.x0 : g.y0;
			const hi = lo + ((axis === 0 ? g.mx : g.my) - 1) * (axis === 0 ? g.hx : g.hy);
			const curves: Curve[] = [];
			const stems: Stems[] = [];
			const bandList: Band[] = [];
			if (truthMass)
				curves.push(marginalCurve(truthMass, axis, 'truth', 'True X', 'var(--text)', true));
			for (const { method, est } of estimates) {
				if (method === 'npmle') {
					const m = marginal(est, axis);
					stems.push({
						key: 'npmle',
						label: NAMES.npmle,
						colour: colourOf('npmle'),
						x: nodes(m.grid),
						p: m.mass
					});
				} else curves.push(marginalCurve(est, axis, method, NAMES[method], colourOf(method)));
			}
			const b = boot?.find((q) => q.axis === axis);
			if (b)
				bandList.push({
					key: 'gmm',
					label: `${NAMES.gmm}, 90% bootstrap band`,
					colour: colourOf('gmm'),
					xs: nodes(axis === 0 ? { x0: g.x0, h: g.hx, m: g.mx } : { x0: g.y0, h: g.hy, m: g.my }),
					lower: b.lower,
					upper: b.upper
				});
			const np = npost?.find((q) => q.axis === axis);
			if (np) {
				curves.push({
					key: 'npmle-post',
					label: 'NPMLE posterior mean',
					colour: colourOf('npmle'),
					xs: nodes(axis === 0 ? { x0: g.x0, h: g.hx, m: g.mx } : { x0: g.y0, h: g.hy, m: g.my }),
					ys: np.mean
				});
				bandList.push({
					key: 'npmle-post',
					label: 'NPMLE posterior, 90% credible band',
					colour: colourOf('npmle'),
					xs: nodes(axis === 0 ? { x0: g.x0, h: g.hx, m: g.mx } : { x0: g.y0, h: g.hy, m: g.my }),
					lower: np.lower,
					upper: np.upper
				});
			}
			return {
				axis,
				range: [lo, hi] as [number, number],
				curves,
				stems,
				bands: bandList,
				histogram: histogram(axis === 0 ? run!.xs : run!.ys, lo, hi, 50)
			};
		});
	});
	const cellOf = (g: Grid2) => g.hx * g.hy;

	// --- Bayesian fit and NPMLE posterior ---
	const CHAINS = 4;
	const STEPS_PER_CHUNK = 100;

	async function bayesFit() {
		if (!run?.mle || bayesBlocked) return;
		const { mle, mleInput } = run;
		const draws = Math.min(20_000, Math.max(100, Math.round(bayesDraws) || 1000));
		const warmup = Math.round(draws / 2);
		const chunks = Math.ceil((warmup + draws) / STEPS_PER_CHUNK);
		const seed = settings.seed;
		let free: Parameters<typeof summarise>[0] = [];
		let box: [number, number][] = [];
		bayes = null;
		runError = '';
		chainProgress = { what: 'bayes', done: 0, total: CHAINS * chunks };
		try {
			const chains = await runChains<Chain, number[]>(getPool(), {
				chains: CHAINS,
				chunks,
				task: (c, k, chain) => ({
					kind: 'bayes',
					model: { dim: 2, input: mleInput, fit: { x: mle.x, y: mle.y } },
					chain,
					steps: Math.min(STEPS_PER_CHUNK, warmup + draws - k * STEPS_PER_CHUNK),
					warmup,
					seed: seed * 7919 + 1000 * c + 2 * k
				}),
				read: (r) => {
					if (r.kind !== 'bayes') throw new Error('Unexpected result');
					({ free, box } = r);
					return { state: r.chain, draws: r.draws };
				},
				progress: (done) => chainProgress && (chainProgress.done = done)
			});
			bayes = summarise(free, box, chains);
		} catch (err) {
			runError = err instanceof StoppedError ? 'Bayesian fit stopped.' : (err as Error).message;
		} finally {
			chainProgress = null;
		}
	}

	const SWEEPS_PER_CHUNK = 25;
	const POSTERIOR_CHUNKS = { warmup: 2, kept: 2 };

	async function npmlePosterior() {
		if (!run) return;
		const current = run;
		const chunks = POSTERIOR_CHUNKS.warmup + POSTERIOR_CHUNKS.kept;
		const seed = settings.seed;
		npost = null;
		runError = '';
		chainProgress = { what: 'npmle', done: 0, total: CHAINS * chunks };
		try {
			const chains = await runChains<Float64Array, Float64Array>(getPool(), {
				chains: CHAINS,
				chunks,
				task: (c, k, mass) => ({
					kind: 'posterior2',
					xs: current.xs,
					ys: current.ys,
					y: current.y,
					grid: current.grid,
					mass,
					sweeps: SWEEPS_PER_CHUNK,
					seed: seed * 7919 + 1000 * c + k
				}),
				read: (r, k) => {
					if (r.kind !== 'posterior2') throw new Error('Unexpected result');
					return {
						state: r.masses[r.masses.length - 1],
						draws: k >= POSTERIOR_CHUNKS.warmup ? r.masses : []
					};
				},
				progress: (done) => chainProgress && (chainProgress.done = done)
			});
			const keptMasses = chains.flat();
			npost = ([0, 1] as const).map((axis) => {
				const ms = keptMasses.map((mass) => {
					const m = marginal({ grid: current.grid, mass }, axis);
					return m.mass.map((v) => v / m.grid.h);
				});
				const meanArr = new Float64Array(ms[0].length);
				for (let j = 0; j < meanArr.length; j++) {
					let s = 0;
					for (const d of ms) s += d[j];
					meanArr[j] = s / ms.length;
				}
				return { axis, mean: meanArr, ...bands(ms) };
			});
		} catch (err) {
			runError = err instanceof StoppedError ? 'NPMLE posterior stopped.' : (err as Error).message;
		} finally {
			chainProgress = null;
		}
	}
</script>

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
						data-testid="preset2"
						{...props}
					>
						<option value="" disabled>Load a preset…</option>
						{#each PRESETS2 as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Dist2Editor bind:spec={settings.x2} role="signal" testId="x2" />
			<Dist2Editor bind:spec={settings.y2 as Spec2} role="noise" testId="y2" />
			{#if !noiseOk}
				<Alert tone="warning">The noise must be continuous on both axes, so Z has a density.</Alert>
			{/if}
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
						onclick={() =>
							download('deconvolution-sample-2d.csv', sampleCsv2(sample.xs, sample.ys))}
						data-testid="export">Download the sample (CSV)</Button
					>
				</div>
			{/if}
		</div>
		<div class="plots">
			{#if modelView}
				<div class="maps">
					<Heatmap
						title="Signal X"
						grid={modelView.grid}
						values={modelView.fx}
						colour={dataColour(0)}
						testId="map-x"
						summary="Density of the 2D signal X."
					/>
					<Heatmap
						title="Noise Y"
						grid={modelView.yGrid}
						values={modelView.fy}
						colour={dataColour(3)}
						testId="map-y"
						summary="Density of the 2D noise Y, centred on 0."
					/>
					<Heatmap
						title="Observed Z with the sample"
						grid={modelView.grid}
						values={modelView.fz}
						colour={dataColour(2)}
						points={sample ?? undefined}
						testId="map-z"
						summary="Density of Z = X + Y with the simulated sample drawn over it."
					/>
				</div>
				<div class="marginals">
					{#each modelView.charts as c (c.axis)}
						<DensityChart
							title="Along {c.axis === 0 ? 'x' : 'y'}: marginal densities"
							testId="model-marginal-{c.axis === 0 ? 'x' : 'y'}"
							xRange={c.range}
							xLabel={c.axis === 0 ? 'x' : 'y'}
							curves={c.curves}
							histogram={c.histogram}
							summary="Marginal densities of X and Z along {c.axis === 0
								? 'x'
								: 'y'}, over a histogram of the sample."
						/>
					{/each}
				</div>
			{:else}
				<p class="muted">Fix the parameters to see the distributions.</p>
			{/if}
		</div>
	</div>
</Panel>

<h2 class="section">Estimate</h2>

{@render dataPanel()}
{#if settings.source === 'uploaded' && uploaded && !uploaded.error && uploaded.dim !== 2}
	<Alert tone="warning">This data has one column: switch to 1D to use it.</Alert>
{/if}

<Panel title="Methods" level={3}>
	<fieldset class="methods">
		<legend class="sr-only">Estimators</legend>
		{#each METHODS2 as m (m)}
			<label class="method" class:off={!!reasons[m]}>
				<input
					type="checkbox"
					checked={settings.methods2.includes(m)}
					disabled={!!reasons[m]}
					onchange={(e) => toggle(m, e.currentTarget.checked)}
					data-testid="method2-{m}"
				/>
				<span>
					<strong>{NAMES[m]}</strong>
					<span class="muted">{reasons[m] ?? HINTS[m]}</span>
				</span>
			</label>
		{/each}
	</fieldset>
	<p class="muted">g-modeling and kernel deconvolution are 1D only.</p>
	<label class="check">
		<input type="checkbox" bind:checked={settings.fitNoise2} data-testid="fit-noise2" />
		The parametric fit also fits the noise
	</label>
	<p class="muted">The NPMLE and the mixture use the noise as entered.</p>
</Panel>

<RunControls
	onrun={start}
	{running}
	disabled={!canRun || !!chainProgress}
	describedby="run2-why"
	onstop={stop}
>
	{#if !data}
		<p id="run2-why" class="muted">
			{settings.source === 'uploaded' ? 'Add two-column data above first.' : 'Fix the model first.'}
		</p>
	{:else if chosen.length === 0}
		<p id="run2-why" class="muted">Pick at least one method.</p>
	{/if}
	{#if running}<p class="muted" role="status">Fitting…</p>{/if}
	{#if runError}<Alert tone="danger">{runError}</Alert>{/if}
	{#if run && !running}<p class="muted" role="status" data-testid="run-status">
			Done in {(run.ms / 1000).toFixed(1)} s on {run.xs.length.toLocaleString('en')} points.
		</p>{/if}
</RunControls>

{#if run}
	<Panel title="Results" level={3}>
		<div class="results" data-testid="results">
			<div class="maps">
				{#if truthMass}
					<Heatmap
						title="True X"
						grid={run.grid}
						values={truthMass.mass.map((v) => v / cellOf(run!.grid))}
						colour="var(--text)"
						testId="map-truth"
						summary="Density of the true signal on the estimation grid."
					/>
				{/if}
				{#each estimates as e (e.method)}
					<Heatmap
						title={NAMES[e.method]}
						grid={run.grid}
						values={e.est.mass.map((v) => v / cellOf(run!.grid))}
						colour={colourOf(e.method)}
						testId="map-{e.method}"
						summary="{NAMES[e.method]}: estimated density of the signal X."
					/>
				{/each}
			</div>
			<div class="marginals">
				{#each resultCharts as c (c.axis)}
					<DensityChart
						title="Along {c.axis === 0 ? 'x' : 'y'}: estimated marginals"
						testId="estimate-marginal-{c.axis === 0 ? 'x' : 'y'}"
						xRange={c.range}
						xLabel={c.axis === 0 ? 'x' : 'y'}
						curves={c.curves}
						stems={c.stems}
						bands={c.bands}
						histogram={c.histogram}
						histogramLabel="Data Z"
						summary="Each method's marginal of X along {c.axis === 0
							? 'x'
							: 'y'} over a histogram of the data."
					/>
				{/each}
			</div>
			{#each run.failures as f (f.method)}
				<Alert tone="warning">{NAMES[f.method]} failed: {f.message}</Alert>
			{/each}
			<DataTable caption="Fits" {columns} {rows} rowKey={(r) => r.method} />
			{#if !run.truth}<p class="muted">
					Sliced W₁ and L₁ need the true signal, so they show for simulated data only.
				</p>{/if}
			{#if id?.flat}
				<Alert tone="warning">
					<span data-testid="identifiability">
						The data can't separate these parameters: {id.direction.map(of).join(' and ')} trade off against
						each other. Fix the noise (untick "also fits the noise") or pick families that differ in shape.
					</span>
				</Alert>
			{/if}
			{#if id?.boundary.length}
				<Alert tone="warning">
					<span data-testid="boundary">
						{id.boundary.map(of).join(' and ')} ended at the edge of {id.boundary.length === 1
							? 'its'
							: 'their'} range. The data may not pin {id.boundary.length === 1 ? 'it' : 'them'} down.
						Fix the noise and fit again.
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
			{#if run.mle}
				<div class="subsection">
					<h4>Bayesian fit</h4>
					<p class="muted">
						Samples the parametric model's posterior under an objective (Jeffreys) prior: 4 chains,
						half of each spent warming up. Credible intervals behave better than the 95% intervals
						near a range's edge and in small samples.
					</p>
					{#if bayesBlocked}
						<p class="muted" data-testid="bayes2-blocked">{bayesBlocked}</p>
					{:else}
						<div class="row">
							<Field label="Draws per chain">
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="100"
										max="20000"
										step="100"
										bind:value={bayesDraws}
										data-testid="bayes2-draws"
										{...props}
									/>
								{/snippet}
							</Field>
						</div>
						<div class="buttons">
							<Button
								onclick={bayesFit}
								disabled={running || booting || !!chainProgress}
								data-testid="bayes2">Run Bayesian fit</Button
							>
							<Button variant="danger" onclick={stop} disabled={chainProgress?.what !== 'bayes'}
								>Stop</Button
							>
							{#if chainProgress?.what === 'bayes'}<span class="muted" role="status"
									>{Math.round((100 * chainProgress.done) / chainProgress.total)}%</span
								>{/if}
						</div>
					{/if}
					{#if unconverged.length}
						<Alert tone="warning">
							<span data-testid="rhat">
								The chains disagree for {unconverged.map(labelOf).join(', ')} (R̂ above 1.01), so
								{unconverged.length === 1 ? 'its interval isn’t' : 'their intervals aren’t'} reliable
								yet. Run more draws.
							</span>
						</Alert>
					{/if}
					{#if atBoxEdge.length}
						<Alert tone="warning">
							<span data-testid="bayes-edge">
								Draws of {atBoxEdge.map(labelOf).join(' and ')} pile up at the edge of the allowed range,
								so the posterior may be improper there and the interval isn’t meaningful. Fix the noise
								or pick families the data can tell apart.
							</span>
						</Alert>
					{/if}
				</div>
			{/if}
			{#if run.grids.some((g) => g.method === 'npmle')}
				<div class="subsection">
					<h4>NPMLE posterior</h4>
					<p class="muted">
						Samples the grid masses under a Dirichlet prior with 1/4,096 per point on the 64 × 64
						grid and shades where 90% of the draws' marginals fall, with the noise the other methods
						used.
					</p>
					<div class="buttons">
						<Button
							onclick={npmlePosterior}
							disabled={running || booting || !!chainProgress}
							data-testid="npmle2-posterior">Run NPMLE posterior</Button
						>
						<Button variant="danger" onclick={stop} disabled={chainProgress?.what !== 'npmle'}
							>Stop</Button
						>
						{#if chainProgress?.what === 'npmle'}<span class="muted" role="status"
								>{Math.round((100 * chainProgress.done) / chainProgress.total)}%</span
							>{/if}
					</div>
				</div>
			{/if}
			{#if run.grids.some((g) => g.method === 'gmm')}
				<div class="subsection">
					<h4>Bootstrap bands</h4>
					<p class="muted">
						Refits the Gaussian mixture on resampled data and shades where 90% of its marginals
						fall.
					</p>
					<div class="row">
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
							disabled={booting || running || !!chainProgress}
							data-testid="bootstrap2">Run bootstrap</Button
						>
						<Button variant="danger" onclick={stop} disabled={!booting}>Stop</Button>
						{#if booting}<span class="muted" role="status">{bootDone} / {settings.bootstrapB}</span
							>{/if}
					</div>
				</div>
			{/if}
		</div>
	</Panel>
{/if}

<style>
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
	.plots,
	.results,
	.subsection {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.maps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
		gap: var(--sp-2);
	}
	.marginals {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: var(--sp-2);
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
</style>
