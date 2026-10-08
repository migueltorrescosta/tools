<script lang="ts">
	import { onMount } from 'svelte';
	import electedOfficials from '$lib/data/elected_officials.json';
	import {
		barGeometry,
		computeStats,
		countryColor,
		countryLabel,
		DATA_AS_OF,
		describeMandate,
		filterGroups,
		fractionalYear,
		isFormer,
		isGroupEntry,
		parseDate,
		summaryBars,
		timelinePercent,
		timelineRange,
		type Politician
	} from '$lib/volt';

	const officials: Politician[] = electedOfficials;

	const timeline = timelineRange(officials);
	const { minYear, maxYear, yearRange } = timeline;

	// Server render uses the data date; the client switches to the real date on mount
	let now = $state(parseDate(DATA_AS_OF));
	let hydrated = $state(false);
	onMount(() => {
		now = fractionalYear(new Date());
		hydrated = true;
	});
	const todayPct = $derived(timelinePercent(now, timeline));

	// 'all', the EU flag (MEPs) or a country flag present in the data
	let filterCountry = $state('all');

	const filteredCountries = $derived(filterGroups(officials, filterCountry));

	// Buttons always show unfiltered counts, so other countries never read as empty
	const stats = computeStats(officials);
	const bars = summaryBars(stats);
	const maxCount = Math.max(1, ...bars.map((b) => b.count));
</script>

<svelte:head>
	<title>Volt Representatives</title>
</svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>VOLT REPRESENTATIVES</h1>
		<p class="subtitle">
			Current and former elected politicians of the pan-European party Volt Europa
		</p>
		<p class="as-of">Data as of {DATA_AS_OF}</p>
	</header>

	<div class="summary-panel">
		<div class="panel-header">
			<span class="dot red"></span>
			<span class="dot yellow"></span>
			<span class="dot green"></span>
			<span class="panel-title">SUMMARY</span>
		</div>
		<div class="panel-content">
			<div class="bar-chart">
				{#each bars as bar (bar.filter)}
					{@const active = filterCountry === bar.filter}
					<button
						class="bar-row"
						class:active
						aria-pressed={active}
						onclick={() => (filterCountry = bar.filter)}
					>
						<span class="bar-label">{bar.flag} {bar.label}</span>
						<div class="bar-container">
							<div class="bar-fill" style="width: {(bar.count / maxCount) * 100}%"></div>
						</div>
						<span class="bar-value">{bar.count}</span>
					</button>
				{/each}
			</div>
			{#if stats.groupEntries > 0}
				<p class="panel-note">
					Counts are named individuals; {stats.groupEntries} rows stand for a council group of unknown
					size and are not counted.
				</p>
			{/if}
		</div>
	</div>

	<!-- Timeline Header -->
	<div class="gantt-scroll-wrapper">
		<div class="gantt-inner">
			<div class="timeline-header">
				<div class="timeline-label">TIMELINE ({minYear} - {maxYear})</div>
				<div class="timeline-scale">
					{#each Array(yearRange) as _, i (i)}
						<span class="year-marker" data-year={minYear + i}>{minYear + i}</span>
					{/each}
				</div>
			</div>

			<!-- Gantt Chart -->
			<div class="gantt-container">
				{#each Object.entries(filteredCountries) as [country, positions] (country)}
					{@const color = countryColor(country)}
					{@const totalCount = positions.reduce(
						(sum, g) => sum + g.politicians.filter((p) => !isGroupEntry(p)).length,
						0
					)}
					<div class="gantt-country">
						<div class="country-header">
							<span class="country-flag" aria-hidden="true">{country}</span>
							<span class="country-name">{countryLabel(country)}</span>
							<span class="country-count">{totalCount}</span>
						</div>
						<div class="country-rows">
							{#each positions as group (group.location)}
								{@const barHeight = group.politicians.length * 14}
								<div class="gantt-row">
									<div class="row-label">{group.location}</div>
									<div class="row-bar-container" style="height: {barHeight}px;">
										{#if todayPct !== null}
											<div class="today-line" style="left: {todayPct}%" aria-hidden="true"></div>
										{/if}
										{#each group.politicians as p, idx (p.name)}
											{@const { left, width } = barGeometry(p, timeline)}
											{@const top = idx * 14}
											{@const summary = describeMandate(p, now)}
											<div
												class="row-bar"
												class:former={isFormer(p, now)}
												class:group-entry={isGroupEntry(p)}
												style="left: {left}%; width: {width}%; background: {color}; top: {top}px; height: 14px;"
												title={summary}
											>
												<a
													href={p.url}
													target="_blank"
													rel="noopener noreferrer"
													class="bar-link"
													aria-label={summary}
												>
													<span class="bar-text">{p.name} ({p.position})</span>
												</a>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<p class="empty-state">No representatives recorded for this filter.</p>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.summary-panel {
		background: var(--futuristic-surface);
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 1.5rem;
	}

	.timeline-header {
		position: sticky;
		top: 0;
		background: var(--futuristic-bg);
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--futuristic-border);
		margin-bottom: 1rem;
		z-index: 10;
		display: flex;
		flex-direction: column;
	}

	.timeline-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		margin-bottom: 0.5rem;
		padding: 0 1rem;
	}

	/* Header and rows share one min-width, so year cells stay over the bar track */
	.gantt-inner {
		min-width: 800px;
	}

	.timeline-scale {
		display: flex;
		justify-content: space-between;
		padding-left: 200px;
	}

	.year-marker {
		font-size: 0.7rem;
		color: var(--futuristic-text-dim);
		flex: 1;
		text-align: center;
	}

	/* Scrollable wrapper for horizontal scrolling */
	.gantt-scroll-wrapper {
		overflow-x: auto;
		margin: 0 -1.5rem;
		padding: 0 1.5rem;
	}

	.gantt-scroll-wrapper::-webkit-scrollbar {
		height: 10px;
	}

	.gantt-scroll-wrapper::-webkit-scrollbar-track {
		background: var(--futuristic-bg);
	}

	.gantt-scroll-wrapper::-webkit-scrollbar-thumb {
		background: linear-gradient(90deg, var(--futuristic-cyan), var(--futuristic-blue));
		border-radius: 5px;
	}

	.gantt-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.gantt-country {
		background: var(--futuristic-surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.country-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 245, 255, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.country-flag {
		font-size: 1.25rem;
	}

	.country-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--futuristic-text);
	}

	.country-count {
		font-size: 0.75rem;
		color: var(--futuristic-cyan);
		font-weight: 600;
	}

	.country-rows {
		padding: 0.5rem 0;
	}

	.gantt-row {
		display: grid;
		grid-template-columns: 200px 1fr;
		align-items: center;
		padding: 0.25rem 0;
		min-height: 36px;
	}

	.gantt-row:nth-child(odd) {
		background: rgba(255, 255, 255, 0.02);
	}

	.gantt-row:nth-child(even) {
		background: rgba(255, 255, 255, 0.06);
	}

	.row-label {
		padding: 0 1rem;
		font-size: 0.875rem;
		color: var(--futuristic-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-bar-container {
		position: relative;
		height: 28px;
		background: rgba(255, 255, 255, 0.02);
	}

	.row-bar {
		position: absolute;
		top: 4px;
		height: 20px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.row-bar:hover {
		transform: scaleY(1.1);
		box-shadow: 0 0 12px currentColor;
		z-index: 5;
	}

	/* Grayscale keeps luminance, so black text keeps its contrast on former bars */
	.row-bar.former {
		filter: grayscale(1);
	}

	.row-bar.group-entry {
		background-image: repeating-linear-gradient(
			135deg,
			transparent 0 6px,
			rgba(255, 255, 255, 0.35) 6px 9px
		) !important;
	}

	.today-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--futuristic-magenta);
		z-index: 6;
		pointer-events: none;
	}

	.empty-state {
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
	}

	.as-of,
	.panel-note {
		font-size: 0.75rem;
		color: var(--futuristic-text-dim);
	}

	.panel-note {
		margin: 0;
		padding: 0 0.75rem 0.75rem;
	}

	.bar-link {
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0 0.5rem;
		text-decoration: none;
	}

	.bar-text {
		font-size: 0.7rem;
		color: #000;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
	}

	.bar-row {
		display: grid;
		grid-template-columns: 140px 1fr 40px;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.bar-row:hover {
		background: rgba(0, 245, 255, 0.1);
	}

	.bar-row.active {
		border-color: var(--futuristic-cyan);
		background: rgba(0, 245, 255, 0.15);
	}

	.bar-label {
		font-size: 0.8rem;
		color: var(--futuristic-text);
		text-align: left;
	}

	.bar-container {
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--futuristic-cyan), var(--futuristic-magenta));
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.bar-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		text-align: right;
	}

	/* Mobile styles */
	@media (max-width: 768px) {
		.gantt-inner {
			min-width: 600px;
		}

		.timeline-scale {
			padding-left: 120px;
		}

		.gantt-row {
			grid-template-columns: 120px 1fr;
		}

		.row-label {
			font-size: 0.75rem;
			padding: 0 0.5rem;
		}

		.bar-chart {
			overflow-x: auto;
			margin: 0 -1rem;
			padding: 0.75rem 1rem;
		}

		.bar-row {
			grid-template-columns: 100px 1fr 35px;
			min-width: 400px;
		}

		.bar-label {
			font-size: 0.7rem;
		}

		.gantt-scroll-wrapper {
			margin: 0 -1rem;
			padding: 0 1rem;
		}
	}

	@media (max-width: 480px) {
		.gantt-inner {
			min-width: 500px;
		}

		.timeline-scale {
			padding-left: 100px;
		}

		.gantt-row {
			grid-template-columns: 100px 1fr;
		}

		.row-label {
			font-size: 0.7rem;
		}
	}
</style>
