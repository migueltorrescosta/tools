<script lang="ts" generics="Band">
	/**
	 * The Bayesian fit and the NPMLE posterior, shared by the 1D page and the
	 * 2D view: their buttons, progress, Stop and warnings. The parent shows the
	 * results (`bayes` in its parameter table, `npost` on its charts).
	 */
	import { Alert, Button, Field } from '$lib/ui';
	import { summarise, type Chain, type ParamPosterior } from '$lib/deconvolution/bayes';
	import { StoppedError, type EstimatePool } from '$lib/deconvolution/engine';
	import type { BayesModel, Task } from '$lib/deconvolution/estimate';
	import { runChains } from './chains';

	interface Props {
		pool: () => EstimatePool;
		seed: number;
		/** Another run is going: both buttons wait. */
		busy: boolean;
		/** The parametric fit to sample, or null when it didn't run. */
		model: BayesModel | null;
		mixture: boolean;
		/** The fit was flagged non-identifiable. */
		flat: boolean;
		/** The fit's parameters, for naming them in warnings. */
		params: readonly { role: string; component: number | null; key: string; label: string }[];
		defaultDraws: number;
		/** The NPMLE posterior's task for one chunk, or null when the NPMLE didn't run. */
		npmleTask: ((mass: Float64Array | null, sweeps: number, seed: number) => Task) | null;
		/** The kept draws of the masses, as what the charts shade. */
		npmleBand: (draws: Float64Array[]) => Band;
		/** e.g. "1/300 per point". */
		priorText: string;
		/** Appended to test ids: '' in 1D, '2' in 2D. */
		suffix: string;
		bayes: ParamPosterior[] | null;
		/** The NPMLE posterior's band, or null while it reruns. */
		onband: (band: Band | null) => void;
		/** Whether a chain run is going. */
		onrunning: (running: boolean) => void;
		onerror: (message: string) => void;
	}
	let {
		pool,
		seed,
		busy,
		model,
		mixture,
		flat,
		params,
		defaultDraws,
		npmleTask,
		npmleBand,
		priorText,
		suffix,
		bayes = $bindable(null),
		onband,
		onrunning,
		onerror
	}: Props = $props();

	const CHAINS = 4;
	const STEPS_PER_CHUNK = 100;
	const SWEEPS_PER_CHUNK = 25;
	/** Per NPMLE chain: chunks of warm-up, then chunks kept. */
	const NPMLE_CHUNKS = { warmup: 2, kept: 2 };

	// svelte-ignore state_referenced_locally
	let draws = $state(defaultDraws);
	let progress = $state<{ what: 'bayes' | 'npmle'; done: number; total: number } | null>(null);
	$effect(() => onrunning(!!progress));

	const blocked = $derived(
		mixture
			? 'Not offered for mixtures: their components swap labels and have no objective prior. The NPMLE posterior gives bands without a model.'
			: flat
				? 'The data can’t separate these parameters (see above), so no prior makes the posterior proper.'
				: null
	);
	const unconverged = $derived(bayes?.filter((b) => b.rhat > 1.01) ?? []);
	const atEdge = $derived(bayes?.filter((b) => b.edge) ?? []);
	const labelOf = (b: ParamPosterior) =>
		params.find((p) => p.role === b.role && p.component === b.component && p.key === b.key)
			?.label ?? b.key;
	const percent = $derived(progress ? Math.round((100 * progress.done) / progress.total) : 0);

	/** Runs `run` with progress over `total` chunks, reporting a stop or a failure through `onerror`. */
	async function chainRun<D>(
		what: 'bayes' | 'npmle',
		total: number,
		run: () => Promise<D[][]>,
		done: (d: D[][]) => void
	) {
		onerror('');
		progress = { what, done: 0, total };
		try {
			done(await run());
		} catch (err) {
			const name = what === 'bayes' ? 'Bayesian fit' : 'NPMLE posterior';
			onerror(err instanceof StoppedError ? `${name} stopped.` : (err as Error).message);
		} finally {
			progress = null;
		}
	}

	function bayesFit() {
		if (!model || blocked) return;
		const m = model;
		const n = Math.min(20_000, Math.max(100, Math.round(draws) || defaultDraws));
		const warmup = Math.round(n / 2);
		const chunks = Math.ceil((warmup + n) / STEPS_PER_CHUNK);
		let free: Parameters<typeof summarise>[0] = [];
		let box: [number, number][] = [];
		bayes = null;
		return chainRun<number[]>(
			'bayes',
			CHAINS * chunks,
			() =>
				runChains<Chain, number[]>(pool(), {
					chains: CHAINS,
					chunks,
					task: (c, k, chain) => ({
						kind: 'bayes',
						model: m,
						chain,
						steps: Math.min(STEPS_PER_CHUNK, warmup + n - k * STEPS_PER_CHUNK),
						warmup,
						seed: seed * 7919 + 1000 * c + 2 * k
					}),
					read: (r) => {
						if (r.kind !== 'bayes') throw new Error('Unexpected result');
						({ free, box } = r);
						return { state: r.chain, draws: r.draws };
					},
					progress: (done) => progress && (progress.done = done)
				}),
			(chains) => (bayes = summarise(free, box, chains))
		);
	}

	function npmlePosterior() {
		const task = npmleTask;
		if (!task) return;
		const chunks = NPMLE_CHUNKS.warmup + NPMLE_CHUNKS.kept;
		onband(null);
		return chainRun<Float64Array>(
			'npmle',
			CHAINS * chunks,
			() =>
				runChains<Float64Array, Float64Array>(pool(), {
					chains: CHAINS,
					chunks,
					task: (c, k, mass) => task(mass, SWEEPS_PER_CHUNK, seed * 7919 + 1000 * c + k),
					read: (r, k) => {
						if (r.kind !== 'posterior' && r.kind !== 'posterior2')
							throw new Error('Unexpected result');
						return {
							state: r.masses[r.masses.length - 1],
							draws: k >= NPMLE_CHUNKS.warmup ? r.masses : []
						};
					},
					progress: (done) => progress && (progress.done = done)
				}),
			(chains) => onband(npmleBand(chains.flat()))
		);
	}
