<script lang="ts">
	import type { Analysis } from '$lib/information-pricing/analysis';
	import { Alert, Button, Panel } from '$lib/ui';
	import { formatNumber, money as makeMoney } from './format';
	import InputPlot from './InputPlot.svelte';
	import LossPlots from './LossPlots.svelte';
	import NumberInput from './NumberInput.svelte';
	import PolicyTree from './PolicyTree.svelte';
	import { scrollFocus } from './scroll-focus';
	import type { TreeSettings } from './editor';
	import VoiChart from './VoiChart.svelte';

	let {
		analysis,
		decisions,
		inputs,
		unit,
		tree = $bindable(),
		applied,
		busy,
		onretree
	}: {
		analysis: Analysis;
		/** Decision labels, model order. */
		decisions: readonly string[];
		/** Input labels, model order. */
		inputs: readonly string[];
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
	<Panel title="Headline">
		<dl class="headline" data-testid="headline">
			<div>
				<dt>Best decision</dt>
				<dd data-testid="best-decision">{decisions[summary.best]}</dd>
			</div>
			<div>
				<dt>Price of perfect information</dt>
				<dd data-testid="price">{money.format(summary.expectedLoss[summary.best])}</dd>
				<dd class="note">The best decision's expected loss</dd>
			</div>
			<div>
				<dt>Worst decision's expected loss</dt>
				<dd data-testid="worst">{money.format(summary.expectedLoss[summary.worst])}</dd>
				<dd class="note">{decisions[summary.worst]}</dd>
			</div>
		</dl>
	</Panel>

	<Panel title="Expected loss">
		<div class="table-wrap" use:scrollFocus={'Expected loss table'}>
			<table data-testid="loss-table">
				<caption class="sr-only">Expected opportunity loss per decision, worst first</caption>
				<thead>
					<tr>
						<th scope="col">Decision</th>
						<th scope="col" class="num">Expected loss{money.unit ? ` (${money.unit})` : ''}</th>
					</tr>
				</thead>
				<tbody>
					{#each summary.worstFirst as d (d)}
						<tr class:best={d === summary.best}>
							<th scope="row"
								>{decisions[d]}{#if d === summary.best}<span class="tag">best</span>{/if}</th
							>
							<td class="num">{formatNumber(money.scale(summary.expectedLoss[d]))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Panel>

	<Panel title="Value of information">
		<div class="stack">
			<p class="muted">
				What knowing one input saves, if you could sort scenarios into that many bins of it and pick
				the best decision per bin. Out of sample, 5-fold.
			</p>
			<div class="table-wrap" use:scrollFocus={'Value of information table'}>
				<table data-testid="voi-table">
					<caption class="sr-only"
						>Savings per input and number of bins{money.unit ? `, in ${money.unit}` : ''}</caption
					>
					<thead>
						<tr>
							<th scope="col">Input</th>
							{#each voi.bins as b (b)}<th scope="col" class="num">{b}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each voi.order as j (j)}
							<tr>
								<th scope="row">{inputs[j]}</th>
								{#each voi.savings[j] as v, k (k)}
									<td class="num">{formatNumber(money.scale(v))}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<VoiChart {voi} {inputs} {money} />
		</div>
	</Panel>

	<Panel title="Inputs and optimal decision">
		<div class="stack">
			<p class="muted">
				Each input's spread (dashed lines at the deciles), then the mean loss of every decision
				across its quantile groups. The ring and the coloured band show the best decision per group.
			</p>
			<ul class="key" aria-label="Decisions">
				{#each decisions as label, d (d)}
					<li>
						<span class="swatch" style="background: var(--data-{(d % 12) + 1})"></span>{label}
					</li>
				{/each}
			</ul>
			<div class="grid">
				{#each inputs as label, j (j)}
					<InputPlot
						{label}
						density={analysis.densities[j]}
						groups={analysis.groups[j]}
						{decisions}
						{money}
					/>
				{/each}
			</div>
		</div>
	</Panel>

	<Panel title="Loss distributions">
		<LossPlots distributions={analysis.distributions} {decisions} {money} />
	</Panel>

	<Panel title="Policy tree">
		<div class="stack">
			<p class="muted">
				A shallow rule for when to pick which decision, grown on 80% of the scenarios and scored on
				the other 20%.
			</p>
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
				<PolicyTree view={analysis.tree.view} {inputs} />
			{/if}
		</div>
	</Panel>
</div>

<style>
	.results {
		min-width: 0;
	}
	.headline {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--sp-3);
		margin: 0;
	}
	.headline div {
		display: flex;
		flex-direction: column;
		gap: var(--sp-0);
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	dt {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	dd {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	dd.note {
		font-size: var(--text-xs);
		font-weight: 400;
		color: var(--text-muted);
	}
	.muted {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--sp-1) var(--sp-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		white-space: nowrap;
	}
	thead th {
		background: var(--surface-2);
		font-weight: 600;
	}
	tbody th {
		font-weight: 500;
	}
	tbody tr:last-child > * {
		border-bottom: 0;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	tr.best > * {
		background: var(--success-bg);
	}
	.tag {
		margin-left: var(--sp-2);
		padding: 0 var(--sp-1);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		color: var(--success-text);
		border: 1px solid var(--success);
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
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
	.grid {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
	}
	.tree-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-2) var(--sp-3);
	}
	.tree-settings :global(.ui-field) {
		flex: 1 1 8rem;
	}
	.tree-settings :global(button) {
		margin-top: 22px;
	}
	.results :global(.chart) {
		margin: 0;
		min-width: 0;
	}
	.results :global(.chart figcaption) {
		font-size: var(--text-sm);
		font-weight: 500;
		margin-bottom: var(--sp-1);
	}
	.results :global(.chart:not(.tree) svg) {
		display: block;
		max-width: 100%;
		height: auto;
		overflow: visible;
	}
</style>
