<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import timelinesData from './data/timelines.json';

	interface Timeline {
		id: string;
		shortTitle: string;
		description: string;
	}

	interface Event {
		id: number;
		emoji: string;
		date: string;
		title: string;
		description: string;
		url?: string;
		conceptDescription?: string;
		valueAdd?: string;
	}

	type TimelineRow = { type: 'year'; year: number } | { type: 'events'; events: Event[] };

	const timelines = timelinesData as Timeline[];

	let selectedTimelineId = $state<string>('');
	let filteredEvents = $state<Event[]>([]);
	let timelineRows = $state<TimelineRow[]>([]);
	let loading = $state(false);
	const isRichContent = $derived(
		filteredEvents.length > 0 && filteredEvents.some((e) => e.conceptDescription || e.valueAdd)
	);
	let tooltipState = $state<{ visible: boolean; x: number; y: number; content: string }>({
		visible: false,
		x: 0,
		y: 0,
		content: ''
	});

	// Cache for loaded timeline events
	const timelineCache = new Map<string, Event[]>();

	function showTooltip(event: MouseEvent, content: string) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		tooltipState = {
			visible: true,
			x: rect.left + rect.width / 2,
			y: rect.top - 8,
			content
		};
	}

	function hideTooltip() {
		tooltipState = { ...tooltipState, visible: false };
	}

	const COLUMNS = 3;

	function getYear(dateStr: string): number {
		return new Date(dateStr).getFullYear();
	}

	function formatShortDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short'
		});
	}

	async function updateFilteredEvents() {
		if (!selectedTimelineId) {
			filteredEvents = [];
			timelineRows = [];
			return;
		}

		loading = true;

		try {
			// Load events for the selected timeline (with caching)
			let events: Event[];
			if (timelineCache.has(selectedTimelineId)) {
				events = timelineCache.get(selectedTimelineId)!;
			} else {
				const module = await import(`./data/events/${selectedTimelineId}.json`);
				events = module.default as Event[];
				timelineCache.set(selectedTimelineId, events);
			}

			// Sort events by date
			filteredEvents = events.sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
			);

			// Check if this timeline has rich content (conceptDescription or valueAdd)
			const hasRichContent = filteredEvents.some(
				(e) => e.conceptDescription || e.valueAdd
			);

			// Group events by year
			const eventsByYear = new Map<number, Event[]>();
			for (const event of filteredEvents) {
				const year = getYear(event.date);
				if (!eventsByYear.has(year)) {
					eventsByYear.set(year, []);
				}
				eventsByYear.get(year)!.push(event);
			}

			// Build rows: year separator + events for each year
			const rows: TimelineRow[] = [];
			const sortedYears = Array.from(eventsByYear.keys()).sort((a, b) => a - b);

			for (const year of sortedYears) {
				// Add year separator
				rows.push({ type: 'year', year });

				const yearEvents = eventsByYear.get(year)!;
				if (hasRichContent) {
					// For rich content, keep all events in a single group
					rows.push({ type: 'events', events: yearEvents });
				} else {
					// Chunk events for this year into rows of 3
					for (let i = 0; i < yearEvents.length; i += COLUMNS) {
						rows.push({ type: 'events', events: yearEvents.slice(i, i + COLUMNS) });
					}
				}
			}

			timelineRows = rows;
		} finally {
			loading = false;
		}
	}

	function isPast(dateStr: string): boolean {
		const date = new Date(dateStr);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return date < today;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	async function selectRandomTimeline() {
		const randomIndex = Math.floor(Math.random() * timelines.length);
		selectedTimelineId = timelines[randomIndex].id;
		await updateFilteredEvents();
	}

	async function handleTimelineChange() {
		if (selectedTimelineId) {
			await updateFilteredEvents();
			const url = new URL(window.location.href);
			url.searchParams.set('t', selectedTimelineId);
			window.history.replaceState({}, '', url);
		}
	}

	// Read timeline from URL on mount, fallback to random
	onMount(() => {
		const urlTimelineId = page.url.searchParams.get('t');
		if (urlTimelineId && timelines.some((t) => t.id === urlTimelineId)) {
			selectedTimelineId = urlTimelineId;
			updateFilteredEvents();
		} else {
			selectRandomTimeline();
		}
	});


</script>

<svelte:head>
	<title>Timelines</title>
</svelte:head>

<div class="container">
	<header>
		<h1>TIMELINES</h1>
		<p class="subtitle">Explore events across different timelines</p>
	</header>

	<div class="timeline-selector-section">
		<div class="section-header">
			<span class="label">SELECT TIMELINE</span>
		</div>
		<select class="timeline-select" bind:value={selectedTimelineId} onchange={handleTimelineChange}>
			{#each timelines as timeline (timeline.id)}
				<option value={timeline.id}>{timeline.shortTitle}</option>
			{/each}
		</select>
		{#if selectedTimelineId}
			{@const currentTimeline = timelines.find((t) => t.id === selectedTimelineId)}
			{#if currentTimeline}
				<p class="timeline-description">{currentTimeline.description}</p>
			{/if}
		{/if}
	</div>

	<div class="events-container">
		{#if loading}
			<div class="loading-state">
				<div class="loading-spinner"></div>
				<span>Loading events...</span>
			</div>
		{:else}
			{#if filteredEvents.length > 0}
				{#each timelineRows as row, rowIndex (rowIndex)}
					{#if row.type === 'year'}
						<div class="year-separator">
							<span class="year-label">{row.year}</span>
						</div>
					{:else if isRichContent}
						<div class="rich-card-list">
							{#each row.events as event (event.id)}
								<div class="rich-event-card">
									<div class="rich-card-header">
										<span class="rich-card-emoji">{event.emoji}</span>
										<a
											href={event.url}
											target="_blank"
											rel="noopener noreferrer"
											class="rich-card-title">{event.title}</a
										>
									</div>
									<p class="rich-card-description"
										>{event.conceptDescription || event.description}</p
									>
									<p class="rich-card-value-add">✦ {event.valueAdd}</p>
								</div>
							{/each}
						</div>
					{:else}
						<div class="grid-row">
							{#each row.events as event (event.id)}
								<div
									class="event-card"
									class:past={isPast(event.date)}
									onmouseenter={(e) => showTooltip(e, event.description)}
									onmouseleave={hideTooltip}
									role="tooltip"
								>
									<span class="event-emoji">{event.emoji}</span>
									<span class="event-date">{formatShortDate(event.date)}</span>
									{#if event.url}
										<a
											href={event.url}
											target="_blank"
											rel="noopener noreferrer"
											class="event-title-link">{event.title}</a
										>
									{:else}
										<span class="event-title">{event.title}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/each}
			{:else}
				<div class="empty-state">No events in this timeline</div>
			{/if}
		{/if}

		<!-- Global tooltip rendered at container level to avoid overflow clipping -->
		{#if tooltipState.visible}
			<div class="global-tooltip" style:left="{tooltipState.x}px" style:top="{tooltipState.y}px">
				<span class="tooltip-text">{tooltipState.content}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.timeline-selector-section {
		margin-bottom: 1.5rem;
	}

	.timeline-select {
		width: 100%;
		max-width: 500px;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		padding: 0.75rem;
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: var(--futuristic-text);
		outline: none;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23c8d4de' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2rem;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.timeline-select:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.timeline-select option {
		background: var(--futuristic-surface);
		color: var(--futuristic-text);
	}

	.timeline-description {
		margin-top: 0.75rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.9rem;
		color: var(--futuristic-text-dim);
	}

	.events-container {
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		padding: 0.5rem;
	}

	.year-separator {
		display: flex;
		align-items: center;
		padding: 0.5rem 0;
		margin: 0.25rem 0;
	}

	.year-separator::before,
	.year-separator::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.3), transparent);
	}

	.year-label {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--futuristic-magenta);
		letter-spacing: 0.15em;
		padding: 0 1rem;
		text-shadow: 0 0 8px rgba(255, 0, 255, 0.4);
	}

	.grid-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		padding: 0.15rem 0;
	}

	.grid-row:not(:last-child) {
		border-bottom: 1px solid rgba(0, 245, 255, 0.1);
	}

	.event-card {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.25rem;
		position: relative;
		cursor: default;
		transition: background-color 0.2s;
	}

	.event-card:hover {
		background: rgba(0, 245, 255, 0.05);
	}

	.event-card.past {
		opacity: 0.5;
	}

	.event-card.past .event-title {
		text-decoration: line-through;
		text-decoration-color: rgba(200, 212, 222, 0.3);
	}

	.event-card .event-emoji {
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.event-card .event-date {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.55rem;
		font-weight: 500;
		color: var(--futuristic-cyan);
		letter-spacing: 0.03em;
		white-space: nowrap;
		min-width: 60px;
	}

	.event-card .event-title {
		font-family: 'Inter', sans-serif;
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--futuristic-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.event-card .event-title-link {
		font-family: 'Inter', sans-serif;
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--futuristic-cyan);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-decoration: none;
		transition: color 0.2s;
	}

	.event-card .event-title-link:hover {
		color: var(--futuristic-magenta);
		text-decoration: underline;
	}

	/* Global tooltip - positioned fixed to escape overflow clipping */
	.global-tooltip {
		position: fixed;
		transform: translate(-50%, -100%);
		padding: 0.5rem 0.75rem;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-cyan);
		border-radius: 6px;
		box-shadow:
			0 0 20px rgba(0, 245, 255, 0.3),
			0 4px 12px rgba(0, 0, 0, 0.5);
		z-index: 9999;
		max-width: 350px;
		pointer-events: none;
		/* Fully opaque background */
		opacity: 1 !important;
	}

	.global-tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: var(--futuristic-cyan);
	}

	.tooltip-text {
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
		color: var(--futuristic-text);
		line-height: 1.4;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: var(--futuristic-text-dim);
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		height: 200px;
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: var(--futuristic-text-dim);
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--futuristic-border);
		border-top-color: var(--futuristic-cyan);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Rich content styles */
	.rich-card-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.rich-card-list:not(:last-child) {
		border-bottom: 1px solid rgba(0, 245, 255, 0.1);
	}

	.rich-event-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.6rem 0.75rem;
		background: rgba(0, 245, 255, 0.03);
		border: 1px solid rgba(0, 245, 255, 0.1);
		border-radius: 8px;
		transition:
			background 0.2s,
			border-color 0.2s;
	}

	.rich-event-card:hover {
		background: rgba(0, 245, 255, 0.06);
		border-color: rgba(0, 245, 255, 0.2);
	}

	.rich-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rich-card-emoji {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.rich-card-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		letter-spacing: 0.04em;
		text-decoration: none;
		transition: color 0.2s;
	}

	.rich-card-title:hover {
		color: var(--futuristic-magenta);
		text-decoration: underline;
	}

	.rich-card-description {
		font-family: 'Inter', sans-serif;
		font-size: 0.8rem;
		color: var(--futuristic-text);
		line-height: 1.5;
		margin: 0;
	}

	.rich-card-value-add {
		font-family: 'Inter', sans-serif;
		font-size: 0.8rem;
		color: var(--futuristic-magenta);
		line-height: 1.5;
		margin: 0;
		padding-left: 1.5rem;
		opacity: 0.9;
	}

	@media (max-width: 600px) {
		.grid-row {
			grid-template-columns: 1fr;
		}
	}
</style>
