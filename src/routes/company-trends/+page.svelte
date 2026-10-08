<script lang="ts">
	import datasetJson from './data/companies.json';
	import TrendsChart from './TrendsChart.svelte';
	import { loadDataset } from '$lib/company-trends/schema';
	import { companyTypes, DEFAULT_COMPANY_IDS, filterCompanies } from '$lib/company-trends/filter';
	import {
		assignColors,
		buildTrail,
		colorMode,
		formatMoney,
		formatPercent,
		pointSources,
		REVENUE_FLOOR,
		revenueDomain,
		PALETTE_SIZE,
		typeSlot
	} from '$lib/company-trends/chart';
	import { quarterIndex, quarterLabel, quarterRange } from '$lib/company-trends/series';
	import type { Currency } from '$lib/company-trends/fx';

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
	const colors = $derived(assignColors(visibleTrails));

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

	const tableRows = $derived(
		visibleTrails
			.map((t) => {
				const upTo = t.points.filter((p) => p.qi <= qi);
				return { trail: t, point: upTo[upTo.length - 1] };
			})
			.filter((r) => r.point !== undefined)
			.sort((a, b) => b.point.revenue - a.point.revenue)
	);
</script>

<svelte:head>
	<title>Company Trends</title>
</svelte:head>

<div class="viz-root container">
	<header>
		<h1>COMPANY TRENDS</h1>
		<p class="subtitle">
			Revenue (log scale) vs operating margin trajectories, 2000 → last reported quarter, normalized
			to EUR
		</p>
	</header>

	{#if errors.length > 0}
		<div class="panel" role="alert">
			<span class="label">DATASET VALIDATION ERRORS</span>
			<ul>
				{#each errors as error (error)}
					<li class="hint">{error}</li>
				{/each}
			</ul>
		</div>
	{:else if companies.length === 0}
		<div class="panel">
			<span class="label">EMPTY DATASET</span>
			<p class="hint">Company curation is in progress. Nothing to chart yet.</p>
		</div>
	{:else}
		<div class="controls">
			<div class="time-row">
				<button
					class="format-btn play"
					onclick={togglePlay}
					aria-label={playing ? 'Pause' : 'Play'}
					data-testid="play">{playing ? '❚❚ Pause' : '▶ Play'}</button
				>
				<input
					type="range"
					min="0"
					max={lastQi}
					step="1"
					bind:value={qi}
					oninput={() => (playing = false)}
					aria-label="Quarter"
					aria-valuetext={quarter}
					data-testid="quarter-slider"
				/>
				<span class="quarter" data-testid="quarter-label">{quarter}</span>
				<div class="format-buttons" role="group" aria-label="Display currency">
					{#each ['EUR', 'USD', 'GBP'] as const as cur (cur)}
						<button
							class="format-btn"
							class:active={currency === cur}
							aria-pressed={currency === cur}
							onclick={() => (currency = cur)}>{cur}</button
						>
					{/each}
				</div>
			</div>

			<fieldset class="types">
				<legend class="label">TYPES</legend>
				{#each types as type (type)}
					<label class="type-chip" style="--c: var(--series-{typeSlot(type) + 1})">
						<input
							type="checkbox"
							checked={selectedTypes.includes(type)}
							onchange={() => (selectedTypes = toggle(selectedTypes, type))}
						/>
						<span class="swatch" class:neutral={mode === 'company'}></span>{type}
					</label>
				{/each}
				<span class="hint color-mode" data-testid="color-mode"
					>{mode === 'company'
						? 'Coloured by company'
						: `Coloured by industry (select ≤ ${PALETTE_SIZE} companies to colour individually)`}</span
				>
			</fieldset>
		</div>

		<div class="layout">
			<div class="chart-scroll">
				<TrendsChart trails={visibleTrails} {qi} {quarter} {currency} {colors} {domain} />
				<div class="legend hint">
					<span
						><svg width="14" height="14"><circle cx="7" cy="7" r="4" class="lg reported" /></svg
						>reported</span
					>
					<span
						><svg width="14" height="14"><circle cx="7" cy="7" r="4" class="lg estimated" /></svg
						>estimated (private company, press reports)</span
					>
					<span
						><svg width="14" height="14"><circle cx="7" cy="7" r="2" class="lg interp" /></svg
						>interpolated quarter (log-linear between annual figures)</span
					>
					<span
						><svg width="24" height="14"><line x1="1" y1="7" x2="23" y2="7" class="lg gap" /></svg
						>data gap (missing years)</span
					>
					<span
						><svg width="14" height="14"><path d="M3,4L11,4L7,12Z" class="lg offscale" /></svg
						>off-scale margin (below −200%), pinned to the edge</span
					>
				</div>
			</div>

			<aside class="company-list">
				<div class="list-head">
					<span class="label">COMPANIES</span>
					<button class="link-btn" onclick={() => (selectedIds = companies.map((c) => c.id))}
						>all</button
					>
					<button class="link-btn" onclick={() => (selectedIds = [])}>none</button>
				</div>
				{#each companiesByType as group (group.type)}
					<div class="group" class:muted={!selectedTypes.includes(group.type)}>
						<div class="group-title" style="--c: var(--series-{typeSlot(group.type) + 1})">
							<span class="swatch" class:neutral={mode === 'company'}></span>{group.type}
						</div>
						{#each group.companies as company (company.id)}
							<label class="company-row">
								<input
									type="checkbox"
									value={company.id}
									checked={selectedIds.includes(company.id)}
									onchange={() => (selectedIds = toggle(selectedIds, company.id))}
								/>
								{#if mode === 'company' && colors.has(company.id)}
									<span
										class="swatch"
										style="--c: {colors.get(company.id)}"
										data-testid="company-swatch"
									></span>
								{/if}
								{company.name}
							</label>
						{/each}
					</div>
				{/each}
			</aside>
		</div>

		<details class="panel table-view">
			<summary class="label">TABLE VIEW · {quarter} · {currency}</summary>
			<table>
				<thead>
					<tr>
						<th>Company</th>
						<th>Quarter</th>
						<th>Quality</th>
						<th>Revenue</th>
						<th>Op. expenses</th>
						<th>Op. income</th>
						<th>Op. margin</th>
						<th>Source</th>
					</tr>
				</thead>
				<tbody>
					{#each tableRows as row (row.trail.company.id)}
						<tr>
							<td>{row.trail.company.name}</td>
							<td>{row.point.quarter}</td>
							<td>{row.point.quality}</td>
							<td>{formatMoney(row.point.revenue, currency)}</td>
							<td>{formatMoney(row.point.expenses, currency)}</td>
							<td>{formatMoney(row.point.operatingIncome, currency)}</td>
							<td>{row.point.margin === null ? '—' : formatPercent(row.point.margin, 1)}</td>
							<td class="source-cell">
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
		</details>

		<p class="hint">
			Units: {dataset.meta.units}. Operating margin = operating income / revenue, on a fixed −200%
			to +100% axis; expenses = revenue − operating income. Values are fiscal-year figures placed at
			each fiscal year's closing quarter; quarters in between are log-interpolated.
		</p>
	{/if}

	{#if errors.length === 0}
		<p class="hint">
			{dataset.meta.fxMethodology}
			(<a href={dataset.meta.fxSource} target="_blank" rel="noreferrer">FX source</a>)
		</p>
	{/if}
</div>

<style>
	/* Industry slots (validated for the dark surface): one per company type, in TYPE_ORDER. */
	.viz-root {
		color-scheme: dark;
		--chart-surface: #13131f;
		--text-primary: #f0f4f8;
		--text-secondary: #c8d4de;
		--text-muted: #8a96a3;
		--grid: rgba(200, 212, 222, 0.07);
		--grid-major: rgba(200, 212, 222, 0.16);
		--series-1: #3987e5;
		--series-2: #d95926;
		--series-3: #199e70;
		--series-4: #c98500;
		--series-5: #d55181;
		--series-6: #008300;
		--series-7: #9085e9;
		--series-8: #e66767;
		/*
		 * Per-company slots, used when <= 12 companies are visible. Ordered so every prefix
		 * stays maximally separated. validate_palette.js --mode dark --surface #13131f
		 * --pairs all: CVD PASS (worst 8.4), normal-vision PASS (worst 16.8), contrast PASS
		 * (all >= 3:1), chroma PASS. Lightness band FAIL by design: six slots sit at OKLCH
		 * L 0.69-0.79, above the 0.67 dark band, which 12 all-pairs-distinct hues require.
		 * Direct head labels and sidebar swatches back colour up as secondary encoding.
		 */
		--cseries-1: #cfbd00;
		--cseries-2: #5a3ffc;
		--cseries-3: #cf0909;
		--cseries-4: #24c6fc;
		--cseries-5: #905187;
		--cseries-6: #3fb475;
		--cseries-7: #b475fc;
		--cseries-8: #f399c6;
		--cseries-9: #007536;
		--cseries-10: #f37536;
		--cseries-11: #fc00c6;
		--cseries-12: #0087c6;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.time-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.time-row .format-buttons {
		flex-wrap: nowrap;
	}

	.time-row input[type='range'] {
		flex: 1;
		min-width: 200px;
		accent-color: var(--futuristic-cyan);
	}

	.play {
		min-width: 6.5rem;
	}

	.quarter {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.1rem;
		color: var(--futuristic-cyan);
		min-width: 4.5rem;
	}

	.types {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		align-items: center;
		border: none;
		padding: 0;
		margin: 0;
	}

	.types legend {
		float: left;
		margin-right: 0.5rem;
	}

	.type-chip,
	.company-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c);
	}

	.swatch.neutral {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--text-muted);
	}

	.color-mode {
		margin-left: auto;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px;
		gap: 0.75rem;
		align-items: start;
	}

	.chart-scroll {
		overflow-x: auto;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.1rem;
		margin-top: 0.4rem;
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.lg.reported {
		fill: var(--text-secondary);
	}

	.lg.estimated {
		fill: none;
		stroke: var(--text-secondary);
		stroke-width: 1.5;
	}

	.lg.interp {
		fill: var(--text-secondary);
		opacity: 0.45;
	}

	.lg.offscale {
		fill: var(--text-secondary);
	}

	.lg.gap {
		stroke: var(--text-secondary);
		stroke-width: 2;
		stroke-dasharray: 3 4;
		opacity: 0.6;
	}

	.company-list {
		max-height: 680px;
		overflow-y: auto;
		padding: 0.5rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
	}

	.list-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: var(--futuristic-cyan);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0;
		text-decoration: underline;
	}

	.group {
		margin-bottom: 0.5rem;
	}

	.group.muted {
		opacity: 0.4;
	}

	.group-title {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
	}

	.table-view {
		margin-top: 0.75rem;
	}

	.table-view summary {
		cursor: pointer;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.25rem 0.5rem;
		border-bottom: 1px solid rgba(200, 212, 222, 0.1);
	}

	td:nth-child(n + 4),
	th:nth-child(n + 4) {
		text-align: right;
		font-family: 'JetBrains Mono', monospace;
	}

	td.source-cell,
	th:last-child {
		text-align: left;
		font-family: inherit;
		max-width: 22rem;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.company-list {
			max-height: 260px;
		}
	}
</style>
