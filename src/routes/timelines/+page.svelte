<script lang="ts">
	import { onMount } from 'svelte';
	import timelinesData from './data/timelines.json';
	import eventsData from './data/events.json';
	import eventTimelineData from './data/event_timeline.json';

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
	}

	interface EventTimeline {
		eventId: number;
		timelineId: string;
	}

	type TimelineRow = { type: 'year'; year: number } | { type: 'events'; events: Event[] };

	const timelines = timelinesData as Timeline[];
	const allEvents = eventsData as Event[];
	const eventTimeline = eventTimelineData as EventTimeline[];

	let selectedTimelineId = $state<string>('');
	let containerRef: HTMLDivElement | null = $state(null);
	let filteredEvents = $state<Event[]>([]);
	let timelineRows = $state<TimelineRow[]>([]);
	let tooltipState = $state<{ visible: boolean; x: number; y: number; content: string }>({
		visible: false,
		x: 0,
		y: 0,
		content: ''
	});

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

	function updateFilteredEvents() {
		if (!selectedTimelineId) {
			filteredEvents = [];
			timelineRows = [];
			return;
		}

		const eventIds = eventTimeline
			.filter((et) => et.timelineId === selectedTimelineId)
			.map((et) => et.eventId);

		filteredEvents = allEvents
			.filter((e) => eventIds.includes(e.id))
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		// Group events by year
		const eventsByYear = new Map<number, Event[]>();
		for (const event of filteredEvents) {
			const year = getYear(event.date);
			if (!eventsByYear.has(year)) {
				eventsByYear.set(year, []);
			}
			eventsByYear.get(year)!.push(event);
		}

		// Build rows: year separator + chunked events for each year
		const rows: TimelineRow[] = [];
		const sortedYears = Array.from(eventsByYear.keys()).sort((a, b) => a - b);

		for (const year of sortedYears) {
			// Add year separator
			rows.push({ type: 'year', year });

			// Chunk events for this year into rows of 3
			const yearEvents = eventsByYear.get(year)!;
			for (let i = 0; i < yearEvents.length; i += COLUMNS) {
				rows.push({ type: 'events', events: yearEvents.slice(i, i + COLUMNS) });
			}
		}

		timelineRows = rows;
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

	function scrollToToday() {
		if (!containerRef || filteredEvents.length === 0) return;

		const dividerElement = containerRef.querySelector('.today-divider-row');
		if (!dividerElement) return;

		const dividerRect = dividerElement.getBoundingClientRect();
		const containerRect = containerRef.getBoundingClientRect();
		const scrollTop = dividerRect.top - containerRect.top + containerRef.scrollTop;

		containerRef.scrollTo({
			top: Math.max(0, scrollTop - 50),
			behavior: 'smooth'
		});
	}

	function selectRandomTimeline() {
		const randomIndex = Math.floor(Math.random() * timelines.length);
		selectedTimelineId = timelines[randomIndex].id;
		updateFilteredEvents();
	}

	function handleTimelineChange() {
		updateFilteredEvents();
		setTimeout(scrollToToday, 100);
	}

	onMount(() => {
		selectRandomTimeline();
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

	<div class="events-container" bind:this={containerRef}>
		{#if filteredEvents.length > 0}
			<div class="events-grid">
				{#each timelineRows as row, rowIndex (rowIndex)}
					{#if row.type === 'year'}
						<div class="year-separator">
							<span class="year-label">{row.year}</span>
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
			</div>
		{:else}
			<div class="empty-state">No events in this timeline</div>
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
		max-height: calc(100vh - 280px);
		min-height: 300px;
		overflow-y: auto;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		padding: 0.5rem;
	}

	.events-grid {
		display: flex;
		flex-direction: column;
		gap: 0;
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

	.event-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		border-radius: 4px;
		position: relative;
		cursor: default;
		transition: background-color 0.2s;
	}

	.event-row:hover {
		background: rgba(0, 245, 255, 0.08);
	}

	.event-row.past {
		opacity: 0.6;
	}

	.event-row.past .event-title {
		text-decoration: line-through;
		text-decoration-color: rgba(200, 212, 222, 0.4);
	}

	.event-emoji {
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.event-date {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.6rem;
		font-weight: 500;
		color: var(--futuristic-cyan);
		letter-spacing: 0.05em;
		white-space: nowrap;
		min-width: 70px;
	}

	.event-title {
		font-family: 'Inter', sans-serif;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--futuristic-text);
		flex: 1;
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

	.today-divider-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		margin: 0.25rem 0;
	}

	.today-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--futuristic-magenta),
			var(--futuristic-cyan),
			var(--futuristic-magenta),
			transparent
		);
	}

	.today-label {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--futuristic-magenta);
		letter-spacing: 0.2em;
		white-space: nowrap;
		text-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
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

	@media (max-width: 600px) {
		.events-container {
			max-height: calc(100vh - 350px);
		}

		.grid-row {
			grid-template-columns: 1fr;
		}
	}
</style>
