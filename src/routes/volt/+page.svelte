<script lang="ts">
	import electedOfficials from '$lib/data/elected_officials.json';

	type Politician = {
		name: string;
		startDate: string;
		endDate: string;
		position: string;
		location: string;
		country: string;
		url: string;
	};

	// Parse date string to year (number)
	// Handles: "DD/MM/YYYY", "MM/YYYY", "YYYY"
	function parseDate(dateStr: string): number {
		const parts = dateStr.split('/');
		if (parts.length === 3) return parseInt(parts[2]);
		if (parts.length === 2) return parseInt(parts[1]);
		return parseInt(dateStr);
	}

	// Process politicians with parsed dates
	const processed: (Politician & { startYear: number; endYear: number })[] = electedOfficials.map((p) => ({
		...p,
		startYear: parseDate(p.startDate),
		endYear: parseDate(p.endDate)
	}));

	// Determine timeline range
	const minYear = Math.min(...processed.map((p) => p.startYear));
	const maxYear = Math.max(...processed.map((p) => p.endYear));
	const yearRange = maxYear - minYear + 1;

	// Group by country, then by location
	type PositionGroup = {
		location: string;
		politicians: Politician[];
	};

	const countryGroups = $derived.by(() => {
		const groups: Record<string, PositionGroup[]> = {};
		for (const p of electedOfficials) {
			if (!groups[p.country]) groups[p.country] = [];
			// Find if location already exists
			const existing = groups[p.country].find((g) => g.location === p.location);
			if (existing) {
				existing.politicians.push(p);
			} else {
				groups[p.country].push({ location: p.location, politicians: [p] });
			}
		}
		// Sort locations by latest start date
		for (const key of Object.keys(groups)) {
			groups[key].sort((a, b) => {
				const aStart = Math.max(...a.politicians.map((p) => parseDate(p.startDate)));
				const bStart = Math.max(...b.politicians.map((p) => parseDate(p.startDate)));
				return bStart - aStart;
			});
		}
		return groups;
	});

	// Country colors (lighter for better contrast with dark text)
	const countryColors: Record<string, string> = {
		'🇩🇪': '#FFEA00',  // Germany - bright gold
		'🇳🇱': '#FF9933',  // Netherlands - light orange
		'🇬🇷': '#3399FF', // Greece - bright blue
		'🇨🇾': '#FF7733', // Cyprus - coral orange
		'🇷🇴': '#3366CC', // Romania - medium blue
		'🇵🇹': '#00AC00', // Portugal - green
		'🇮🇹': '#009999', // Italy - teal
		'🇫🇷': '#E30717', // France - red
		'🇪🇺': '#4477DD'  // EU - softer blue
	};

	type CountryFilter = 'all' | '🇪🇺' | '🇳🇱' | '🇩🇪' | '🇨🇾' | '🇬🇷' | '🇷🇴' | '🇵🇹' | '🇮🇹' | '🇫🇷';

	let filterCountry = $state<CountryFilter>('all');

	const countries: { value: CountryFilter; label: string }[] = [
		{ value: 'all', label: 'All Countries' },
		{ value: '🇪🇺', label: 'European Parliament' },
		{ value: '🇳🇱', label: 'Netherlands' },
		{ value: '🇩🇪', label: 'Germany' },
		{ value: '🇨🇾', label: 'Cyprus' },
		{ value: '🇬🇷', label: 'Greece' },
		{ value: '🇷🇴', label: 'Romania' },
		{ value: '🇵🇹', label: 'Portugal' },
		{ value: '🇮🇹', label: 'Italy' },
		{ value: '🇫🇷', label: 'France' }
	];

	const filteredCountries = $derived.by(() => {
		const groups = countryGroups;
		if (filterCountry === 'all') return groups;
		if (filterCountry === '🇪🇺') {
			// Filter MEPs - group by location
			const mepsByLoc: Record<string, Politician[]> = {};
			for (const p of electedOfficials) {
				if (p.position === 'MEP' || p.position === 'MdEP') {
					if (!mepsByLoc[p.location]) mepsByLoc[p.location] = [];
					mepsByLoc[p.location].push(p);
				}
			}
			const result: PositionGroup[] = Object.entries(mepsByLoc).map(([location, politicians]) => ({
				location,
				politicians
			}));
			return { '🇪🇺': result };
		}
		return { [filterCountry]: groups[filterCountry] };
	});

	// Stats
	const stats = $derived.by(() => {
		const all = electedOfficials;
		return {
			total: all.length,
			meps: all.filter((p) => p.position === 'MEP' || p.position === 'MdEP').length,
			netherlands: all.filter((p) => p.country === '🇳🇱').length,
			germany: all.filter((p) => p.country === '🇩🇪').length,
			cyprus: all.filter((p) => p.country === '🇨🇾').length,
			greece: all.filter((p) => p.country === '🇬🇷').length,
			romania: all.filter((p) => p.country === '🇷🇴').length,
			portugal: all.filter((p) => p.country === '🇵🇹').length,
			italy: all.filter((p) => p.country === '🇮🇹').length,
			france: all.filter((p) => p.country === '🇫🇷').length
		};
	});

	const filteredStats = $derived.by(() => {
		const filtered = Object.values(filteredCountries).flatMap((groups) =>
			groups.flatMap((g) => g.politicians)
		);
		return {
			total: filtered.length,
			meps: filtered.filter((p) => p.position === 'MEP' || p.position === 'MdEP').length,
			netherlands: filtered.filter((p) => p.country === '🇳🇱').length,
			germany: filtered.filter((p) => p.country === '🇩🇪').length,
			cyprus: filtered.filter((p) => p.country === '🇨🇾').length,
			greece: filtered.filter((p) => p.country === '🇬🇷').length,
			romania: filtered.filter((p) => p.country === '🇷🇴').length,
			portugal: filtered.filter((p) => p.country === '🇵🇹').length,
			italy: filtered.filter((p) => p.country === '🇮🇹').length,
			france: filtered.filter((p) => p.country === '🇫🇷').length
		};
	});

	// Sorted summary bars (sorted alphabetically by label text)
	const sortedBars = $derived.by(() => {
		const bars = [
			{ key: 'all', label: 'All', count: filteredStats.total, flag: '🌍' },
			{ key: 'cyprus', label: 'Cyprus', count: filteredStats.cyprus, flag: '🇨🇾' },
			{ key: 'france', label: 'France', count: filteredStats.france, flag: '🇫🇷' },
			{ key: 'germany', label: 'Germany', count: filteredStats.germany, flag: '🇩🇪' },
			{ key: 'greece', label: 'Greece', count: filteredStats.greece, flag: '🇬🇷' },
			{ key: 'italy', label: 'Italy', count: filteredStats.italy, flag: '🇮🇹' },
			{ key: 'netherlands', label: 'Netherlands', count: filteredStats.netherlands, flag: '🇳🇱' },
			{ key: 'portugal', label: 'Portugal', count: filteredStats.portugal, flag: '🇵🇹' },
			{ key: 'romania', label: 'Romania', count: filteredStats.romania, flag: '🇷🇴' },
			{ key: 'meps', label: 'MEPs', count: filteredStats.meps, flag: '🇪🇺' }
		];
		return bars.sort((a, b) => a.label.localeCompare(b.label));
	});
