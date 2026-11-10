<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '#lib/ui/index.js';
	import { formatShortDate, isPast, type TimelineEvent, type YearGroup } from './timelines';

	interface Props {
		groups: YearGroup[];
		rich: boolean;
		/** Clock for past-event styling; injectable so tests do not depend on today. */
		now?: Date;
	}

	let { groups, rich, now = new Date() }: Props = $props();

	// The first upcoming event, when past events precede it: a "Today" row goes before it and the
	// events above it are muted. A timeline wholly in the past or future has no such split.
	const events = $derived(groups.flatMap((group) => group.events));
	const upcomingIndex = $derived(events.findIndex((event) => !isPast(event.date, now)));
	const firstUpcomingId = $derived(upcomingIndex > 0 ? events[upcomingIndex].id : undefined);

	// Past events fold into one button, so the list opens on Today and the next event.
	let showEarlier = $state(false);
	const earlier = $derived(events.filter((event) => past(event)));
	const earlierFolded = $derived(earlier.length > 0 && !showEarlier);
	const earlierYears = $derived.by(() => {
		if (earlier.length === 0) return '';
		const first = earlier[0].date.slice(0, 4);
		const last = earlier[earlier.length - 1].date.slice(0, 4);
		return first === last ? first : `${first}–${last}`;
	});
	const shownGroups = $derived(
		earlierFolded
			? groups
					.map((g) => ({ year: g.year, events: g.events.filter((e) => !past(e)) }))
					.filter((g) => g.events.length > 0)
			: groups
	);

	let list = $state<HTMLElement>();
	async function revealEarlier() {
		showEarlier = true;
		await tick();
		// The button is gone; focus moves to the first revealed event instead of the page top.
		const first = list?.querySelector<HTMLElement>('[data-testid="timeline-event"]');
		if (first) {
			first.tabIndex = -1;
			first.focus();
		}
	}

	// Long timelines (public holidays: over 1,300 rows) open only the year of the next event, or
	// the last year when all are past; the other years open on request.
	const LONG_TIMELINE = 200;
	const shownYears = $derived.by(() => {
		if (events.length <= LONG_TIMELINE) return null;
		const current = upcomingIndex >= 0 ? events[upcomingIndex] : events[events.length - 1];
		return new SvelteSet([groups.find((g) => g.events.includes(current))!.year]);
	});

	function past(event: TimelineEvent): boolean {
		return firstUpcomingId !== undefined && isPast(event.date, now);
	}
</script>

<ol class="tl-years" aria-label="Events by year" bind:this={list}>
	{#if earlierFolded}
		<li class="tl-year">
			<span></span>
			<div class="tl-list tl-folded">
				<Button size="sm" onclick={revealEarlier}>
					Show {earlier.length} earlier {earlier.length === 1 ? 'event' : 'events'} ({earlierYears})
				</Button>
			</div>
		</li>
	{/if}
	{#each shownGroups as group (group.year)}
		<li class="tl-year">
			<h2 class="tl-year-label"><time datetime={String(group.year)}>{group.year}</time></h2>
			{#if shownYears && !shownYears.has(group.year)}
				<div class="tl-list tl-folded">
					<Button size="sm" onclick={() => shownYears.add(group.year)}>
						Show {group.events.length} events
					</Button>
				</div>
			{:else}
				<ol class="tl-list" class:rich>
					{#each group.events as event (event.id)}
						{#if event.id === firstUpcomingId}
							<li class="tl-today" data-testid="timeline-today">Today</li>
						{/if}
						<li class="tl-event" class:past={past(event)} data-testid="timeline-event">
							<span class="tl-emoji" aria-hidden="true">{event.emoji}</span>
							{#if !rich}
								<time class="tl-date" datetime={event.date}>{formatShortDate(event.date)}</time>
							{/if}
							<!-- One inline flow: the description wraps under the title, not beside it. -->
							<p class="tl-line">
								{#if event.url}
									<a href={event.url} target="_blank" rel="noopener noreferrer" class="tl-title"
										>{event.title}<span class="tl-out" aria-hidden="true">↗</span></a
									>
								{:else}
									<span class="tl-title">{event.title}</span>
								{/if}
								{#if rich}
									<span class="tl-desc">— {event.conceptDescription || event.description}</span>
								{:else if event.description}
									<span class="tl-desc">{event.description}</span>
								{/if}
							</p>
							{#if rich && event.valueAdd}
								<p class="tl-impact">✦ {event.valueAdd}</p>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.tl-years,
	.tl-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* The year sits in a narrow gutter beside its events, once per year. */
	.tl-year {
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr);
		gap: var(--sp-2);
		padding: var(--sp-1) 0;
	}

	.tl-year + .tl-year {
		border-top: 1px solid var(--border);
	}

	.tl-year-label {
		position: sticky;
		top: calc(var(--topbar-h) + var(--sp-1));
		align-self: start;
		line-height: 24px;
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.tl-list {
		border-left: 1px solid var(--border-strong);
		padding-left: var(--sp-2);
		min-width: 0;
	}

	/* One column in date order: emoji, date, then the title and description as one wrapping line. */
	.tl-event {
		display: grid;
		grid-template-columns: 1.5em 3.75rem minmax(0, 1fr);
		column-gap: var(--sp-2);
		align-items: baseline;
		padding: var(--sp-0) var(--sp-1);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.tl-event:focus {
		outline: none;
	}

	.tl-event:focus-visible {
		outline: 2px solid var(--focus-ring);
	}

	.tl-list.rich .tl-event {
		grid-template-columns: 1.5em minmax(0, 1fr);
		padding: var(--sp-1);
	}

	.tl-list.rich .tl-event + .tl-event {
		border-top: 1px solid var(--border);
	}

	.tl-date {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.tl-line,
	.tl-impact {
		margin: 0;
	}

	/* Titles are plain text; the ↗ says it links out and the underline appears on hover. */
	.tl-title {
		margin-right: var(--sp-1);
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
	}

	a.tl-title:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.tl-out {
		margin-left: var(--sp-0);
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.tl-desc,
	.tl-impact {
		color: var(--text-muted);
	}

	.tl-impact {
		grid-column: 2;
	}

	/* Past events are muted; the Today row above the first upcoming one marks the split
	   without relying on colour. */
	.tl-event.past .tl-title,
	.tl-event.past .tl-date {
		color: var(--text-muted);
	}

	.tl-today {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: 24px;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--accent);
	}

	.tl-today::after {
		content: '';
		flex: 1;
		border-top: 2px solid var(--accent);
	}

	@media (max-width: 30rem) {
		.tl-year {
			grid-template-columns: 2.5rem minmax(0, 1fr);
			gap: var(--sp-1);
		}

		.tl-event {
			grid-template-columns: 1.5em 3.25rem minmax(0, 1fr);
			column-gap: var(--sp-1);
		}
	}
</style>
