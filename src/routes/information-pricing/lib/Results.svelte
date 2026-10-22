<script lang="ts">
	import type {
		GroupTable,
		InputDensity,
		PartialAnalysis,
		ValueOfInformation
	} from '$lib/information-pricing/analysis';
	import { Alert, Button, Maximizable, Panel } from '$lib/ui';
	import { dash, dataColour, inputColour, linear, linePath, money as makeMoney } from './format';
	import InputRow from './InputRow.svelte';
	import LossPlots from './LossPlots.svelte';
	import NumberInput from './NumberInput.svelte';
	import Pending from './Pending.svelte';
	import PolicyTree from './PolicyTree.svelte';
	import VoiChart from './VoiChart.svelte';
	import VoiScatter from './VoiScatter.svelte';
	import { treeErrors, treeValid, type TreeSettings } from './editor';

	let {
		analysis,
		decisions,
		inputs,
		names,
		intermediates,
		dependent,
		tree = $bindable(),
		applied,
		busy,
		onretree
	}: {
		/** The analysis so far: the value of information and the tree may still be computing. */
		analysis: PartialAnalysis;
		/** Decision labels, model order. */
		decisions: readonly string[];
		/** Input labels, model order, e.g. "Number of Packages (N)". */
		inputs: readonly string[];
		/** Input names (the symbol when unnamed), model order, for the tree. */
		names: readonly string[];
		/** Labels of the decision-independent intermediates, `analysis.intermediates` order. */
		intermediates: readonly string[];
		/** Labels of the intermediates that use the decision (no analysis). */
		dependent: readonly string[];
		tree: TreeSettings;
		/** The settings the shown tree was grown with. */
		applied: TreeSettings;
		/** True while the engine works; tree updates wait. */
		busy: boolean;
		onretree: () => void;
	} = $props();

	const summary = $derived(analysis.summary);
	const money = $derived(makeMoney(summary.displayExponent, summary.displayedUnit));
	const voi = $derived(analysis.valueOfInformation);
	const ivoi = $derived(analysis.intermediates.valueOfInformation);
	/** The largest bin count, whose savings rank the rows. */
	const binsShown = $derived(voi?.bins.at(-1) ?? 10);
	/** Rows by value of information once it's in; model order until then. */
	const orderOf = (v: ValueOfInformation | undefined, n: number) =>
		v?.order ?? Array.from({ length: n }, (_, j) => j);
	const inputOrder = $derived(orderOf(voi, analysis.densities.length));
	const intermediateOrder = $derived(orderOf(ivoi, analysis.intermediates.densities.length));

	/** Scatter: value of knowing each input first against the share of profit spread it explains. */
	const points = $derived(
		voi
			? analysis.profitShare.map((share, j) => ({
					j,
					name: names[j],
					saves: voi.savings[j].at(-1) ?? NaN,
					share
				}))
			: []
	);

	const LOSS_PARTS = [
		['box', 'Loss box plots'],
		['hist', 'Loss histograms']
	] as const;

	/** Last rendered heights, so a pending box takes the place of what it replaces. */
	let treeH = $state(300);
	let voiH = $state(640);

	/** A tiny line of the savings against the bin count. */
	const SPARK = { w: 56, h: 16 };
	function spark(savings: Float64Array): string {
		let lo = 0;
		let hi = 0;
		for (const v of savings) if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
		const sx = linear(0, Math.max(1, savings.length - 1), 1, SPARK.w - 1);
		const sy = linear(lo, hi > lo ? hi : lo + 1, SPARK.h - 1, 1);
		return linePath(
			Array.from(savings, (_, k) => sx(k)),
			Array.from(savings, sy)
		);
	}

	const errors = $derived(treeErrors(tree));
	const valid = $derived(treeValid(tree));
	const treeChanged = $derived(
		tree.maxDepth !== applied.maxDepth ||
			tree.minLeafPercent !== applied.minLeafPercent ||
			tree.minImpurityDecrease !== applied.minImpurityDecrease
	);
</script>