</script>

<svelte:head>
	<title>Volt Representatives</title>
</svelte:head>

<div class="container">
	<header>
		<h1>VOLT REPRESENTATIVES</h1>
		<p class="subtitle">Elected politicians of the pan-European party Volt Europa</p>
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
				{#each sortedBars as bar (bar.key)}
					<button
						class="bar-row"
						class:active={filterCountry === bar.flag || (bar.key === 'all' && filterCountry === 'all')}
						onclick={() => (filterCountry = bar.key === 'all' ? 'all' : bar.flag as CountryFilter)}
					>
						<span class="bar-label">{bar.flag} {bar.label}</span>
						<div class="bar-container">
							<div
								class="bar-fill"
								style="width: {stats.total > 0
									? (bar.count / stats.total) * 100
									: 0}%"
							></div>
						</div>
						<span class="bar-value">{bar.count}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Timeline Header -->
	<div class="gantt-scroll-wrapper">
		<div class="timeline-header">
			<div class="timeline-label">TIMELINE ({minYear} - {maxYear})</div>
			<div class="timeline-scale">
				{#each Array(yearRange) as _, i}
					<span class="year-marker">{minYear + i}</span>
				{/each}
			</div>
		</div>

		<!-- Gantt Chart -->
		<div class="gantt-container">
			{#each Object.entries(filteredCountries) as [country, positions] (country)}
				{@const color = countryColors[country] || '#888'}
				{@const totalCount = positions.reduce((sum, g) => sum + g.politicians.length, 0)}
				<div class="gantt-country">
					<div class="country-header">
						<span class="country-flag">{country}</span>
						<span class="country-count">{totalCount}</span>
					</div>
					<div class="country-rows">
						{#each positions as group (group.location)}
							{@const barHeight = group.politicians.length * 14}
							<div class="gantt-row">
								<div class="row-label">{group.location}</div>
								<div class="row-bar-container" style="height: {barHeight}px;">
									{#each group.politicians as p, idx (p.name)}
										{@const start = parseDate(p.startDate)}
										{@const end = parseDate(p.endDate)}
										{@const left = ((start - minYear) / yearRange) * 100}
										{@const width = ((end - start + 1) / yearRange) * 100}
										{@const top = idx * 14}
										<div
											class="row-bar"
											style="left: {left}%; width: {width}%; background: {color}; top: {top}px; height: 14px;"
										>
											<a
												href={p.url}
												target="_blank"
												rel="noopener noreferrer"
												class="bar-link"
											>
												<span class="bar-text">{p.name} ({p.position})</span>
											</a>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.filter-section {
		margin-bottom: 1.5rem;
	}

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

	.timeline-scale {
		display: flex;
		justify-content: space-between;
		padding-left: 200px;
		padding-right: 1rem;
		min-width: 800px;
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
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.row-bar:hover {
		transform: scaleY(1.1);
		box-shadow: 0 0 12px currentColor;
		z-index: 5;
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
		.timeline-scale {
			padding-left: 120px;
			min-width: 600px;
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
		.timeline-scale {
			padding-left: 100px;
			min-width: 500px;
		}

		.gantt-row {
			grid-template-columns: 100px 1fr;
		}

		.row-label {
			font-size: 0.7rem;
		}
	}
</style>