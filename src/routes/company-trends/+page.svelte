<script lang="ts">
	import { onMount } from 'svelte';
	import datasetJson from './data/companies.json';
	import TrendsChart from './TrendsChart.svelte';
	import { tick } from 'svelte';
	import { Alert, Button, PageHeader, ScrollEdges, Select } from '#lib/ui/index.js';
	import { loadDataset } from '#lib/company-trends/schema.js';
	import {
		companyTypes,
		DEFAULT_COMPANY_IDS,
		filterCompanies
	} from '#lib/company-trends/filter.js';
	import {
		assignColors,
		buildTrail,
		formatMoney,
		formatPercent,
		latestUpTo,
		pointSources,
		REVENUE_FLOOR,
		revenueDomain,
		PALETTE_SIZE
	} from '#lib/company-trends/chart.js';
	import { quarterIndex, quarterLabel, quarterRange } from '#lib/company-trends/series.js';
	import type { Currency } from '#lib/company-trends/fx.js';

	// Set once the page is interactive; e2e tests wait for it before clicking.
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const { dataset, errors } = loadDataset(datasetJson);
	const companies = errors.length === 0 ? dataset.companies : [];
	const types = companyTypes(companies);

	const FIRST_QUARTER = '2000Q1';
	const lastQi = companies.reduce(
		(max, c) => Math.max(max, quarterIndex(c.points[c.points.length - 1].quarter)),
		0
	);
	const quarters = quarterRange(FIRST_QUARTER, quarterLabel(lastQi));

	// Defaults in their listed order, which is also the order of the chips.
	const defaults = DEFAULT_COMPANY_IDS.filter((id) => companies.some((c) => c.id === id));

	let currency = $state<Currency>('EUR');
	let selectedIds = $state<string[]>(defaults.length > 0 ? defaults : companies.map((c) => c.id));
	let qi = $state(lastQi);
	let playing = $state(false);

	const visible = $derived(filterCompanies(companies, { selectedIds, types }));
	const byId = new Map(companies.map((c) => [c.id, c]));
	// The chips list the chosen companies in the order they were added.
	const chosen = $derived(selectedIds.flatMap((id) => byId.get(id) ?? []));

	// Trails for every company in the chosen currency; filtered views reuse them.
	const allTrails = $derived(companies.map((c) => buildTrail(c, quarters, currency, dataset.fx)));
	const visibleTrails = $derived(allTrails.filter((t) => visible.includes(t.company)));

	// Small selections (e.g. one industry) get a colour per company; larger ones per industry.
	// Company-mode palette slots from the previous assignment, so toggling a company keeps
	// every other company's colour. Plain (non-reactive) memory: it only feeds the next run.
	let colorSlots = new Map<string, number>();
	const colors = $derived.by(() => {
		const { colors, slots } = assignColors(visibleTrails, colorSlots);
		colorSlots = slots;
		return colors;
	});

	// The revenue axis spans every visible point across all quarters, so it stays fixed during
	// playback, floored so a pre-revenue filing cannot stretch it; the margin axis is fixed.
	const domain = $derived.by((): [number, number] => {
		const values = visibleTrails.flatMap((t) => t.points.map((p) => p.revenue));
		return revenueDomain(values) ?? [REVENUE_FLOOR, 1e6];
	});

	const quarter = $derived(quarterLabel(qi));

	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			if (qi >= lastQi) {
				playing = false;
			} else {
				qi += 1;
			}
		}, 140);
		return () => clearInterval(timer);
	});

	function togglePlay() {
		if (!playing && qi >= lastQi) qi = 0;
		playing = !playing;
	}

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	const companiesByType = types.map((type) => ({
		type,
		companies: companies.filter((c) => c.type === type)
	}));

	function addAll(ids: string[]) {
		selectedIds = [...selectedIds, ...ids.filter((id) => !selectedIds.includes(id))];
	}

	// The full list opens below the chips from the Add company button.
	let pickerOpen = $state(false);
	let addButton = $state<HTMLElement>();
	async function closePicker() {
		pickerOpen = false;
		await tick();
		addButton?.querySelector('button')?.focus();
	}

	const CURRENCIES = [
		{ value: 'EUR', label: '€ EUR' },
		{ value: 'USD', label: '$ USD' },
		{ value: 'GBP', label: '£ GBP' }
	] as const satisfies readonly { value: Currency; label: string }[];

	const tableRows = $derived(
		visibleTrails
			.flatMap((t) => {
				const point = latestUpTo(t, qi);
				return point ? [{ trail: t, point }] : [];
			})
			.sort((a, b) => b.point.revenue - a.point.revenue)
	);
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/company-trends" />

	{#if errors.length > 0}
		<Alert tone="danger">
			<strong>Dataset validation errors</strong>
			<ul class="ct-errors">
				{#each errors as error (error)}
					<li>{error}</li>
				{/each}
			</ul>
		</Alert>
	{:else if companies.length === 0}
		<Alert>
			<strong>Empty dataset.</strong> Company curation is in progress. Nothing to chart yet.
		</Alert>
	{:else}
		<div class="ct-controls">
			<div class="cluster ct-time">
				<Button onclick={togglePlay} data-testid="play"
					><span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>{playing
						? 'Pause'
						: 'Play'}</Button
				>
				<label class="ct-slider">
					<span>Quarter</span>
					<input
						type="range"
						min="0"
						max={lastQi}
						step="1"
						bind:value={qi}
						oninput={() => (playing = false)}
						aria-valuetext={quarter}
						data-testid="quarter-slider"
					/>
				</label>
				<output class="ct-quarter" data-testid="quarter-label">{quarter}</output>
				<div class="ct-currency">
					<Select label="Display currency" hideLabel options={CURRENCIES} bind:value={currency} />
				</div>
			</div>
		</div>

		<!-- On a narrow screen the 820 px chart scrolls sideways, opening at the large companies -->
		<ScrollEdges startAtEnd data-testid="chart-scroll">
			{#snippet hint()}<p class="ct-note ct-scroll-hint" data-testid="scroll-hint">
					Scroll sideways for smaller revenues.
				</p>{/snippet}
			<TrendsChart trails={visibleTrails} {qi} {quarter} {currency} {colors} {domain} />
		</ScrollEdges>
		<ul class="ct-marks" aria-label="Chart marks">
			<li>
				<svg width="14" height="14" aria-hidden="true"
					><circle cx="7" cy="7" r="4" class="ct-mark-reported" /></svg
				>reported
			</li>
			<li>
				<svg width="14" height="14" aria-hidden="true"
					><circle cx="7" cy="7" r="4" class="ct-mark-estimated" /></svg
				>estimated (private company, press reports)
			</li>
		</ul>

		<div class="ct-chips" role="group" aria-label="Companies">
			<ul class="ct-chip-list">
				{#each chosen as company (company.id)}
					<li class="ct-chip" data-testid="company-chip">
						<span
							class="ct-swatch"
							style="--c: {colors.get(company.id)}"
							aria-hidden="true"
							data-testid="company-swatch"
						></span>{company.name}<button
							type="button"
							class="ct-chip-remove"
							aria-label="Remove {company.name}"
							onclick={() => (selectedIds = selectedIds.filter((id) => id !== company.id))}
							><span aria-hidden="true">×</span></button
						>
					</li>
				{/each}
			</ul>
			<span class="ct-add" bind:this={addButton}>
				<Button
					size="sm"
					variant="ghost"
					aria-expanded={pickerOpen}
					aria-controls="ct-picker"
					onclick={() => (pickerOpen ? closePicker() : (pickerOpen = true))}>+ Add company</Button
				>
			</span>
		</div>
		{#if chosen.length === 0}
			<p class="ct-note ct-empty">No companies chosen. Add one to draw it.</p>
		{/if}

		{#if pickerOpen}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="ct-picker"
				id="ct-picker"
				role="group"
				aria-label="All companies"
				onkeydown={(e) => {
					if (e.key === 'Escape') closePicker();
				}}
			>
				<div class="ct-picker-head">
					<Button size="sm" onclick={() => (selectedIds = companies.map((c) => c.id))}>All</Button>
					<Button size="sm" onclick={() => (selectedIds = [])}>None</Button>
					<Button size="sm" variant="ghost" class="ct-done" onclick={closePicker}>Done</Button>
				</div>
				<div class="ct-groups">
					{#each companiesByType as group (group.type)}
						<div class="ct-company-group" role="group" aria-labelledby="ct-group-{group.type}">
							<div class="ct-company-group-title">
								<span id="ct-group-{group.type}">{group.type}</span>
								<button
									type="button"
									class="ct-link"
									aria-label="All {group.type}"
									onclick={() => addAll(group.companies.map((c) => c.id))}>All</button
								>
							</div>
							{#each group.companies as company (company.id)}
								<label class="ct-check">
									<input
										type="checkbox"
										value={company.id}
										checked={selectedIds.includes(company.id)}
										onchange={() => (selectedIds = toggle(selectedIds, company.id))}
									/>
									{company.name}
								</label>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<details class="how" data-testid="table-view">
			<summary>Data table · {quarter} · {currency}</summary>
			<div class="ct-table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Company</th>
							<th scope="col">Quarter</th>
							<th scope="col">Quality</th>
							<th scope="col" class="ct-num">Revenue</th>
							<th scope="col" class="ct-num">Op. expenses</th>
							<th scope="col" class="ct-num">Op. income</th>
							<th scope="col" class="ct-num">Op. margin</th>
							<th scope="col">Source</th>
						</tr>
					</thead>
					<tbody>
						{#each tableRows as row (row.trail.company.id)}
							<tr>
								<td>{row.trail.company.name}</td>
								<td>{row.point.quarter}</td>
								<td>{row.point.quality}</td>
								<td class="ct-num">{formatMoney(row.point.revenue, currency)}</td>
								<td class="ct-num">{formatMoney(row.point.expenses, currency)}</td>
								<td class="ct-num">{formatMoney(row.point.operatingIncome, currency)}</td>
								<td class="ct-num"
									>{row.point.margin === null ? '—' : formatPercent(row.point.margin, 1)}</td
								>
								<td class="ct-source">
									{#if row.point.quality === 'interpolated'}interpolated between{/if}
									{#each pointSources(row.trail, row.point) as s, i (s.quarter)}
										{#if i > 0}and{/if}
										{#if s.sourceUrl}
											<a href={s.sourceUrl} target="_blank" rel="noreferrer" title={s.source}
												>{row.point.quality === 'interpolated' ? s.quarter : s.source}</a
											>
										{:else}
											<span title={s.source}>{s.quarter}</span>
										{/if}
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}

	<details class="how" data-testid="how">
		<summary>How it works</summary>
		<p>
			The chart plots revenue (log scale) against operating margin for each company, from 2000 to
			the last reported quarter, in {currency}. Add or remove companies below the chart, then press
			Play or drag the quarter slider. Figures are fiscal-year totals; quarters in between are
			estimated. USD and GBP use the
			<a href={dataset.meta.fxSource} target="_blank" rel="noreferrer">ECB</a> average rate of each fiscal
			year.
		</p>
		<p>
			The exact method is in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/company-trends.md">docs</a
			>.
		</p>
		<p>
			Up to {PALETTE_SIZE} companies each get their own colour; with more, each industry gets one colour.
			The tooltip gives each point's quality. Other marks on the chart:
		</p>
		<ul class="ct-marks ct-marks-how">
			<li>
				<svg width="14" height="14" aria-hidden="true"
					><circle cx="7" cy="7" r="2" class="ct-mark-interp" /></svg
				>a small dot is an interpolated quarter (log-linear between annual figures)
			</li>
			<li>
				<svg width="24" height="14" aria-hidden="true"
					><line x1="1" y1="7" x2="23" y2="7" class="ct-mark-gap" /></svg
				>a dashed line is a data gap (missing years)
			</li>
			<li>
				<svg width="14" height="14" aria-hidden="true"
					><path d="M3,4L11,4L7,12Z" class="ct-mark-offscale" /></svg
				>a triangle is an off-scale margin (below −200%), pinned to the edge
			</li>
		</ul>
	</details>
</div>

<style>
	.ct-errors {
		margin: var(--sp-1) 0 0;
		padding-left: var(--sp-4);
	}

	.ct-controls {
		margin-bottom: var(--sp-3);
	}

	.ct-currency :global(select) {
		width: auto;
		min-height: var(--control-h-sm);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.ct-time {
		--gap: var(--sp-2) var(--sp-3);
	}

	.ct-slider {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex: 1;
		min-width: 200px;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.ct-slider input {
		flex: 1;
		min-width: 0;
		min-height: 24px;
		accent-color: var(--accent);
	}

	.ct-quarter {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-weight: 600;
		min-width: 4.5rem;
	}

	.ct-check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: 24px;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.ct-check input {
		width: 16px;
		height: 16px;
		margin: 0 var(--sp-1) 0 0;
		accent-color: var(--accent);
	}

	.ct-swatch {
		display: inline-block;
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c);
	}

	.ct-note {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.ct-scroll-hint {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-xs);
	}

	.ct-marks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-4);
		margin: var(--sp-2) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.ct-marks-how {
		flex-direction: column;
		margin-bottom: var(--sp-2);
		font-size: var(--text-sm);
	}

	.ct-marks li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.ct-mark-reported,
	.ct-mark-offscale {
		fill: var(--text-muted);
	}

	.ct-mark-estimated {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}

	.ct-mark-interp {
		fill: var(--text-muted);
		opacity: 0.6;
	}

	.ct-mark-gap {
		stroke: var(--text-muted);
		stroke-width: 2;
		stroke-dasharray: 3 4;
	}

	.ct-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2);
		margin-top: var(--sp-3);
	}

	.ct-chip-list {
		display: contents;
	}

	.ct-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h-sm);
		padding: 0 var(--sp-0) 0 var(--sp-2);
		font-size: var(--text-sm);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
	}

	.ct-chip-remove {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: var(--text-md);
		line-height: 1;
		cursor: pointer;
	}

	.ct-chip-remove:hover {
		color: var(--text);
		background: var(--surface-2);
	}

	.ct-add :global(.ui-btn) {
		border: 1px dashed var(--accent);
		border-radius: 999px;
		color: var(--accent);
	}

	.ct-empty {
		margin: var(--sp-2) 0 0;
	}

	.ct-picker {
		margin-top: var(--sp-2);
		padding: var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--box-shadow);
	}

	.ct-picker-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
	}

	.ct-picker-head :global(.ct-done) {
		margin-left: auto;
	}

	.ct-groups {
		columns: 13rem;
		column-gap: var(--sp-4);
	}

	.ct-company-group {
		break-inside: avoid;
		margin-bottom: var(--sp-3);
	}

	.ct-link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 500;
		text-transform: none;
		letter-spacing: normal;
		text-decoration: underline;
		cursor: pointer;
	}

	.ct-company-group-title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-2);
		margin-bottom: var(--sp-1);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.ct-table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		color: var(--text);
	}

	th,
	td {
		text-align: left;
		padding: var(--sp-1) var(--sp-2);
		border-bottom: 1px solid var(--border);
	}

	th {
		color: var(--text-muted);
		font-weight: 600;
	}

	.ct-num {
		text-align: right;
		font-family: var(--font-mono);
	}

	.ct-source {
		max-width: 22rem;
	}
</style>
