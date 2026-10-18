<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import timelinesData from './data/timelines.json';
	import { Alert, Button, PageHeader, Panel, Select } from '$lib/ui';
	import TimelineView from './TimelineView.svelte';
	import {
		createTimelineLoader,
		groupByYear,
		hasRichContent,
		pickTimelineId,
		sortEventsByDate,
		type Timeline,
		type TimelineEvent,
		type YearGroup
	} from './timelines';

	const timelines = timelinesData as Timeline[];
	const options = timelines.map((t) => ({ value: t.id, label: t.shortTitle }));

	let selectedTimelineId = $state<string>('');
	let filteredEvents = $state<TimelineEvent[]>([]);
	let yearGroups = $state<YearGroup[]>([]);
	let loading = $state(false);
	let loadError = $state(false);
	const isRichContent = $derived(hasRichContent(filteredEvents));
	const description = $derived(timelines.find((t) => t.id === selectedTimelineId)?.description);

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
			yearGroups = [];
			loadError = true;
			loading = false;
			return;
		}
		// A newer selection superseded this load; it owns the state, the spinner and the URL.
		if (events === null) return;

		filteredEvents = sortEventsByDate(events);
		yearGroups = groupByYear(filteredEvents);
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

<div class="container">
	<PageHeader path="/timelines" />

	<div class="tl-picker">
		<Select
			label="Timeline"
			{options}
			bind:value={selectedTimelineId}
			onchange={handleTimelineChange}
			hint={description}
		/>
	</div>

	<Panel>
		{#if loading}
			<p class="tl-status" role="status">
				<span class="tl-spinner" aria-hidden="true"></span>
				Loading events…
			</p>
		{:else if loadError}
			<Alert tone="danger">
				<div class="tl-error">
					Could not load this timeline.
					<Button size="sm" onclick={handleTimelineChange}>Retry</Button>
				</div>
			</Alert>
		{:else if filteredEvents.length > 0}
			<TimelineView groups={yearGroups} rich={isRichContent} />
		{:else}
			<p class="tl-status">No events in this timeline</p>
		{/if}
	</Panel>
</div>

<style>
	/* A compact select, with room for the description on one line beside it. */
	.tl-picker {
		margin-bottom: var(--sp-3);
	}

	.tl-picker :global(select) {
		max-width: 24rem;
	}

	.tl-status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		min-height: 8rem;
		margin: 0;
		color: var(--text-muted);
	}

	.tl-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2);
	}

	/* Static under reduced motion: base.css cuts animations to one instant iteration. */
	.tl-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: tl-spin 0.8s linear infinite;
	}

	@keyframes tl-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
