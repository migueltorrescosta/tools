<script lang="ts">
	import type { Analysis } from '$lib/information-pricing/analysis';
	import { Alert, Button, Panel } from '$lib/ui';
	import { dataColour, linear, linePath, money as makeMoney } from './format';
	import InputRow from './InputRow.svelte';
	import LossPlots from './LossPlots.svelte';
	import NumberInput from './NumberInput.svelte';
	import PolicyTree from './PolicyTree.svelte';
	import VoiChart from './VoiChart.svelte';
	import type { TreeSettings } from './editor';

	let {
		analysis,
		decisions,
		inputs,
		names,
		unit,
		tree = $bindable(),
		applied,
		busy,
		onretree
	}: {
		analysis: Analysis;
		/** Decision labels, model order. */
		decisions: readonly string[];
		/** Input labels, model order, e.g. "Number of Packages (N)". */
		inputs: readonly string[];
		/** Input names (the symbol when unnamed), model order, for the tree. */
		names: readonly string[];
		/** Native monetary unit of the run. */
		unit: string;
		tree: TreeSettings;
		/** The settings the shown tree was grown with. */
		applied: TreeSettings;
		/** True while the engine works; tree updates wait. */
		busy: boolean;
		onretree: () => void;
	} = $props();

	const summary = $derived(analysis.summary);
	const money = $derived(makeMoney(summary.displayExponent, unit ? summary.displayedUnit : ''));
	const voi = $derived(analysis.valueOfInformation);
	/** The largest bin count, whose savings rank the inputs. */
	const lastBin = $derived(voi.bins.length - 1);

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

	const treeErrors = $derived({
		maxDepth:
			Number.isInteger(tree.maxDepth) && tree.maxDepth >= 1 && tree.maxDepth <= 6
				? undefined
				: 'Use a whole number from 1 to 6.',
		minLeafPercent:
			tree.minLeafPercent > 0 && tree.minLeafPercent < 50
				? undefined
				: 'Use more than 0 and less than 50.',
		minImpurityDecrease:
			tree.minImpurityDecrease >= 0 && tree.minImpurityDecrease < 1
				? undefined
				: 'Use 0 or more and less than 1.'
	});
	const treeValid = $derived(Object.values(treeErrors).every((e) => e === undefined));
	const treeChanged = $derived(
		tree.maxDepth !== applied.maxDepth ||
			tree.minLeafPercent !== applied.minLeafPercent ||
			tree.minImpurityDecrease !== applied.minImpurityDecrease
	);
</script>

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
			<dt>Price of perfect information</dt>
			<dd data-testid="price">{money.format(summary.expectedLoss[summary.best])}</dd>
		</div>
		<div class="small">
			<dt>Worst ({decisions[summary.worst]}) loses</dt>
			<dd data-testid="worst">{money.format(summary.expectedLoss[summary.worst])}</dd>
		</div>
	</dl>

	<div data-testid="tree-box">
		<Panel title="Policy tree">
			<div class="stack" style="--gap: var(--sp-2)">
				<form
					class="tree-settings"
					onsubmit={(e) => {
						e.preventDefault();
						if (treeValid && treeChanged && !busy) onretree();
					}}
				>
					<NumberInput
						label="Max depth"
						value={tree.maxDepth}
						onchange={(v) => (tree.maxDepth = v)}
						error={treeErrors.maxDepth}
					/>
					<NumberInput
						label="Min leaf (%)"
						value={tree.minLeafPercent}
						onchange={(v) => (tree.minLeafPercent = v)}
						error={treeErrors.minLeafPercent}
					/>
					<NumberInput
						label="Min impurity decrease"
						value={tree.minImpurityDecrease}
						onchange={(v) => (tree.minImpurityDecrease = v)}
						error={treeErrors.minImpurityDecrease}
					/>
					<Button size="sm" type="submit" disabled={!treeValid || !treeChanged || busy}
						>Update tree</Button
					>
				</form>
				{#if 'error' in analysis.tree}
					<Alert tone="info">No tree to show: {analysis.tree.error}</Alert>
				{:else}
					<PolicyTree view={analysis.tree.view} inputs={names} />
				{/if}
			</div>
		</Panel>
	</div>

	<div class="columns">
		<div class="column" data-testid="inputs-box">
			<Panel title="Inputs by value of information">
				<div class="stack" style="--gap: var(--sp-2)">
					<ul class="key" aria-label="Decisions">
						{#each decisions as label, d (d)}
							<li><span class="swatch" style="background: {dataColour(d)}"></span>{label}</li>
						{/each}
					</ul>
					<div class="inputs">
						<div class="input-row head" aria-hidden="true">
							<span>Input · saves with {voi.bins[lastBin]} bins</span>
							<span>Spread (dashed: deciles)</span>
							<span>Mean loss per decile (log); band and ring: best</span>
						</div>
						{#each voi.order as j (j)}
							{@const saves = voi.savings[j][lastBin]}
							<div class="input-row" data-testid="input-voi-row" data-savings={saves}>
								<div class="row-label">
									<span class="name">{inputs[j]}</span>
									<span class="saves">
										<span class="sr-only">saves</span>
										<strong>{money.format(saves)}</strong>
										<svg
											class="spark"
											viewBox="0 0 {SPARK.w} {SPARK.h}"
											width={SPARK.w}
											height={SPARK.h}
											aria-hidden="true"><path d={spark(voi.savings[j])} /></svg
										>
										<span class="sr-only">with {voi.bins[lastBin]} bins</span>
									</span>
								</div>
								<InputRow
									label={inputs[j]}
									density={analysis.densities[j]}
									groups={analysis.groups[j]}
									{decisions}
									{money}
								/>
							</div>
						{/each}
					</div>
				</div>
			</Panel>
		</div>
		<div class="stack column side">
			<div data-testid="losses-box">
				<Panel title="Loss distributions">
					<LossPlots distributions={analysis.distributions} {decisions} {money} />
				</Panel>
			</div>
			<Panel title="Value of information">
				<VoiChart {voi} inputs={names} {money} />
			</Panel>
		</div>
	</div>
</div>

<style>
	.results {
		min-width: 0;
		--gap: var(--sp-3);
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
		font-weight: 500;
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

	/* The tree across the top; inputs on the left, losses and value of information on the right. */
	.columns {
		display: grid;
		gap: var(--sp-3);
		align-items: start;
	}
	@media (min-width: 1100px) {
		.columns {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
	.column {
		min-width: 0;
	}
	.tree-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-2);
	}
	.tree-settings :global(.ui-field) {
		flex: 0 1 9rem;
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
