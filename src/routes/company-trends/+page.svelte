<script lang="ts">
	import { onMount } from 'svelte';
	import datasetJson from './data/companies.json';
	import TrendsChart from './TrendsChart.svelte';
	import { Alert, Button, PageHeader, ScrollEdges, SegmentedControl } from '$lib/ui';
	import { loadDataset } from '$lib/company-trends/schema';
	import { companyTypes, DEFAULT_COMPANY_IDS, filterCompanies } from '$lib/company-trends/filter';
	import {
		assignColors,
		buildTrail,
		colorMode,
		formatMoney,
		formatPercent,
		latestUpTo,
		pointSources,
		REVENUE_FLOOR,
		revenueDomain,
		PALETTE_SIZE,
		typeSlot
	} from '$lib/company-trends/chart';
	import { quarterIndex, quarterLabel, quarterRange } from '$lib/company-trends/series';
	import type { Currency } from '$lib/company-trends/fx';

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

	const defaults = companies.filter((c) => DEFAULT_COMPANY_IDS.includes(c.id)).map((c) => c.id);

	let currency = $state<Currency>('EUR');
	let selectedIds = $state<string[]>(defaults.length > 0 ? defaults : companies.map((c) => c.id));
	let selectedTypes = $state<string[]>([...types]);
	let qi = $state(lastQi);
	let playing = $state(false);

	const visible = $derived(filterCompanies(companies, { selectedIds, types: selectedTypes }));

	// Trails for every company in the chosen currency; filtered views reuse them.
	const allTrails = $derived(companies.map((c) => buildTrail(c, quarters, currency, dataset.fx)));
	const visibleTrails = $derived(allTrails.filter((t) => visible.includes(t.company)));

	// Small selections (e.g. one industry) get a colour per company; larger ones per industry.
	const mode = $derived(colorMode(visibleTrails.length));
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

	const CURRENCIES = [
		{ value: 'EUR', label: 'EUR' },
		{ value: 'USD', label: 'USD' },
		{ value: 'GBP', label: 'GBP' }
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
	<PageHeader path="/company-trends"
		>Revenue (log scale) vs operating margin, 2000 to the last reported quarter, in {currency}</PageHeader
	>

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
				<SegmentedControl
					legend="Display currency"
					hideLegend
					options={CURRENCIES}
					bind:value={currency}
				/>
			</div>

			<fieldset class="ct-types">
				<legend class="ct-group-legend">Industries</legend>
				{#each types as type (type)}
					<label class="ct-check">
						<input
							type="checkbox"
							value={type}
							checked={selectedTypes.includes(type)}
							onchange={() => (selectedTypes = toggle(selectedTypes, type))}
						/>
						<span
							class="ct-swatch"
							class:ct-swatch-neutral={mode === 'company'}
							style="--c: var(--data-{typeSlot(type) + 1})"
							aria-hidden="true"
						></span>{type}
					</label>
				{/each}
				<span class="ct-note ct-color-mode" data-testid="color-mode"
					>{mode === 'company'
						? 'Coloured by company'
						: `Coloured by industry (select ≤ ${PALETTE_SIZE} companies to colour individually)`}</span
				>
			</fieldset>
		</div>

		<div class="ct-layout">
			<div class="ct-chart-col">
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
					<li>
						<svg width="14" height="14" aria-hidden="true"
							><circle cx="7" cy="7" r="2" class="ct-mark-interp" /></svg
						>interpolated quarter (log-linear between annual figures)
					</li>
					<li>
						<svg width="24" height="14" aria-hidden="true"
							><line x1="1" y1="7" x2="23" y2="7" class="ct-mark-gap" /></svg
						>data gap (missing years)
					</li>
					<li>
						<svg width="14" height="14" aria-hidden="true"
							><path d="M3,4L11,4L7,12Z" class="ct-mark-offscale" /></svg
						>off-scale margin (below −200%), pinned to the edge
					</li>
				</ul>
			</div>

			<div class="ct-companies" role="group" aria-labelledby="ct-companies-title">
				<div class="ct-companies-head">
					<span class="ct-group-legend" id="ct-companies-title">Companies</span>
					<Button size="sm" onclick={() => (selectedIds = companies.map((c) => c.id))}>All</Button>
					<Button size="sm" onclick={() => (selectedIds = [])}>None</Button>
				</div>
				{#each companiesByType as group (group.type)}
					<div
						class="ct-company-group"
						class:ct-muted={!selectedTypes.includes(group.type)}
						role="group"
						aria-labelledby="ct-group-{group.type}"
					>
						<div class="ct-company-group-title" id="ct-group-{group.type}">
							<span
								class="ct-swatch"
								class:ct-swatch-neutral={mode === 'company'}
								style="--c: var(--data-{typeSlot(group.type) + 1})"
								aria-hidden="true"
							></span>{group.type}
						</div>
						{#each group.companies as company (company.id)}
							<label class="ct-check ct-company">
								<input
									type="checkbox"
									value={company.id}
									checked={selectedIds.includes(company.id)}
									onchange={() => (selectedIds = toggle(selectedIds, company.id))}
								/>
								{#if mode === 'company' && colors.has(company.id)}
									<span
										class="ct-swatch"
										style="--c: {colors.get(company.id)}"
										aria-hidden="true"
										data-testid="company-swatch"
									></span>
								{/if}
								{company.name}
							</label>
						{/each}
					</div>
				{/each}
			</div>
		</div>

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

		<p class="ct-note ct-closing">
			Figures are fiscal-year totals in {currency}; quarters in between are estimated. Method and
			sources are in How it works.
		</p>
	{/if}

	<details class="how" data-testid="how">
		<summary>How it works</summary>
		<p>
			Pick industries and companies, then press Play or drag the quarter slider. Each dot is a
			company: revenue across, operating margin up. Figures are fiscal-year totals; quarters in
			between are estimated. USD and GBP use the
			<a href={dataset.meta.fxSource} target="_blank" rel="noreferrer">ECB</a> average rate of each fiscal
			year.
		</p>
		<p>
			The exact method is in the
			<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/company-trends.md">docs</a
			>.
		</p>
	</details>
</div>

<style>
	.ct-errors {
		margin: var(--sp-1) 0 0;
		padding-left: var(--sp-4);
	}

	.ct-controls {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
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

	.ct-types {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--sp-3);
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.ct-types > legend {
		float: left;
		margin-right: var(--sp-1);
	}

	.ct-group-legend {
		padding: 0;
		font-size: var(--text-sm);
		font-weight: 600;
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

	.ct-swatch-neutral {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--text-muted);
	}

	.ct-note {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.ct-color-mode {
		margin-left: auto;
	}

	.ct-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px;
		gap: var(--sp-3);
		align-items: start;
	}

	.ct-chart-col {
		min-width: 0;
	}

	.ct-scroll-hint {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-xs);
	}

	.ct-closing {
		margin-top: var(--sp-3);
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

	.ct-companies {
		max-height: 680px;
		overflow-y: auto;
		margin: 0;
		padding: var(--sp-2);
		min-width: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.ct-companies-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-1);
	}

	.ct-companies-head .ct-group-legend {
		margin-right: auto;
	}

	.ct-company-group {
		margin-bottom: var(--sp-2);
	}

	.ct-muted {
		opacity: 0.6;
	}

	.ct-company-group-title {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin-top: var(--sp-1);
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

	@media (max-width: 900px) {
		.ct-layout {
			grid-template-columns: 1fr;
		}

		.ct-companies {
			max-height: 260px;
		}
	}
</style>
