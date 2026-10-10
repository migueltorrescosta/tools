<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import timelinesData from './data/timelines.json';
	import TimelineView from './TimelineView.svelte';
	import {
		buildTimelineRows,
		createTimelineLoader,
		hasRichContent,
		pickTimelineId,
		sortEventsByDate,
		type Timeline,
		type TimelineEvent,
		type TimelineRow
	} from './timelines';

	const timelines = timelinesData as Timeline[];

	let selectedTimelineId = $state<string>('');
	let filteredEvents = $state<TimelineEvent[]>([]);
	let timelineRows = $state<TimelineRow[]>([]);
	let loading = $state(false);
	let loadError = $state(false);
	const isRichContent = $derived(hasRichContent(filteredEvents));

	const timelineLoader = createTimelineLoader(
		async (id) => (await import(`./data/events/${id}.json`)).default as TimelineEvent[]
	);

	/**
	 * The single entry point for every selection (URL, random fallback, dropdown): loads the
	 * timeline and writes it to ?t so the address bar always names what is on screen.
	 */
	async function selectTimeline(id: string) {
		selectedTimelineId = id;
		loading = true;
		loadError = false;

		let events: TimelineEvent[] | null;
		try {
			events = await timelineLoader.load(id);
		} catch (error) {
			// A failed chunk import (deploy skew, offline) must not leave the previous
			// timeline's events under the new title.
			console.error(`Failed to load timeline "${id}"`, error);
			filteredEvents = [];
			timelineRows = [];
			loadError = true;
			loading = false;
			return;
		}
		// A newer selection superseded this load; it owns the state, the spinner and the URL.
		if (events === null) return;

		filteredEvents = sortEventsByDate(events);
		timelineRows = buildTimelineRows(filteredEvents, hasRichContent(filteredEvents));
		loading = false;

		// Written after the await: SvelteKit's replaceState throws before the router has
		// started, which is still the case while onMount runs.
		if (page.url.searchParams.get('t') !== id) {
			const url = new URL(page.url);
			url.searchParams.set('t', id);
			replaceState(url, page.state);
		}
	}

	function handleTimelineChange() {
		if (selectedTimelineId) selectTimeline(selectedTimelineId);
	}

	// Read the timeline from the URL on mount; a missing or unknown ?t falls back to a random one.
	onMount(() => {
		selectTimeline(pickTimelineId(timelines, page.url.searchParams.get('t'), Math.random));
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
		{:else if loadError}
			<div class="error-state" role="alert">
				<span>Could not load this timeline.</span>
				<button type="button" class="retry-button" onclick={handleTimelineChange}>Retry</button>
			</div>
		{:else if filteredEvents.length > 0}
			<TimelineView rows={timelineRows} rich={isRichContent} />
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

	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		height: 200px;
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: var(--futuristic-magenta);
	}

	.retry-button {
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-size: 0.9rem;
		color: var(--futuristic-text);
		cursor: pointer;
	}

	.retry-button:hover,
	.retry-button:focus-visible {
		border-color: var(--futuristic-cyan);
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
</style>
