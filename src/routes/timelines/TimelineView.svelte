<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/ui';
	import { formatShortDate, isPast, type TimelineEvent, type YearGroup } from './timelines';

	interface Props {
		groups: YearGroup[];
		rich: boolean;
		/** Clock for past-event styling; injectable so tests do not depend on today. */
		now?: Date;
	}

	let { groups, rich, now = new Date() }: Props = $props();

	const TOOLTIP_ID = 'timeline-event-tooltip';

	// The first upcoming event, when past events precede it: a "Today" row goes before it and the
	// events above it are muted. A timeline wholly in the past or future has no such split.
	const events = $derived(groups.flatMap((group) => group.events));
	const upcomingIndex = $derived(events.findIndex((event) => !isPast(event.date, now)));
	const firstUpcomingId = $derived(upcomingIndex > 0 ? events[upcomingIndex].id : undefined);

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

	// The full description popup for plain rows, whose inline description is cut to one line.
	// It is anchored to the row that was hovered, focused or tapped, so touch and keyboard users
	// reach it too.
	let tooltip = $state<{ eventId: number; x: number; y: number; content: string } | null>(null);

	function showTooltip(row: HTMLElement, event: TimelineEvent) {
		const rect = row.getBoundingClientRect();
		tooltip = {
			eventId: event.id,
			x: rect.left + rect.width / 2,
			y: rect.top - 8,
			content: event.description
		};
	}

	function hideTooltip() {
		tooltip = null;
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') hideTooltip();
	}

	function describedBy(event: TimelineEvent): string | undefined {
		return tooltip?.eventId === event.id ? TOOLTIP_ID : undefined;
	}
</script>

<!-- The popup is position: fixed where its row was when it opened; scrolling or resizing
     would detach it from the row, so it closes instead. -->
<svelte:window onscroll={hideTooltip} onresize={hideTooltip} onkeydown={onWindowKeydown} />

<ol class="tl-years" aria-label="Events by year">
	{#each groups as group (group.year)}
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
						{#if rich}
							<li class="tl-event" class:past={past(event)} data-testid="timeline-event">
								<p class="tl-line">
									<span class="tl-emoji" aria-hidden="true">{event.emoji}</span>
									{#if event.url}
										<a href={event.url} target="_blank" rel="noopener noreferrer" class="tl-title"
											>{event.title}</a
										>
									{:else}
										<span class="tl-title">{event.title}</span>
									{/if}
									<span class="tl-desc">— {event.conceptDescription || event.description}</span>
								</p>
								{#if event.valueAdd}
									<p class="tl-impact">✦ {event.valueAdd}</p>
								{/if}
							</li>
						{:else}
							<!-- The row only tracks hover and focus for the popup; the button and link inside
						     are the interactive parts. -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<li
								class="tl-event"
								class:past={past(event)}
								data-testid="timeline-event"
								onmouseenter={(e) => showTooltip(e.currentTarget, event)}
								onmouseleave={hideTooltip}
								onfocusin={(e) => showTooltip(e.currentTarget, event)}
								onfocusout={hideTooltip}
							>
								<button
									type="button"
									class="tl-info"
									aria-describedby={describedBy(event)}
									onclick={(e) =>
										showTooltip(e.currentTarget.parentElement ?? e.currentTarget, event)}
								>
									<span class="tl-emoji" aria-hidden="true">{event.emoji}</span>
									<time class="tl-date" datetime={event.date}>{formatShortDate(event.date)}</time>
									{#if !event.url}
										<span class="tl-title">{event.title}</span>
									{/if}
								</button>
								{#if event.url}
									<a
										href={event.url}
										target="_blank"
										rel="noopener noreferrer"
										class="tl-title"
										aria-describedby={describedBy(event)}>{event.title}</a
									>
								{/if}
								<span class="tl-desc">{event.description}</span>
							</li>
						{/if}
					{/each}
				</ol>
			{/if}
		</li>
	{/each}
</ol>

<!-- Rendered once at view level, position: fixed, to escape the container's overflow clipping -->
{#if tooltip}
	<div
		id={TOOLTIP_ID}
		role="tooltip"
		class="tl-tooltip"
		style:left="{tooltip.x}px"
		style:top="{tooltip.y}px"
	>
		{tooltip.content}
	</div>
{/if}

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

	/* Plain rows flow into as many columns as fit; rich rows take the full width. */
	.tl-list:not(.rich) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
		column-gap: var(--sp-4);
	}

	.tl-list.tl-folded {
		display: block;
	}

	.tl-event {
		min-width: 0;
		font-size: var(--text-sm);
	}

	.tl-list:not(.rich) .tl-event {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: 24px;
		padding: 0 var(--sp-1);
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.tl-list:not(.rich) .tl-event:hover,
	.tl-list:not(.rich) .tl-event:focus-within {
		background: var(--surface-2);
	}

	.tl-list.rich .tl-event {
		padding: var(--sp-1) 0;
	}

	.tl-list.rich .tl-event + .tl-event {
		border-top: 1px solid var(--border);
	}

	/* Reset button chrome: the button only makes the row focusable and tappable. */
	.tl-info {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		flex: 0 1 auto;
		min-width: 0;
		min-height: 24px;
		padding: 0;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
	}

	/* A link title sits beside the button, which then holds only the icon and date. */
	.tl-info:has(+ a) {
		flex-shrink: 0;
	}

	.tl-date {
		flex-shrink: 0;
		min-width: 3.5rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.tl-title {
		font-weight: 500;
		color: var(--text);
	}

	a.tl-title {
		color: var(--accent);
	}

	.tl-list:not(.rich) .tl-title {
		flex: 0 1 auto;
		min-width: 0;
		line-height: 24px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tl-desc,
	.tl-impact {
		color: var(--text-muted);
	}

	.tl-list:not(.rich) .tl-desc {
		flex: 1 1 0;
		min-width: 5em;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tl-line,
	.tl-impact {
		margin: 0;
	}

	.tl-emoji {
		flex-shrink: 0;
	}

	.tl-impact {
		padding-left: 1.6em;
	}

	/* Past events are muted; the Today row above the first upcoming one marks the split
	   without relying on colour. */
	.tl-event.past .tl-title,
	.tl-event.past .tl-date {
		color: var(--text-muted);
	}

	.tl-today {
		grid-column: 1 / -1;
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

	.tl-tooltip {
		position: fixed;
		transform: translate(-50%, -100%);
		z-index: 60;
		max-width: min(22rem, 90vw);
		padding: var(--sp-1) var(--sp-2);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		font-size: var(--text-sm);
		color: var(--text);
		pointer-events: none;
	}

	/* Narrow rows have no room for the description; the popup shows it instead. */
	@media (max-width: 30rem) {
		.tl-list:not(.rich) .tl-desc {
			display: none;
		}

		.tl-year {
			grid-template-columns: 2.5rem minmax(0, 1fr);
			gap: var(--sp-1);
		}

		.tl-impact {
			padding-left: 0;
		}
	}
</style>