{#snippet row(
	kind: 'input' | 'intermediate',
	j: number,
	label: string,
	density: InputDensity,
	groups: GroupTable,
	savings: Float64Array | undefined
)}
	{@const saves = savings?.at(-1)}
	<div
		class="input-row {kind}"
		data-testid="{kind}-voi-row"
		data-savings={saves}
		aria-busy={savings ? undefined : 'true'}
	>
		<div class="row-label">
			<span class="name"
				>{#if kind === 'input'}<svg
						class="input-key"
						viewBox="0 0 16 10"
						width="16"
						height="10"
						aria-hidden="true"
						data-testid="input-swatch"
						><line
							x1="1"
							y1="5"
							x2="15"
							y2="5"
							stroke={inputColour(j)}
							stroke-dasharray={dash(j) || undefined}
						/></svg
					>{/if}{label}</span
			>
			{#if savings && saves !== undefined}
				<span class="saves">
					<span class="sr-only">saves</span>
					<strong>{money.format(saves)}</strong>
					<svg
						class="spark"
						viewBox="0 0 {SPARK.w} {SPARK.h}"
						width={SPARK.w}
						height={SPARK.h}
						aria-hidden="true"><path d={spark(savings)} /></svg
					>
					<span class="sr-only">with {binsShown} bins</span>
				</span>
			{:else}
				<Pending inline label="Computing the value of information…" />
			{/if}
		</div>
		<InputRow {label} {density} {groups} {decisions} {money} />
	</div>
{/snippet}

<div class="stack results" data-testid="results">
	<dl class="headline" data-testid="headline">
		<div>
			<dt>Best decision</dt>
			<dd>
				<span
					class="swatch"
					style="background: {dataColour(summary.best)}"
					data-testid="best-swatch"
				></span><span data-testid="best-decision">{decisions[summary.best]}</span>
			</dd>
		</div>
		<div>
			<dt>Expected value of perfect information</dt>
			<dd data-testid="price">{money.format(summary.expectedLoss[summary.best])}</dd>
		</div>
		<div class="small">
			<dt>Worst ({decisions[summary.worst]}) loses</dt>
			<dd data-testid="worst">{money.format(summary.expectedLoss[summary.worst])}</dd>
		</div>
	</dl>

	<div class="columns">
		<div class="column">
			<div data-testid="inputs-box">
				<Maximizable title="Inputs by value of information" plot={inputsPlot}>
					{#snippet frame(button)}
						<Panel title="Inputs by value of information" actions={button}>
							{@render inputsPlot(false)}
						</Panel>
					{/snippet}
				</Maximizable>
			</div>
			<div data-testid="losses-box">
				<Panel title="Loss distributions">
					<div class="stack" style="--gap: var(--sp-3)">
						{#each LOSS_PARTS as [part, title] (part)}
							<Maximizable {title}>
								{#snippet plot(maximized: boolean)}
									<LossPlots
										distributions={analysis.distributions}
										{decisions}
										{money}
										{part}
										{maximized}
									/>
								{/snippet}
							</Maximizable>
						{/each}
					</div>
				</Panel>
			</div>
		</div>
		<div class="column">
			<div data-testid="tree-box">
				<Maximizable title="Policy tree" plot={treePlot} disabled={!analysis.tree}>
					{#snippet frame(button)}
						<Panel title="Policy tree" actions={button}>
							<div class="stack" style="--gap: var(--sp-2)">
								<form
									class="tree-settings"
									onsubmit={(e) => {
										e.preventDefault();
										if (valid && treeChanged && !busy) onretree();
									}}
								>
									<NumberInput
										label="Max depth"
										value={tree.maxDepth}
										onchange={(v) => (tree.maxDepth = v)}
										error={errors.maxDepth}
									/>
									<NumberInput
										label="Min leaf (%)"
										value={tree.minLeafPercent}
										onchange={(v) => (tree.minLeafPercent = v)}
										error={errors.minLeafPercent}
									/>
									<NumberInput
										label="Min impurity decrease"
										value={tree.minImpurityDecrease}
										onchange={(v) => (tree.minImpurityDecrease = v)}
										error={errors.minImpurityDecrease}
									/>
									<Button size="sm" type="submit" disabled={!valid || !treeChanged || busy}
										>Update tree</Button
									>
								</form>
								{@render treePlot(false)}
							</div>
						</Panel>
					{/snippet}
				</Maximizable>
			</div>
			<div data-testid="voi-box">
				<Panel title="Value of information">
					{#if voi}
						<div class="stack" style="--gap: var(--sp-3)" bind:clientHeight={voiH}>
							<Maximizable title="Savings by number of bins">
								{#snippet plot(maximized: boolean)}
									<VoiChart
										{voi}
										inputs={names}
										{money}
										evpi={summary.expectedLoss[summary.best]}
										{maximized}
									/>
								{/snippet}
							</Maximizable>
							<Maximizable title="Value of knowing first vs share of profit spread">
								{#snippet plot(maximized: boolean)}
									<VoiScatter {points} {money} {maximized} />
								{/snippet}
							</Maximizable>
						</div>
					{:else}
						<Pending label="Computing the value of information…" height={voiH} />
					{/if}
				</Panel>
			</div>
		</div>
	</div>
</div>

{#snippet treePlot(maximized: boolean)}
	{#if !analysis.tree}
		<Pending label="Computing the policy tree…" height={treeH} />
	{:else if maximized}
		{#if 'error' in analysis.tree}
			<Alert tone="info">No tree to show: {analysis.tree.error}</Alert>
		{:else}
			<PolicyTree view={analysis.tree.view} inputs={names} maximized />
		{/if}
	{:else}
		<div bind:clientHeight={treeH}>
			{#if 'error' in analysis.tree}
				<Alert tone="info">No tree to show: {analysis.tree.error}</Alert>
			{:else}
				<PolicyTree view={analysis.tree.view} inputs={names} />
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet inputsPlot(maximized: boolean)}
	<div class="stack" style="--gap: var(--sp-2)">
		<ul class="key" aria-label="Decisions">
			{#each decisions as label, d (d)}
				<li><span class="swatch" style="background: {dataColour(d)}"></span>{label}</li>
			{/each}
		</ul>
		<div class="inputs">
			<div class="input-row head" aria-hidden="true">
				<span>Input · saves with {binsShown} bins</span>
				<span>Spread (dashed: deciles)</span>
				<span>Mean loss per decile (log); band and ring: best</span>
			</div>
			{#each inputOrder as j (j)}
				{@render row(
					'input',
					j,
					inputs[j],
					analysis.densities[j],
					analysis.groups[j],
					voi?.savings[j]
				)}
			{/each}
		</div>
		{#if intermediates.length > 0 || dependent.length > 0}
			<section
				class="intermediates"
				aria-labelledby="intermediates-voi-heading{maximized ? '-max' : ''}"
				data-testid="intermediates-box"
			>
				<h3 id="intermediates-voi-heading{maximized ? '-max' : ''}">
					Intermediates by value of information
				</h3>
				<p class="note">
					Worked out from the inputs, so their value overlaps with the inputs' and doesn't add up
					with them.
				</p>
				{#if intermediates.length > 0}
					<div class="inputs">
						<div class="input-row head" aria-hidden="true">
							<span>Saves with {binsShown} bins</span>
							<span>Spread (dashed: deciles)</span>
							<span>Mean loss per decile (log); band and ring: best</span>
						</div>
						{#each intermediateOrder as j (j)}
							{@render row(
								'intermediate',
								j,
								intermediates[j],
								analysis.intermediates.densities[j],
								analysis.intermediates.groups[j],
								ivoi?.savings[j]
							)}
						{/each}
					</div>
				{/if}
				{#if dependent.length > 0}
					<ul class="dependent" aria-label="Intermediates that depend on the decision">
						{#each dependent as label (label)}
							<li data-testid="dependent-intermediate">
								<span class="name">{label}</span> depends on the decision
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>
{/snippet}

<style>
	.results {
		min-width: 0;
		--gap: var(--sp-3);
		container-type: inline-size;
	}
	.headline {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-1) var(--sp-5);
		margin: 0;
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.headline div {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
	}
	dt {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	dd {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.headline .small {
		margin-left: auto;
	}
	.headline .small dt,
	.headline .small dd {
		font-size: var(--text-xs);
		font-weight: 400;
		color: var(--text-muted);
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.key li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.swatch {
		display: inline-block;
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
	dd .swatch {
		margin-right: var(--sp-1);
	}

	/* Input rows: label, spread, best decision per decile. */
	.inputs {
		container-type: inline-size;
	}
	.input-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0 var(--sp-3);
		padding: var(--sp-1) 0;
		border-top: 1px solid var(--border);
	}
	.input-row .row-label {
		grid-column: 1 / -1;
	}
	.input-row.head {
		display: none;
	}
	@container (min-width: 540px) {
		.input-row {
			grid-template-columns: 9rem minmax(0, 1fr) minmax(0, 1.2fr);
			align-items: center;
		}
		.input-row .row-label {
			grid-column: auto;
		}
		.input-row.head {
			display: grid;
			border-top: 0;
			font-size: var(--text-xs);
			color: var(--text-muted);
		}
	}
	.row-label {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 var(--sp-2);
		min-width: 0;
		font-size: var(--text-sm);
	}
	.row-label .name {
		display: inline-flex;
		align-items: baseline;
		gap: var(--sp-1);
		font-weight: 500;
	}
	/* The input's line in the value-of-information chart: its colour and dashes. */
	.input-key {
		flex: none;
		align-self: center;
	}
	.input-key line {
		stroke-width: 2.5;
	}
	.saves {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-variant-numeric: tabular-nums;
	}
	.saves strong {
		font-weight: 600;
	}
	.spark {
		flex: none;
	}
	.spark path {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	/*
	 * Two columns: inputs over losses | tree over value of information, each
	 * its own stack so a tall card leaves no gap beside it; one column (in
	 * that order) on phones.
	 */
	.columns {
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
		.columns {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
	/* Intermediates: their own heading under a divider, neutral rows. */
	.intermediates {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		margin-top: var(--sp-2);
		padding-top: var(--sp-3);
		border-top: 2px solid var(--border-strong);
	}
	.intermediates h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.intermediates .note {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.input-row.intermediate .spark path {
		stroke: var(--text-muted);
	}
	.dependent {
		margin: 0;
		padding: var(--sp-1) 0 0;
		list-style: none;
		font-size: var(--text-sm);
		color: var(--text-muted);
		border-top: 1px solid var(--border);
	}
	.dependent .name {
		font-weight: 500;
		color: var(--text);
	}
	.tree-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-2);
	}
	/* Each field as wide as its label, growing to share the row; they wrap in a narrow column. */
	.tree-settings :global(.ui-field) {
		flex: 1 1 auto;
		min-width: 4.5rem;
		max-width: 10rem;
	}
	.tree-settings :global(.ui-field label) {
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	.results :global(.chart) {
		margin: 0;
		min-width: 0;
	}
	.results :global(.chart figcaption) {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-bottom: var(--sp-1);
	}
	.results :global(.chart:not(.tree) svg) {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
</style>
