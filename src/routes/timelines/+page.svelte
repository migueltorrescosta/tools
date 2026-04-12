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
	}

	interface EventTimeline {
		eventId: number;
		timelineId: string;
	}

	const timelines = timelinesData as Timeline[];
	const allEvents = eventsData as Event[];
	const eventTimeline = eventTimelineData as EventTimeline[];

	let selectedTimelineId = $state<string>('');
	let containerRef: HTMLDivElement | null = $state(null);
	let filteredEvents = $state<Event[]>([]);

	function updateFilteredEvents() {
		if (!selectedTimelineId) {
			filteredEvents = [];
			return;
		}

		const eventIds = eventTimeline
			.filter((et) => et.timelineId === selectedTimelineId)
			.map((et) => et.eventId);

		filteredEvents = allEvents
			.filter((e) => eventIds.includes(e.id))
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
			{@const today = new Date()}
			{@const todayMs = today.setHours(0, 0, 0, 0)}
			{#each filteredEvents as event (event.id)}
				{@const eventDate = new Date(event.date)}
				{@const eventMs = eventDate.setHours(0, 0, 0, 0)}
				{#if eventMs >= todayMs}
					{#if filteredEvents.indexOf(event) > 0 || filteredEvents.filter((e) => new Date(e.date).setHours(0, 0, 0, 0) < todayMs).length === 0}
						{@const pastCount = filteredEvents.filter(
							(e) => new Date(e.date).setHours(0, 0, 0, 0) < todayMs
						).length}
						{@const futureIndex = filteredEvents.findIndex(
							(e) => new Date(e.date).setHours(0, 0, 0, 0) >= todayMs
						)}
						{#if filteredEvents.indexOf(event) === futureIndex}
							<div class="today-divider-row">
								<div class="today-line"></div>
								<span class="today-label">— TODAY —</span>
								<div class="today-line"></div>
							</div>
						{/if}
					{/if}
				{/if}
				<div class="event-row" class:past={isPast(event.date)}>
					<span class="event-emoji">{event.emoji}</span>
					<span class="event-date">{formatDate(event.date)}</span>
					<span class="event-title">{event.title}</span>
					<div class="tooltip">
						<span class="tooltip-text">{event.description}</span>
					</div>
				</div>
			{/each}
		{:else}
			<div class="empty-state">No events in this timeline</div>
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
		font-family: 'Rajdhani', sans-serif;
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
		font-family: 'Rajdhani', sans-serif;
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
		padding: 0.25rem;
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
		font-family: 'Rajdhani', sans-serif;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--futuristic-text);
		flex: 1;
	}

	.tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.5rem 0.75rem;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-cyan);
		border-radius: 6px;
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.2s,
			visibility 0.2s;
		z-index: 100;
		max-width: 350px;
		margin-bottom: 6px;
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: var(--futuristic-cyan);
	}

	.event-row:hover .tooltip {
		opacity: 1;
		visibility: visible;
	}

	.tooltip-text {
		font-family: 'Rajdhani', sans-serif;
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
		font-family: 'Rajdhani', sans-serif;
		font-size: 1rem;
		color: var(--futuristic-text-dim);
	}

	@media (max-width: 600px) {
		.events-container {
			max-height: calc(100vh - 350px);
		}

		.event-row {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.event-title {
			width: 100%;
			order: 3;
		}

		.tooltip {
			left: 0;
			transform: none;
			width: calc(100% - 2rem);
		}

		.tooltip::after {
			left: 1rem;
			transform: none;
		}
	}
</style>
