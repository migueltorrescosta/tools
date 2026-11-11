<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/env';
	import { browserStorage, clearSaved, createPersistGate } from '#lib/persist-gate.js';
	import {
		MAX_HOLD,
		MAX_PULSES,
		MAX_WEIGHT,
		MIN_HOLD,
		PM_LEVELS,
		lorentzianErrors,
		needsPseudomodes,
		validateBudget,
		validateSetup
	} from '#lib/ancilla-mzi/limits.js';
	import {
		DEFAULT_BUDGET,
		PRESETS,
		applyPreset,
		cloneNoise,
		defaultSetup,
		detectPreset,
		evenPulses,
		noiseless,
		sameNoise,
		type PresetId
	} from '#lib/ancilla-mzi/presets.js';
	import { NO_FEEDBACK, checkRules } from '#lib/ancilla-mzi/rules.js';
	import {
		RESULT_KEY,
		SETUP_KEY,
		STORAGE_PREFIX,
		decodeShareParams,
		encodeShareParams,
		hasShareParams,
		readSavedResult,
		type SavedResult
	} from '#lib/ancilla-mzi/state.js';
	import {
		AXES,
		type AncillaEngine,
		type Budget,
		type LorentzianKind,
		type PulseTarget,
		type RunSnapshot,
		type Setup
	} from '#lib/ancilla-mzi/types.js';
	import {
		Alert,
		Answer,
		Button,
		Field,
		Fold,
		PageHeader,
		Panel,
		RunControls,
		ShareActions,
		SegmentedControl
	} from '#lib/ui/index.js';
	import { createAncillaEngine } from '#lib/ancilla-mzi/worker-engine.js';
	import { activeControls } from './lib/controls';
	import ConvergencePlot, { type RefLine } from './lib/ConvergencePlot.svelte';
	import ControlsPlot from './lib/ControlsPlot.svelte';
	import Description from './lib/Description.svelte';
	import NoiseColumn from './lib/NoiseColumn.svelte';
	import T from './lib/Tex.svelte';

	/** Traces drawn at most (the newest, plus each role's best). */
	const MAX_TRACES = 40;

	// --- Setup ---
	let setup = $state<Setup>(defaultSetup());
	let budget = $state<Budget>({ ...DEFAULT_BUDGET });
	/** The ancilla mirrors the system's noise; on by default. */
	let ancillaSame = $state(true);

	/** The setup a run would use, with the ancilla noise mirrored when asked. */
	const effective = $derived<Setup>({
		...setup,
		noise: {
			system: setup.noise.system,
			ancilla: ancillaSame ? cloneNoise(setup.noise.system) : setup.noise.ancilla
		}
	});
	const N = $derived(setup.nS + setup.nA);
	/** Without an ancilla the engine ignores the A-only controls; the page greys them out. */
	const noAncilla = $derived(setup.nA === 0);
	const errors = $derived([...validateSetup(effective), ...validateBudget(budget)]);
	const rules = $derived(checkRules(effective));
	const preset = $derived(detectPreset(effective));
	const pseudomodes = $derived(needsPseudomodes(effective));
	const showCutoff = $derived(
		pseudomodes &&
			[effective.noise.system, effective.noise.ancilla].some(
				(n) => n.lorentzian.kind === 'dephasing'
			)
	);

	function errorFor(field: string): string | undefined {
		return errors.find((e) => e.field === field)?.message;
	}

	const KIND_LIST: LorentzianKind[] = ['none', 'dephasing', 'amplitudeDamping'];
	/** Why each Lorentzian kind can't be picked on a register, from the limits themselves. */
	function kindReasons(register: 'system' | 'ancilla'): Record<LorentzianKind, string | null> {
		const out = {} as Record<LorentzianKind, string | null>;
		for (const kind of KIND_LIST) {
			if (kind === 'none') {
				out[kind] = null;
				continue;
			}
			const trial = $state.snapshot(effective) as Setup;
			trial.noise[register].lorentzian.kind = kind;
			if (register === 'system' && ancillaSame) trial.noise.ancilla.lorentzian.kind = kind;
			const errs = lorentzianErrors(trial).filter((e) => e.field !== 'pmLevels');
			out[kind] = errs[0]?.message ?? null;
		}
		return out;
	}
	const systemKindReasons = $derived(kindReasons('system'));
	const ancillaKindReasons = $derived(kindReasons('ancilla'));

	function setRegisters(nS: number, nA: number) {
		const followN = setup.mziParticles === setup.nS + setup.nA;
		setup.nS = nS;
		setup.nA = nA;
		if (followN && Number.isInteger(nS + nA)) setup.mziParticles = nS + nA;
	}

	function choosePreset(id: string) {
		if (id === 'custom') return;
		const next = applyPreset($state.snapshot(effective) as Setup, id as PresetId);
		if (id === 'clean') ancillaSame = false;
		setup = next;
	}

	function setAncillaSame(on: boolean) {
		// Start the ancilla's own noise from the system's
		if (!on) setup.noise.ancilla = cloneNoise($state.snapshot(setup.noise.system));
		ancillaSame = on;
	}

	function setPulseCount(k: number) {
		const target: PulseTarget = setup.pulses[0]?.target ?? (setup.nA > 0 ? 'A' : 'S');
		setup.pulses = evenPulses(k, setup.ancillaHold, target);
	}

	function setHold(hold: number) {
		const old = setup.ancillaHold;
		if (Number.isFinite(hold) && hold > 0 && Number.isFinite(old) && old > 0)
			setup.pulses = setup.pulses.map((p) => ({ ...p, time: (p.time * hold) / old }));
		setup.ancillaHold = hold;
	}

	function setPulseBoundPi(v: number) {
		setup.pulseBound = v * Math.PI;
	}

	// --- Run ---
	let engine: AncillaEngine | null = null;
	let running = $state(false);
	let canContinue = $state(false);
	let runError = $state('');
	let snapshot = $state.raw<RunSnapshot | null>(null);
	/** The setup the shown results belong to. */
	let runSetup = $state.raw<Setup | null>(null);
	let runBudget = $state.raw<Budget | null>(null);
	let fromSaved = $state(false);

	function start() {
		if (errors.length > 0) return;
		engine?.dispose();
		runError = '';
		fromSaved = false;
		const s = $state.snapshot(effective) as Setup;
		const b = $state.snapshot(budget) as Budget;
		runSetup = s;
		runBudget = b;
		snapshot = null;
		engine = createAncillaEngine();
		engine.subscribe((event) => {
			if (event.type === 'progress') snapshot = event.snapshot;
			else if (event.type === 'stopped') {
				snapshot = event.snapshot;
				running = false;
				canContinue = true;
				saveResult(event.snapshot);
			} else {
				runError = event.message;
				running = false;
			}
		});
		running = true;
		canContinue = false;
		engine.start(s, b);
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

	const best = $derived(snapshot?.best.setup ?? null);
	const metrics = $derived(snapshot?.metrics ?? null);
	const mzi = $derived(snapshot?.mzi ?? null);
	const stale = $derived(
		runSetup !== null &&
			encodeShareParams({ setup: runSetup, budget: budget }).toString() !==
				encodeShareParams({ setup: effective, budget: budget }).toString()
	);

	const shownTraces = $derived.by(() => {
		const traces = snapshot?.traces ?? [];
		if (traces.length <= MAX_TRACES) return traces;
		const bestSetup = snapshot?.best.setup?.seed;
		const bestCompanion = snapshot?.best.companion?.seed;
		const recent = traces.slice(-MAX_TRACES);
		const keep = traces.filter(
			(t) =>
				!recent.includes(t) &&
				((t.role === 'setup' && t.seed === bestSetup) ||
					(t.role === 'companion' && t.seed === bestCompanion))
		);
		return [...keep, ...recent];
	});
	const refs = $derived.by<RefLine[]>(() => {
		const out: RefLine[] = [];
		if (mzi) out.push({ kind: 'mzi', label: 'MZI optimum', value: mzi.qfiOpt });
		if (metrics) {
			out.push({ kind: 'seminorm', label: 'Seminorm bound', value: metrics.bounds.seminorm });
			if (metrics.bounds.channelExtension !== null)
				out.push({
					kind: 'extension',
					label: 'Channel extension',
					value: metrics.bounds.channelExtension
				});
		}
		return out;
	});
	const controlEntries = $derived(runSetup ? activeControls(runSetup) : []);
	/** The Details box shows once the run has a baseline or a best scheme; until then How it works ends the Answer box. */
	const hasDetails = $derived(mzi !== null || best !== null);

	// --- Persistence and URL ---
	const storage = browserStorage();
	const persist = createPersistGate(storage);
	let hydrated = $state(false);
	let routerReady = $state(false);
	let shareUrl = $state('');
	let defaultQuery = '';
	let touched = false;

	const query = $derived(encodeShareParams({ setup: effective, budget }).toString());

	$effect(() => {
		const q = query;
		// hydrated is reactive and set after persist.open(), so this reruns once on load
		if (!hydrated) return;
		const url = untrack(() => new URL(page.url.href));
		url.search = q;
		shareUrl = url.toString();
		if (q !== defaultQuery) touched = true;
		if (!touched) return;
		persist.write(SETUP_KEY, q);
		if (routerReady) goto(url, { shallow: true, replace: true });
	});

	function saveResult(snap: RunSnapshot) {
		if (!runSetup || !runBudget) return;
		const saved: SavedResult = {
			query: encodeShareParams({ setup: runSetup, budget: runBudget }).toString(),
			snapshot: snap
		};
		persist.write(RESULT_KEY, JSON.stringify(saved));
	}

	function restore(params: URLSearchParams) {
		const s = decodeShareParams(params);
		setup = s.setup;
		budget = s.budget;
		ancillaSame = sameNoise(s.setup.noise.system, s.setup.noise.ancilla);
	}

	function clearAll() {
		engine?.dispose();
		engine = null;
		if (storage) clearSaved(storage, STORAGE_PREFIX);
		window.location.replace(page.url.pathname);
	}

	onMount(() => {
		defaultQuery = query;
		const params = new URLSearchParams(page.url.search);
		if (hasShareParams(params)) {
			touched = true;
			restore(params);
		} else {
			const saved = storage?.getItem(SETUP_KEY) ?? null;
			if (saved !== null) {
				touched = true;
				restore(new URLSearchParams(saved));
			}
		}
		const result = readSavedResult(storage);
		if (result) {
			const s = decodeShareParams(new URLSearchParams(result.query));
			runSetup = s.setup;
			runBudget = s.budget;
			snapshot = result.snapshot;
			fromSaved = true;
		}
		persist.open();
		const timer = setTimeout(() => {
			routerReady = true;
			hydrated = true;
		});
		return () => clearTimeout(timer);
	});

	// --- Display helpers ---
	const fmt = (v: number | null | undefined, digits = 4) =>
		v === null || v === undefined || !Number.isFinite(v)
			? '—'
			: String(Number(v.toPrecision(digits)));
	const pct = (v: number | null | undefined) =>
		v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;

	const announcement = $derived(
		running
			? 'Running…'
			: canContinue && metrics
				? `Stopped after ${snapshot?.seedsDone.setup ?? 0} seeds. R = ${fmt(metrics.R)}.`
				: ''
	);
	const elapsed = $derived(snapshot ? `${(snapshot.elapsedMs / 1000).toFixed(1)} s` : '—');
	const targetOptions: { value: PulseTarget; label: string }[] = [
		{ value: 'A', label: 'A' },
		{ value: 'S', label: 'S' },
		{ value: 'both', label: 'Both' }
	];

	// --- Folds: the setup and Advanced open by themselves when they hold an error ---
	const ADVANCED_FIELDS = ['mziParticles', 'ancillaHold'];
	const inAdvanced = (field: string) =>
		field.startsWith('noise.') || field.startsWith('budget.') || ADVANCED_FIELDS.includes(field);
	const advancedErrors = $derived(errors.filter((e) => inAdvanced(e.field)).length);
	const setupErrors = $derived(errors.length - advancedErrors);
	let setupOpen = $state(false);
	let advancedOpen = $state(false);
	$effect(() => {
		if (setupErrors > 0) setupOpen = true;
	});
	$effect(() => {
		if (advancedErrors > 0) advancedOpen = true;
	});

	// --- One-line summaries of what each fold holds ---
	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
	const setupSummary = $derived(
		[
			`${fmt(setup.nS)} + ${fmt(setup.nA)} particles`,
			plural(setup.coupling.filter(Boolean).length, 'coupling'),
			plural([...setup.fieldA, ...setup.fieldS].filter(Boolean).length, 'field'),
			plural(setup.pulses.length, 'pulse')
		].join(', ')
	);
	const MARKOV_NAMES = {
		dephasing: 'dephasing',
		amplitudeDamping: 'damping',
		depolarizing: 'depolarizing',
		transverse: 'transverse'
	} as const;
	function noiseText(noise: Setup['noise']['system']): string {
		const parts = (Object.keys(MARKOV_NAMES) as (keyof typeof MARKOV_NAMES)[])
			.filter((k) => noise.markov[k] > 0)
			.map((k) => `${MARKOV_NAMES[k]} γ = ${fmt(noise.markov[k], 3)}`);
		if (noise.lorentzian.kind !== 'none')
			parts.push(`Lorentzian ${noise.lorentzian.kind === 'dephasing' ? 'dephasing' : 'damping'}`);
		return parts.join(', ') || 'no noise';
	}
	const advancedSummary = $derived.by(() => {
		const noise = noiseText(setup.noise.system);
		const parts = [
			ancillaSame || noAncilla
				? noise.charAt(0).toUpperCase() + noise.slice(1)
				: `System ${noise}; ancilla ${noiseText(setup.noise.ancilla)}`
		];
		if (setup.mziParticles !== N || setup.ancillaHold !== 1) parts.push('accounting overridden');
		parts.push(`${fmt(budget.steps)} steps`, `seed ${fmt(budget.seed)}`);
		return parts.join(', ');
	});

	// --- Rules and verdict ---
	const broken = $derived(rules.filter((r) => !r.kept));
	const rulesLine = $derived(
		broken.length === 0
			? `All ${rules.length} fairness rules kept`
			: broken.length === 1
				? `Rule ${broken[0].id} broken: ${broken[0].title.toLowerCase()}`
				: `Rules ${broken.map((r) => r.id).join(', ')} broken`
	);
	const verdictTail = $derived.by(() => {
		if (!metrics) return '';
		const times = `${fmt(metrics.R)} times the quantum Fisher information of the best MZI`;
		if (metrics.R < 1) return `the ancilla scheme gets only ${times}, so the MZI does better.`;
		if (!metrics.significant)
			return `the ancilla scheme gets ${times}, too close to 1 to count as a real gain.`;
		return `the ancilla scheme gets ${times}.`;
	});
	const moreRatios = $derived(
		[
			'fixed window',
			'standard input',
			metrics?.Rint !== null && metrics?.Rint !== undefined ? 'coupling off' : null,
			'readout'
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

{#snippet presetPicker()}
	<Field
		label="Preset"
		hint={PRESETS.find((p) => p.id === preset)?.description ?? 'Custom controls.'}
	>
		{#snippet children(props)}
			<select
				class="control"
				value={preset ?? 'custom'}
				onchange={(e) => choosePreset(e.currentTarget.value)}
				data-testid="preset"
				{...props}
			>
				{#each PRESETS as p (p.id)}
					<option value={p.id}>{p.label}</option>
				{/each}
				<option value="custom" disabled>Custom</option>
			</select>
		{/snippet}
	</Field>
{/snippet}

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/ancilla-mzi">
		{#snippet actions()}<ShareActions
				url={shareUrl}
				onClear={clearAll}
				description="the setup, never results"
			/>{/snippet}
	</PageHeader>

	<div class="layout">
		<div class="stack inputs">
			<RunControls
				title="Setup and run"
				onrun={start}
				{running}
				disabled={errors.length > 0}
				describedby={errors.length > 0 ? 'run-blocked' : undefined}
				onstop={stop}
				oncontinue={resume}
				{canContinue}
				summary={advancedSummary}
				bind:advancedOpen
				preset={presetPicker}
			>
				{#snippet fields()}
					<section class="adv" data-testid="noise">
						<h3>Noise</h3>
						<p class="muted">Rates in units of 1/t. The MZI's particles get the same noise.</p>
						<label class="toggle wide">
							<input
								type="checkbox"
								checked={ancillaSame}
								onchange={(e) => setAncillaSame(e.currentTarget.checked)}
								data-testid="ancilla-same"
							/>
							Ancilla same as system
						</label>
						<div class="noise-grid">
							<NoiseColumn
								bind:noise={setup.noise.system}
								register="system"
								title="System"
								{errorFor}
								kindReasons={systemKindReasons}
							/>
							{#if ancillaSame}
								<div class="same">
									<p class="legend-like">Ancilla</p>
									<p class="muted">Same noise as the system.</p>
								</div>
							{:else}
								<NoiseColumn
									bind:noise={setup.noise.ancilla}
									register="ancilla"
									title="Ancilla"
									{errorFor}
									kindReasons={ancillaKindReasons}
								/>
							{/if}
						</div>
						{#if !ancillaSame}
							<div class="cluster">
								<Button size="sm" onclick={() => (setup.noise.ancilla = noiseless())}
									>Make the ancilla noiseless</Button
								>
							</div>
						{/if}
					</section>
					<section class="adv" data-testid="accounting">
						<h3>Accounting overrides</h3>
						<p class="muted">
							Each override breaks one rule; leave them at their defaults for a fair test.
						</p>
						<div class="grid-2">
							<Field label="MZI particles" hint="Default N = {N}." error={errorFor('mziParticles')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="1"
										max={N}
										step="1"
										bind:value={setup.mziParticles}
										data-testid="mzi-particles"
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Ancilla hold (t)" hint="Default 1." error={errorFor('ancillaHold')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min={MIN_HOLD}
										max={MAX_HOLD}
										step="0.1"
										value={setup.ancillaHold}
										oninput={(e) => setHold(e.currentTarget.valueAsNumber)}
										data-testid="ancilla-hold"
										{...props}
									/>
								{/snippet}
							</Field>
						</div>
					</section>
					<section class="adv" data-testid="budget">
						<h3>Precision and speed</h3>
						<div class="grid-2">
							<Field label="Strang steps M" error={errorFor('budget.steps')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="2"
										step="1"
										bind:value={budget.steps}
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Rounds per seed" error={errorFor('budget.rounds')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="1"
										step="1"
										bind:value={budget.rounds}
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Iterations per round" error={errorFor('budget.maxIter')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="1"
										step="1"
										bind:value={budget.maxIter}
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="See-saw iterations" error={errorFor('budget.seesawIter')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="1"
										step="1"
										bind:value={budget.seesawIter}
										{...props}
									/>
								{/snippet}
							</Field>
							<Field
								label="Workers"
								hint="0 picks one per spare core, up to 4."
								error={errorFor('budget.workers')}
							>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										max="16"
										step="1"
										bind:value={budget.workers}
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Seed" error={errorFor('budget.seed')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										step="1"
										bind:value={budget.seed}
										{...props}
									/>
								{/snippet}
							</Field>
						</div>
					</section>
				{/snippet}
				{#if running || snapshot}
					<p class="muted" data-testid="progress">
						{#if running}Running ·
						{/if}<span data-testid="elapsed">{elapsed}</span> ·
						<span data-testid="seeds-done"
							>{snapshot?.seedsDone.setup ?? 0} seeds{#if snapshot && snapshot.seedsDone.companion > 0},
								{snapshot.seedsDone.companion} companion seeds{/if}</span
						>
					</p>
				{/if}
				{#if errors.length > 0}
					<div id="run-blocked" data-testid="validation-errors">
						<Alert tone="warning"
							>Fix {errors.length === 1 ? 'the setting' : `${errors.length} settings`} marked below to
							run.</Alert
						>
					</div>
				{/if}
				{#if runError}<Alert tone="danger">{runError}</Alert>{/if}
				<Fold
					class="setup-fold"
					label="Customise setup"
					summary={setupSummary}
					data-testid="setup-fold"
					bind:open={setupOpen}
				>
					<div class="stack">
						<div class="grid-2">
							<Field label="System particles" error={errorFor('nS')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="1"
										max="4"
										step="1"
										value={setup.nS}
										oninput={(e) => setRegisters(e.currentTarget.valueAsNumber, setup.nA)}
										data-testid="nS"
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Ancilla particles" error={errorFor('nA')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										max="3"
										step="1"
										value={setup.nA}
										oninput={(e) => setRegisters(setup.nS, e.currentTarget.valueAsNumber)}
										data-testid="nA"
										{...props}
									/>
								{/snippet}
							</Field>
						</div>
						<SegmentedControl
							legend="Input space"
							options={[
								{ value: 'sym', label: 'Sym(S) ⊗ Sym(A)' },
								{ value: 'full', label: `Full (${2 ** N} states)` }
							]}
							bind:value={setup.input}
						/>
						<Field
							label="Ancilla weight a"
							hint="0 passive, 1 active; above 1 breaks rule 2."
							error={errorFor('ancillaWeight')}
						>
							{#snippet children(props)}
								<input
									class="control"
									type="number"
									min="0"
									max={MAX_WEIGHT}
									step="0.1"
									bind:value={setup.ancillaWeight}
									data-testid="weight"
									{...props}
								/>
							{/snippet}
						</Field>

						{#if noAncilla}
							<p class="muted" data-testid="no-ancilla-note">
								No ancilla: the coupling, the fields b and pulses on A are ignored, and pulses on
								both act on S only.
							</p>
						{/if}
						<fieldset class="group" data-testid="coupling" disabled={noAncilla}>
							<legend>Coupling α<sub>ij</sub>, S axis i by A axis j</legend>
							<table class="coupling">
								<thead>
									<tr>
										<td></td>
										{#each AXES as j (j)}<th scope="col">A {j}</th>{/each}
									</tr>
								</thead>
								<tbody>
									{#each AXES as i, a (i)}
										<tr>
											<th scope="row">S {i}</th>
											{#each AXES as j, b (j)}
												<td>
													<label class="toggle">
														<input
															type="checkbox"
															bind:checked={setup.coupling[3 * a + b]}
															data-testid="alpha-{i}{j}"
														/>
														α<sub>{i}{j}</sub>
													</label>
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</fieldset>

						<fieldset class="group">
							<legend>Static fields</legend>
							<div class="cluster">
								{#each AXES as axis, i (axis)}
									<label class="toggle">
										<input
											type="checkbox"
											bind:checked={setup.fieldA[i]}
											disabled={noAncilla}
											data-testid="field-b{axis}"
										/>
										b<sub>{axis}</sub>
									</label>
								{/each}
								<span class="muted">on A</span>
							</div>
							<div class="cluster">
								{#each AXES as axis, i (axis)}
									<label class="toggle">
										<input
											type="checkbox"
											bind:checked={setup.fieldS[i]}
											data-testid="field-c{axis}"
										/>
										c<sub>{axis}</sub>
									</label>
								{/each}
								<span class="muted">on S</span>
							</div>
						</fieldset>

						<div class="grid-2">
							<Field label="Control bound (1/t)" error={errorFor('controlBound')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										step="1"
										bind:value={setup.controlBound}
										data-testid="control-bound"
										{...props}
									/>
								{/snippet}
							</Field>
							<Field label="Pulse bound (× π)" error={errorFor('pulseBound')}>
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										max="4"
										step="0.1"
										value={Number((setup.pulseBound / Math.PI).toPrecision(10))}
										oninput={(e) => setPulseBoundPi(e.currentTarget.valueAsNumber)}
										data-testid="pulse-bound"
										{...props}
									/>
								{/snippet}
							</Field>
						</div>

						<fieldset class="group" data-testid="pulses">
							<legend>Pulses</legend>
							<Field label="Number of pulses" error={errorFor('pulses')}>
								{#snippet children(props)}
									<select
										class="control"
										value={setup.pulses.length}
										onchange={(e) => setPulseCount(Number(e.currentTarget.value))}
										data-testid="pulse-count"
										{...props}
									>
										{#each Array.from({ length: MAX_PULSES + 1 }, (_, k) => k) as k (k)}
											<option value={k}>{k}</option>
										{/each}
									</select>
								{/snippet}
							</Field>
							{#each setup.pulses as pulse, m (m)}
								<div class="grid-2 pulse">
									<Field label="Pulse {m + 1} time (t)" error={errorFor(`pulses.${m}.time`)}>
										{#snippet children(props)}
											<input
												class="control"
												type="number"
												min="0"
												max={setup.ancillaHold}
												step="0.01"
												value={Number(pulse.time.toFixed(4))}
												oninput={(e) => (pulse.time = e.currentTarget.valueAsNumber)}
												data-testid="pulse-{m}-time"
												{...props}
											/>
										{/snippet}
									</Field>
									<Field label="Pulse {m + 1} acts on" error={errorFor(`pulses.${m}.target`)}>
										{#snippet children(props)}
											<select
												class="control"
												bind:value={pulse.target}
												disabled={noAncilla}
												data-testid="pulse-{m}-target"
												{...props}
											>
												{#each targetOptions as o (o.value)}<option value={o.value}
														>{o.label}</option
													>{/each}
											</select>
										{/snippet}
									</Field>
								</div>
							{/each}
						</fieldset>

						{#if showCutoff}
							<Field
								label="Pseudomode Fock cutoff d"
								hint="Controlled Lorentzian dephasing runs explicit pseudomodes."
								error={errorFor('pmLevels')}
							>
								{#snippet children(props)}
									<select
										class="control"
										bind:value={setup.pmLevels}
										data-testid="pm-levels"
										{...props}
									>
										{#each PM_LEVELS as d (d)}<option value={d}>{d}</option>{/each}
									</select>
								{/snippet}
							</Field>
						{/if}
					</div>
				</Fold>
			</RunControls>
		</div>

		<div class="stack results">
			<Panel title="Answer">
				<p class="sr-only" role="status">{announcement}</p>
				<details class="rules-fold" data-testid="rules-fold">
					<summary
						><span class="badge" class:kept={broken.length === 0} data-testid="fair-test"
							><span aria-hidden="true">{broken.length === 0 ? '✓' : '✕'}</span>
							{broken.length === 0 ? 'Fair test' : 'Rules broken'}</span
						>
						<span class="rules-line">{rulesLine}</span></summary
					>
					<ul class="rules" data-testid="rules">
						{#each rules as r (r.id)}
							<li class:broken={!r.kept} data-testid="rule-{r.id}" data-kept={r.kept}>
								<span class="badge" class:kept={r.kept}
									><span aria-hidden="true">{r.kept ? '✓' : '✕'}</span>
									{r.kept ? 'Kept' : 'Broken'}</span
								>
								<span><strong>{r.id}. {r.title}.</strong> {r.reason}</span>
							</li>
						{/each}
						<li class="fixed">
							<span class="badge kept"><span aria-hidden="true">✓</span> Always</span>
							<span>{NO_FEEDBACK}</span>
						</li>
					</ul>
				</details>
				{#if !snapshot}
					<p class="muted placeholder">
						Pick a preset, then press Run. The MZI baseline comes first, then seeds keep running
						until you press Stop.
					</p>
				{:else}
					<div class="stack answer">
						{#if fromSaved}
							<Alert tone="info">Saved result from your last finished run.</Alert>
						{/if}
						{#if stale}
							<Alert tone="warning"
								>The setup has changed since this run. Press Run to rerun it.</Alert
							>
						{/if}
						{#if metrics}
							<Answer headline="{fmt(metrics.R, 3)}× the best MZI" data-testid="verdict">
								{#snippet extra()}
									<span
										class="sig"
										class:pass={metrics.significant}
										data-testid="significance"
										data-pass={metrics.significant}
										><span aria-hidden="true">{metrics.significant ? '✓' : '✕'}</span>
										{metrics.significant ? 'Significant' : 'Not significant'}</span
									>
								{/snippet}
								R = <span data-testid="metric-R">{fmt(metrics.R)}</span>, δR =
								<span data-testid="metric-deltaR">{fmt(metrics.deltaR, 2)}</span>: {verdictTail}
							</Answer>
						{:else}
							<p class="muted" data-testid="verdict">
								Working out the MZI baseline and the first seed…
							</p>
						{/if}
						{#if metrics}
							<Fold label="More ratios" summary={moreRatios} data-testid="more-ratios">
								<div>
									<div class="tiles">
										<div class="tile">
											<span class="tile-label"><T id="Rfixed" /></span>
											<span class="tile-value" data-testid="metric-Rfixed"
												>{fmt(metrics?.Rfixed)}</span
											>
											<span class="tile-note">MZI at t′ = t</span>
										</div>
										<div class="tile">
											<span class="tile-label"><T id="Rstd" /></span>
											<span class="tile-value" data-testid="metric-Rstd">{fmt(metrics?.Rstd)}</span>
											<span class="tile-note">best standard input</span>
										</div>
										{#if metrics?.Rint !== null && metrics?.Rint !== undefined}
											<div class="tile">
												<span class="tile-label"><T id="RintShort" /></span>
												<span class="tile-value" data-testid="metric-Rint">{fmt(metrics.Rint)}</span
												>
												<span class="tile-note">over coupling off</span>
											</div>
										{/if}
										<div class="tile">
											<span class="tile-label">Readout ratio</span>
											<span class="tile-value" data-testid="metric-readout"
												>{fmt(metrics?.readoutRatio)}</span
											>
											<span class="tile-note"
												>attained: ancilla {pct(metrics?.attained.ancilla)}, MZI {pct(
													metrics?.attained.mzi
												)}</span
											>
										</div>
									</div>
								</div>
							</Fold>
						{/if}

						<ConvergencePlot
							testId="convergence"
							traces={shownTraces}
							{refs}
							bestSeeds={{
								setup: snapshot.best.setup?.seed ?? null,
								companion: snapshot.best.companion?.seed ?? null
							}}
						/>
					</div>
				{/if}
				{#if !hasDetails}<div class="how-line"><Description /></div>{/if}
			</Panel>

			{#if snapshot && hasDetails}
				<Panel title="Details">
					<div class="stack">
						{#if best}
							<ControlsPlot
								testId="controls"
								entries={controlEntries}
								values={best.params}
								saturated={best.saturated}
							/>
						{/if}
						<div class="details-grid">
							{#if mzi}
								<div class="table-wrap">
									<table data-testid="mzi-details">
										<caption>MZI baseline ({mzi.particles} particles)</caption>
										<tbody>
											<tr
												><th scope="row">QFI, full space</th><td class="num">{fmt(mzi.qfiOpt)}</td
												></tr
											>
											<tr
												><th scope="row">QFI, Sym only</th><td class="num">{fmt(mzi.qfiSym)}</td
												></tr
											>
											<tr
												><th scope="row">Window t′</th><td class="num">{fmt(mzi.window, 3)}</td></tr
											>
											<tr><th scope="row">Bias</th><td class="num">{fmt(mzi.bias, 3)}</td></tr>
											<tr
												><th scope="row">QFI at t′ = t</th><td class="num"
													>{fmt(mzi.qfiFixedWindow)}</td
												></tr
											>
											<tr
												><th scope="row">Product</th><td class="num">{fmt(mzi.standard.product)}</td
												></tr
											>
											<tr><th scope="row">NOON</th><td class="num">{fmt(mzi.standard.noon)}</td></tr
											>
											<tr
												><th scope="row">Twin-Fock</th><td class="num"
													>{fmt(mzi.standard.twinFock)}</td
												></tr
											>
											<tr
												><th scope="row">One-axis twisted</th><td class="num"
													>{fmt(mzi.standard.oat)}</td
												></tr
											>
											<tr
												><th scope="row">Best readout</th><td class="num"
													>{fmt(mzi.readouts.best)}</td
												></tr
											>
										</tbody>
									</table>
								</div>
							{/if}
							{#if best}
								<div class="table-wrap">
									<table data-testid="best-details">
										<caption>Best ancilla scheme (seed {best.seed})</caption>
										<tbody>
											<tr><th scope="row">QFI, M steps</th><td class="num">{fmt(best.qfi)}</td></tr>
											<tr
												><th scope="row">QFI, 2M steps</th><td class="num">{fmt(best.qfiFine)}</td
												></tr
											>
											<tr
												><th scope="row">Companion QFI</th><td class="num"
													>{fmt(snapshot.best.companion?.qfi)}</td
												></tr
											>
											<tr
												><th scope="row">Readout: Jz on S</th><td class="num"
													>{fmt(best.readouts?.epSystem)}</td
												></tr
											>
											<tr
												><th scope="row">Readout: weighted joint Jz</th><td class="num"
													>{fmt(best.readouts?.epJoint)}</td
												></tr
											>
											<tr
												><th scope="row">Readout: parity</th><td class="num"
													>{fmt(best.readouts?.parity)}</td
												></tr
											>
											<tr
												><th scope="row">Evaluations</th><td class="num">{best.evaluations}</td></tr
											>
										</tbody>
									</table>
								</div>
							{/if}
						</div>
						<div class="how-line"><Description /></div>
					</div>
				</Panel>
			{/if}
		</div>
	</div>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--sp-3);
		align-items: start;
	}
	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
		}
	}
	/* One column on phones: Setup and run, then Answer, then Details. */
	.inputs,
	.results {
		min-width: 0;
	}
	p {
		margin: 0;
	}
	.muted {
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.placeholder {
		padding: var(--sp-4) 0;
	}
	.grid-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-2) var(--sp-3);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.group legend,
	.legend-like {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.legend-like {
		font-weight: 600;
	}
	.coupling {
		width: auto;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	.coupling th {
		padding: var(--sp-1) var(--sp-2);
		color: var(--text-muted);
		font-weight: 500;
		text-align: center;
	}
	.coupling td {
		padding: var(--sp-0);
	}
	.toggle {
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
	.toggle:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-bg);
	}
	.toggle input {
		margin: 0;
		accent-color: var(--accent);
	}
	.toggle:has(input:disabled) {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.toggle.wide {
		align-self: flex-start;
	}
	.noise-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
		gap: var(--sp-3);
	}
	.rules {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--text-sm);
	}
	.rules li {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
	}
	.badge {
		flex: none;
		min-width: 5.5rem;
		padding: 0 var(--sp-1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-sm);
		color: var(--danger-text);
		background: var(--danger-bg);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.badge.kept {
		border-color: var(--success);
		color: var(--success-text);
		background: var(--success-bg);
	}
	.rules-fold > summary {
		padding-block: var(--sp-1);
		cursor: pointer;
	}
	.rules-fold > summary .badge {
		min-width: 0;
		margin-right: var(--sp-1);
	}
	.rules-line {
		font-size: var(--text-md);
	}
	.rules-fold > .rules {
		margin-top: var(--sp-3);
	}
	/* Advanced: each heading spans the run settings grid. */
	.adv {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.adv + .adv {
		padding-top: var(--sp-2);
		border-top: 1px solid var(--border);
	}
	.adv h3 {
		font-size: var(--text-md);
		font-weight: 600;
	}
	/* The other ratios: plain label and value pairs, no frames. */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr));
		gap: var(--sp-3);
		padding-top: var(--sp-2);
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--sp-0);
		min-width: 0;
	}
	.tile-label {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.tile-value {
		font-size: var(--text-xl);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tile-note {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.sig {
		align-self: flex-start;
		padding: 0 var(--sp-1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-sm);
		color: var(--danger-text);
		background: var(--danger-bg);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.sig.pass {
		border-color: var(--success);
		color: var(--success-text);
		background: var(--success-bg);
	}
	.details-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: var(--sp-3);
		align-items: start;
	}
	/* Tables keep their row lines, no frame. */
	.table-wrap table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	caption {
		padding: var(--sp-1) 0;
		text-align: left;
		font-weight: 600;
	}
	.table-wrap th,
	.table-wrap td {
		padding: var(--sp-0) 0;
		height: 28px;
		border-top: 1px solid var(--border);
		text-align: left;
		font-weight: 400;
	}
	.table-wrap td.num {
		padding-left: var(--sp-2);
	}
	/* Customise setup closes the Run box, after a hairline. */
	.layout :global(.setup-fold) {
		margin-top: var(--sp-1);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--border);
	}
	/* How it works is the last line of the last box, after a hairline. */
	.how-line {
		margin-top: var(--sp-3);
		padding-top: var(--sp-2);
		border-top: 1px solid var(--border);
	}
	.how-line :global(details.how) {
		margin-top: 0;
	}
	.answer {
		margin-top: var(--sp-2);
	}
	.num {
		text-align: right !important;
		font-variant-numeric: tabular-nums;
	}
</style>
