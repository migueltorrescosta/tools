<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, PageHeader, ScrollEdges } from '#lib/ui/index.js';
	import electedOfficials from '#lib/data/elected_officials.json';
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
		visibleMandates,
		type Politician
	} from '#lib/volt.js';

	const officials: Politician[] = electedOfficials;

	// The axis always spans every mandate, so it stays put when former ones are hidden
	const timeline = timelineRange(officials);
	const { minYear, yearRange } = timeline;

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
	let showFormer = $state(false);
	// Phones open on the list; the timeline is one tap away. Desktop always shows the timeline.
	let phoneView = $state<'list' | 'timeline'>('list');

	const shown = $derived(visibleMandates(officials, now, showFormer));
	const filteredCountries = $derived(filterGroups(shown, filterCountry));

	// Options count what is on show, for every country, whichever one is picked
	const stats = $derived(computeStats(shown, officials));
	const options = $derived(summaryBars(stats));
	const hasGroups = computeStats(officials).groupEntries > 0;

	const personCount = (positions: { politicians: Politician[] }[]) =>
		positions.reduce((sum, g) => sum + g.politicians.filter((p) => !isGroupEntry(p)).length, 0);

	// One bar per mandate, stacked in its location row: at least 24px tall (WCAG 2.5.8)
	const BAR_H = 24;
	const BAR_STRIDE = BAR_H + 2;
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/volt" />

	<div class="volt-controls">
		<div class="volt-select">
			<label for="volt-country">Country</label>
			<select id="volt-country" class="control" bind:value={filterCountry}>
				{#each options as option (option.filter)}
					<option value={option.filter}>{option.label} ({option.count})</option>
				{/each}
			</select>
		</div>
		<label class="volt-former-toggle">
			<input type="checkbox" bind:checked={showFormer} />
			Show former mandates
		</label>
	</div>

	<ul class="volt-key" aria-label="Key">
		<li><span class="volt-sample" aria-hidden="true"></span>In office</li>
		{#if showFormer}
			<li><span class="volt-sample former" aria-hidden="true"></span>Former</li>
		{/if}
		{#if hasGroups}
			<li title="Not counted in the totals">
				<span class="volt-sample group-entry" aria-hidden="true"></span>Council group, size unknown<span
					class="sr-only">, not counted in the totals</span
				>
			</li>
		{/if}
	</ul>

	<div class="volt-views" class:show-timeline={phoneView === 'timeline'}>
		<div class="volt-view-bar">
			<span>{showFormer ? 'In office now and before' : 'In office now'}</span>
			<Button
				size="sm"
				onclick={() => (phoneView = phoneView === 'list' ? 'timeline' : 'list')}
				data-testid="volt-view-toggle"
			>
				{phoneView === 'list' ? 'Timeline view' : 'List view'}
			</Button>
		</div>

		<!-- The phone list: who holds which seat, grouped by country and place -->
		<div class="volt-list" data-testid="volt-list">
			{#each Object.entries(filteredCountries) as [country, positions] (country)}
				<section class="volt-country">
					<h2 class="volt-country-head">
						<span aria-hidden="true">{country}</span>
						{countryLabel(country)}
						<span class="volt-country-count">{personCount(positions)}</span>
					</h2>
					{#each positions as group (group.location)}
						<div class="volt-list-place">
							<h3>{group.location}</h3>
							<ul>
								{#each group.politicians as p (`${p.name}|${p.position}|${p.startDate}`)}
									<li class:former={isFormer(p, now)}>
										<a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>
										· {p.position}{#if isFormer(p, now)}
											· former, until {p.endDate}{/if}
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<p class="volt-empty">{@render emptyText()}</p>
					{/each}
				</section>
			{/each}
		</div>

		<!-- On phones the right edge fades while the timeline scrolls further right -->
		<div class="volt-timeline-view">
			<ScrollEdges fade data-testid="volt-scroll">
				<div class="volt-inner">
					<div class="volt-axis">
						<div class="volt-axis-gutter"></div>
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
							<section class="volt-country" data-testid="volt-country" style="--bar: {color}">
								<h2 class="volt-country-head">
									<span aria-hidden="true">{country}</span>
									{countryLabel(country)}
									<span class="volt-country-count">{personCount(positions)}</span>
								</h2>
								{#each positions as group (group.location)}
									<div class="volt-row">
										<div class="volt-location"><span>{group.location}</span></div>
										<div
											class="volt-track"
											style="height: {group.politicians.length * BAR_STRIDE -
												(BAR_STRIDE - BAR_H)}px;"
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
									<p class="volt-empty">{@render emptyText()}</p>
								{/each}
							</section>
						{/each}
					</div>
				</div>
			</ScrollEdges>
		</div>
	</div>

	<details class="how">
		<summary>How it works</summary>
		<p>
			This page lists the current and former elected politicians of the pan-European party Volt
			Europa. The data was last checked against official sources on {DATA_AS_OF}.
		</p>
		<p>
			Each bar is one mandate, from its start date to its end date, and links to an official source.
			A mandate is former once its end date has passed; an end date given as a bare year means 1
			January of that year. Former mandates are hidden until you tick Show former mandates.
		</p>
		<p>
			Counts are named individuals. Hatched rows stand for a council group of unknown size and are
			not counted. The European Parliament option shows the MEPs of every country.
		</p>
	</details>
</div>

{#snippet emptyText()}
	{#if showFormer}
		No representatives recorded for this filter.
	{:else}
		No one in office here now. Tick Show former mandates to see past ones.
	{/if}
{/snippet}

<style>
	.volt-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2) var(--sp-4);
	}

	.volt-select {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
	}

	.volt-select label {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.volt-select select {
		width: auto;
		min-width: 0;
	}

	.volt-former-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h-sm);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.volt-former-toggle input {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--accent);
	}

	/* The key: small sample bars drawn like the real ones */
	.volt-key {
		--bar: var(--accent);
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		margin: var(--sp-2) 0 var(--sp-3);
		padding: 0;
		list-style: none;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.volt-key li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.volt-sample {
		width: 22px;
		height: 12px;
		background: color-mix(in srgb, var(--bar) 22%, var(--surface));
		border: 1px solid var(--bar);
		border-left-width: 4px;
		border-radius: var(--radius-sm);
	}

	.volt-sample.former {
		filter: grayscale(1);
		border-style: dashed;
	}

	.volt-sample.group-entry {
		background: repeating-linear-gradient(
			135deg,
			color-mix(in srgb, var(--bar) 15%, var(--surface)) 0 4px,
			color-mix(in srgb, var(--bar) 35%, var(--surface)) 4px 6px
		);
	}

	/* Desktop: the timeline only. Phones: the list, or the timeline once asked for. */
	.volt-view-bar,
	.volt-list {
		display: none;
	}

	.volt-view-bar {
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		margin-bottom: var(--sp-2);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.volt-list {
		flex-direction: column;
		gap: var(--sp-2);
	}

	.volt-list-place {
		padding: var(--sp-1) var(--sp-3) var(--sp-2);
		border-top: 1px solid var(--border);
	}

	.volt-list-place h3 {
		margin: 0 0 var(--sp-0);
		font-size: var(--text-sm);
		font-weight: 400;
		color: var(--text-muted);
	}

	.volt-list-place ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.volt-list-place li {
		padding: var(--sp-0) 0;
		line-height: 1.5;
	}

	.volt-list-place li.former {
		color: var(--text-muted);
	}

	.volt-list-place a {
		color: var(--text);
	}

	@media (max-width: 600px) {
		.volt-view-bar {
			display: flex;
		}

		.volt-views:not(.show-timeline) .volt-list {
			display: flex;
		}

		.volt-views:not(.show-timeline) .volt-timeline-view {
			display: none;
		}

		.volt-select {
			flex: 1 1 100%;
		}

		.volt-select select {
			flex: 1;
		}
	}

	/* Axis and rows share one min-width and one location gutter, so years sit over the tracks.
	   minmax(0, 1fr): a wide font must not stretch the axis column past the rows. */
	.volt-inner {
		--gutter: 180px;
		min-width: 800px;
	}

	.volt-axis {
		display: grid;
		grid-template-columns: var(--gutter) minmax(0, 1fr);
		margin-bottom: var(--sp-1);
	}

	/* The location gutter stays put while the timeline scrolls under it */
	.volt-axis-gutter {
		position: sticky;
		left: 0;
		z-index: 7;
		background: var(--bg);
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
		/* Equal columns whatever the font: a wide fallback font must not stretch them off the tracks */
		flex: 1 1 0;
		min-width: 0;
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
	}

	.volt-country-head {
		position: sticky;
		left: 0;
		width: fit-content;
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
		grid-template-columns: var(--gutter) minmax(0, 1fr);
		align-items: center;
		padding: var(--sp-0) 0;
		border-top: 1px solid var(--border);
	}

	.volt-location {
		position: sticky;
		left: 0;
		z-index: 7;
		align-self: stretch;
		display: flex;
		align-items: center;
		background: var(--surface);
		padding: 0 var(--sp-3);
		font-size: var(--text-sm);
	}

	.volt-location span {
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
		/* Thin and muted, but in front of the bars so it marks every row */
		width: 1px;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
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

		/* Label every other year so the numbers don't run together; columns stay in place */
		.volt-year:nth-child(even) {
			visibility: hidden;
		}
	}
</style>