</script>

{#if model}
	<div class="subsection">
		<h4>Bayesian fit</h4>
		<p class="muted">
			Samples the parametric model's posterior under an objective (Jeffreys) prior: 4 chains, half
			of each spent warming up. Credible intervals behave better than the 95% intervals near a
			range's edge and in small samples.
		</p>
		{#if blocked}
			<p class="muted" data-testid="bayes{suffix}-blocked">{blocked}</p>
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
							bind:value={draws}
							data-testid="bayes{suffix}-draws"
							{...props}
						/>
					{/snippet}
				</Field>
			</div>
			<div class="buttons">
				<Button onclick={bayesFit} disabled={busy || !!progress} data-testid="bayes{suffix}"
					>Run Bayesian fit</Button
				>
				<Button variant="danger" onclick={() => pool().stop()} disabled={progress?.what !== 'bayes'}
					>Stop</Button
				>
				{#if progress?.what === 'bayes'}<span class="muted" role="status">{percent}%</span>{/if}
			</div>
		{/if}
		{#if unconverged.length}
			<Alert tone="warning">
				<span data-testid="rhat">
					The chains disagree for {unconverged.map(labelOf).join(', ')} (R̂ above 1.01), so
					{unconverged.length === 1 ? 'its interval isn’t' : 'their intervals aren’t'} reliable yet. Run
					more draws.
				</span>
			</Alert>
		{/if}
		{#if atEdge.length}
			<Alert tone="warning">
				<span data-testid="bayes-edge">
					Draws of {atEdge.map(labelOf).join(' and ')} pile up at the edge of the allowed range, so the
					posterior may be improper there and the interval isn’t meaningful. Fix the noise or pick families
					the data can tell apart.
				</span>
			</Alert>
		{/if}
	</div>
{/if}

{#if npmleTask}
	<div class="subsection">
		<h4>NPMLE posterior</h4>
		<p class="muted">
			Samples the grid masses under a Dirichlet prior with {priorText} and shades where 90% of the draws
			fall, with the noise the other methods used.
		</p>
		<div class="buttons">
			<Button
				onclick={npmlePosterior}
				disabled={busy || !!progress}
				data-testid="npmle{suffix}-posterior">Run NPMLE posterior</Button
			>
			<Button variant="danger" onclick={() => pool().stop()} disabled={progress?.what !== 'npmle'}
				>Stop</Button
			>
			{#if progress?.what === 'npmle'}<span class="muted" role="status">{percent}%</span>{/if}
		</div>
	</div>
{/if}

<style>
	.subsection {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.subsection h4 {
		margin: var(--sp-2) 0 0;
		font-size: var(--text-md);
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
</style>
