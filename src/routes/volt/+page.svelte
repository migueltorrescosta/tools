<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, PageHeader } from '$lib/ui';
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

	// One bar per mandate, stacked in its location row: at least 24px tall (WCAG 2.5.8)
	const BAR_H = 24;
	const BAR_STRIDE = BAR_H + 2;
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/volt">
		Current and former elected politicians of the pan-European party Volt Europa · Data as of {DATA_AS_OF}
	</PageHeader>

	<div class="volt-filters cluster" role="group" aria-label="Filter by country">
		{#each bars as bar (bar.filter)}
			<Button
				size="sm"
				pressed={filterCountry === bar.filter}
				aria-label="{bar.label}, {bar.count} representatives"
				onclick={() => (filterCountry = bar.filter)}
			>
				<span aria-hidden="true">{bar.flag}</span>
				{bar.label}
				<span class="volt-chip-count">{bar.count}</span>
			</Button>
		{/each}
	</div>
	{#if stats.groupEntries > 0}
		<p class="volt-note">
			Counts are named individuals; {stats.groupEntries} hatched rows stand for a council group of unknown
			size and are not counted.
		</p>
	{/if}

	<div class="volt-scroll">
		<div class="volt-inner">
			<div class="volt-axis">
				<div class="volt-axis-track">
					{#if todayPct !== null}
						<span class="volt-today-label" style="left: {todayPct}%">Today</span>
					{/if}
					<div class="volt-years">
						{#each Array(yearRange) as _, i (i)}
							<span class="volt-year">{minYear + i}</span>
						{/each}
					</div>
				</div>
			</div>

			<div class="volt-countries" data-testid="volt-timeline">
				{#each Object.entries(filteredCountries) as [country, positions] (country)}
					{@const color = countryColor(country)}
					{@const totalCount = positions.reduce(
						(sum, g) => sum + g.politicians.filter((p) => !isGroupEntry(p)).length,
						0
					)}
					<section class="volt-country" data-testid="volt-country" style="--bar: {color}">
						<h2 class="volt-country-head">
							<span aria-hidden="true">{country}</span>
							{countryLabel(country)}
							<span class="volt-country-count">{totalCount}</span>
						</h2>
						{#each positions as group (group.location)}
							<div class="volt-row">
								<div class="volt-location">{group.location}</div>
								<div
									class="volt-track"
									style="height: {group.politicians.length * BAR_STRIDE - (BAR_STRIDE - BAR_H)}px;"
								>
									{#if todayPct !== null}
										<div class="volt-today" style="left: {todayPct}%" aria-hidden="true"></div>
									{/if}
									{#each group.politicians as p, idx (`${p.name}|${p.position}|${p.startDate}`)}
										{@const { left, width } = barGeometry(p, timeline)}
										{@const summary = describeMandate(p, now)}
										<a
											href={p.url}
											target="_blank"
											rel="noopener noreferrer"
											class="volt-bar"
											class:former={isFormer(p, now)}
											class:group-entry={isGroupEntry(p)}
											data-testid="volt-bar"
											style="left: {left}%; width: {width}%; top: {idx * BAR_STRIDE}px;"
											title={summary}
											aria-label={summary}
										>
											{p.name} ({p.position})
										</a>
									{/each}
								</div>
							</div>
						{:else}
							<p class="volt-empty">No representatives recorded for this filter.</p>
						{/each}
					</section>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.volt-filters {
		--gap: var(--sp-1);
	}

	.volt-chip-count {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.volt-note {
		margin: var(--sp-1) 0 var(--sp-3);
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.volt-scroll {
		overflow-x: auto;
	}

	/* Axis and rows share one min-width and one location gutter, so years sit over the tracks */
	.volt-inner {
		--gutter: 180px;
		min-width: 800px;
	}

	.volt-axis {
		padding-left: var(--gutter);
		margin-bottom: var(--sp-1);
	}

	.volt-axis-track {
		position: relative;
		padding-top: 1.25rem;
	}

	.volt-years {
		display: flex;
		border-bottom: 1px solid var(--border);
	}

	.volt-year {
		flex: 1;
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.volt-today-label {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--accent);
	}

	.volt-countries {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.volt-country {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.volt-country-head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-1);
		padding: var(--sp-1) var(--sp-3);
		font-size: var(--text-md);
	}

	.volt-country-count {
		font-weight: 400;
		color: var(--text-muted);
	}

	.volt-row {
		display: grid;
		grid-template-columns: var(--gutter) 1fr;
		align-items: center;
		padding: var(--sp-0) 0;
		border-top: 1px solid var(--border);
	}

	.volt-location {
		padding: 0 var(--sp-3);
		font-size: var(--text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.volt-track {
		position: relative;
	}

	/* Text on a tint of the country colour, edged in the solid colour: readable in both themes */
	.volt-bar {
		position: absolute;
		height: 24px;
		display: flex;
		align-items: center;
		padding: 0 var(--sp-1);
		background: color-mix(in srgb, var(--bar) 22%, var(--surface));
		border: 1px solid var(--bar);
		border-left-width: 4px;
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: var(--text-xs);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-decoration: none;
	}

	.volt-bar:hover {
		background: color-mix(in srgb, var(--bar) 35%, var(--surface));
		color: var(--text);
		z-index: 5;
	}

	/* Former mandates: grey and dashed, so the state does not rest on colour alone */
	.volt-bar.former {
		filter: grayscale(1);
		border-style: dashed;
	}

	.volt-bar.group-entry {
		background: repeating-linear-gradient(
			135deg,
			color-mix(in srgb, var(--bar) 15%, var(--surface)) 0 6px,
			color-mix(in srgb, var(--bar) 30%, var(--surface)) 6px 9px
		);
	}

	.volt-today {
		position: absolute;
		top: calc(-1 * var(--sp-0));
		bottom: calc(-1 * var(--sp-0));
		width: 2px;
		margin-left: -1px;
		background: var(--accent);
		z-index: 6;
		pointer-events: none;
	}

	.volt-empty {
		margin: 0;
		padding: var(--sp-1) var(--sp-3);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		.volt-inner {
			--gutter: 120px;
			min-width: 600px;
		}

		.volt-location {
			font-size: var(--text-xs);
			padding: 0 var(--sp-2);
		}
	}

	@media (max-width: 480px) {
		.volt-inner {
			--gutter: 100px;
			min-width: 500px;
		}
	}
</style>
