<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import timelinesData from './data/timelines.json';
	import { Alert, Button, PageHeader, Panel } from '#lib/ui/index.js';
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
	 * The single entry point for every selection (URL, random fallback, topic chips): loads the
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

		// Written after the await: SvelteKit's shallow routing throws before the router has
		// started, which is still the case while onMount runs.
		if (page.url.searchParams.get('t') !== id) {
			const url = new URL(page.url.href);
			url.searchParams.set('t', id);
			goto(url, { shallow: true, replace: true, state: page.state });
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

	<div class="tl-layout">
		<!-- The topic rail: stays in place beside the events on wide screens, stacks on top on phones -->
		<div class="tl-rail">
			<Panel>
				<!-- One of many: native radios, so arrow keys move the choice; styled as chips -->
				<div
					class="tl-topics"
					role="radiogroup"
					aria-label="Timeline"
					aria-describedby="tl-topic-desc"
				>
					{#each timelines as timeline (timeline.id)}
						<label class="tl-chip" class:checked={selectedTimelineId === timeline.id}>
							<input
								type="radio"
								name="tl-topic"
								value={timeline.id}
								bind:group={selectedTimelineId}
								onchange={handleTimelineChange}
							/>
							<span aria-hidden="true">{timeline.emoji}</span>
							{timeline.label}
						</label>
					{/each}
				</div>
				<p class="tl-topic-desc" id="tl-topic-desc">{description}</p>

				<details class="how">
					<summary>How it works</summary>
					<p>
						Each topic is a list of dated events, sorted by date and grouped by year. A Today line
						marks where the past ends; the events before it fold into one button, so the list opens
						on what comes next. Linked titles (↗) open their source in a new tab.
					</p>
					<p>
						Public holidays are the nationwide ones of each EU member state, computed per year from
						the rules in law. Regional holidays are left out. A holiday marked “⁠(de facto)⁠” is a
						customary day off, kept by custom or collective agreements, not a statutory public
						holiday. The longest lists open only the current year; the other years open on request.
					</p>
				</details>
			</Panel>
		</div>

		<Panel>
			{#if loading}
				<p class="tl-status" role="status">
					<span class="tl-spinner" aria-hidden="true"></span>
					Loading events…
				</p>
			{:else if loadError}
				<!-- Text with its Retry, no box of its own -->
				<div class="tl-status">
					<Alert tone="danger">Could not load this timeline.</Alert>
					<Button size="sm" onclick={handleTimelineChange}>Retry</Button>
				</div>
			{:else if filteredEvents.length > 0}
				<!-- Keyed, so a new timeline opens folded again -->
				{#key yearGroups}
					<TimelineView groups={yearGroups} rich={isRichContent} />
				{/key}
			{:else}
				<p class="tl-status">No events in this timeline</p>
			{/if}
		</Panel>
	</div>
</div>

<style>
	/* Two boxes: the topic rail (15rem) beside the events; stacked on narrow screens. */
	.tl-layout {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		align-items: start;
		gap: var(--sp-4);
	}

	/* The rail stays in place while the events scroll; an open How it works scrolls inside it. */
	.tl-rail {
		position: sticky;
		top: calc(var(--topbar-h) + var(--sp-2));
		min-width: 0;
	}

	.tl-rail :global(.ui-panel) {
		max-height: calc(100dvh - var(--topbar-h) - var(--sp-4));
		overflow-y: auto;
	}

	.tl-topics {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	@media (max-width: 47.99rem) {
		.tl-layout {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--sp-3);
		}

		.tl-rail {
			position: static;
		}

		.tl-rail :global(.ui-panel) {
			max-height: none;
			overflow: visible;
		}

		.tl-topics {
			flex-direction: row;
			flex-wrap: wrap;
		}
	}

	.tl-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
		padding: 0 var(--sp-3);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--surface);
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}

	.tl-chip:hover {
		background: var(--surface-2);
	}

	/* The thicker outline and bold label mark the choice without relying on colour. */
	.tl-chip.checked {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
		color: var(--accent);
		font-weight: 700;
	}

	.tl-chip input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.tl-chip:has(input:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.tl-topic-desc {
		min-height: 1.5em;
		margin: var(--sp-3) 0 0;
		padding-bottom: var(--sp-3);
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.tl-rail .how {
		margin-top: var(--sp-2);
	}

	.tl-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		min-height: 8rem;
		margin: 0;
		color: var(--text-muted);
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
