<script lang="ts">
	import { formatShortDate, isPast, type TimelineEvent, type TimelineRow } from './timelines';

	interface Props {
		rows: TimelineRow[];
		rich: boolean;
		/** Clock for past-event styling; injectable so tests do not depend on today. */
		now?: Date;
	}

	let { rows, rich, now = new Date() }: Props = $props();

	const TOOLTIP_ID = 'timeline-event-tooltip';

	// The description popup for the grid layout. It is anchored to the card that was hovered,
	// focused or tapped, so touch and keyboard users reach it too.
	let tooltip = $state<{ eventId: number; x: number; y: number; content: string } | null>(null);

	function showTooltip(card: HTMLElement, event: TimelineEvent) {
		const rect = card.getBoundingClientRect();
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

<!-- The popup is position: fixed where its card was when it opened; scrolling or resizing
     would detach it from the card, so it closes instead. -->
<svelte:window onscroll={hideTooltip} onresize={hideTooltip} onkeydown={onWindowKeydown} />

{#each rows as row, rowIndex (rowIndex)}
	{#if row.type === 'year'}
		<div class="year-separator">
			<span class="year-label">{row.year}</span>
		</div>
	{:else if rich}
		<div class="rich-card-list">
			{#each row.events as event (event.id)}
				<div class="rich-event-card" class:past={isPast(event.date, now)}>
					<div class="rich-card-header">
						<span class="rich-card-emoji">{event.emoji}</span>
						{#if event.url}
							<a
								href={event.url}
								target="_blank"
								rel="noopener noreferrer"
								class="rich-card-title rich-card-title-link">{event.title}</a
							>
						{:else}
							<span class="rich-card-title">{event.title}</span>
						{/if}
					</div>
					<p class="rich-card-description">{event.conceptDescription || event.description}</p>
					{#if event.valueAdd}
						<p class="rich-card-value-add">✦ {event.valueAdd}</p>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="grid-row">
			{#each row.events as event (event.id)}
				<div
					class="event-card"
					class:past={isPast(event.date, now)}
					role="group"
					onmouseenter={(e) => showTooltip(e.currentTarget, event)}
					onmouseleave={hideTooltip}
					onfocusin={(e) => showTooltip(e.currentTarget, event)}
					onfocusout={hideTooltip}
				>
					<button
						type="button"
						class="event-info"
						aria-describedby={describedBy(event)}
						onclick={(e) => showTooltip(e.currentTarget.parentElement ?? e.currentTarget, event)}
					>
						<span class="event-emoji">{event.emoji}</span>
						<span class="event-date">{formatShortDate(event.date)}</span>
						{#if !event.url}
							<span class="event-title">{event.title}</span>
						{/if}
					</button>
					{#if event.url}
						<a
							href={event.url}
							target="_blank"
							rel="noopener noreferrer"
							class="event-title event-title-link"
							aria-describedby={describedBy(event)}>{event.title}</a
						>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/each}

<!-- Rendered once at view level, position: fixed, to escape the container's overflow clipping -->
{#if tooltip}
	<div
		id={TOOLTIP_ID}
		role="tooltip"
		class="global-tooltip"
		style:left="{tooltip.x}px"
		style:top="{tooltip.y}px"
	>
		<span class="tooltip-text">{tooltip.content}</span>
	</div>
{/if}

<style>
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
		min-width: 0;
		cursor: default;
		transition: background-color 0.2s;
	}

	.event-card:hover,
	.event-card:focus-within {
		background: rgba(0, 245, 255, 0.05);
	}

	.event-card.past {
		opacity: 0.5;
	}

	.event-card.past .event-title {
		text-decoration: line-through;
		text-decoration-color: rgba(200, 212, 222, 0.3);
	}

	/* Reset button chrome: the button only makes the card focusable and tappable. */
	.event-info {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding: 0;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.event-info:focus-visible,
	.event-title-link:focus-visible {
		outline: 1px solid var(--futuristic-cyan);
		outline-offset: 2px;
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
		color: var(--futuristic-cyan);
		text-decoration: none;
		transition: color 0.2s;
	}

	.event-card .event-title-link:hover {
		color: var(--futuristic-magenta);
		text-decoration: underline;
	}

	.event-card.past .event-title-link,
	.event-card.past .event-title-link:hover {
		text-decoration: line-through;
		text-decoration-color: rgba(200, 212, 222, 0.3);
	}

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
		opacity: 1;
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

	.rich-event-card.past {
		opacity: 0.75;
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
		color: var(--futuristic-text);
		letter-spacing: 0.04em;
	}

	.rich-card-title-link {
		color: var(--futuristic-cyan);
		text-decoration: none;
		transition: color 0.2s;
	}

	.rich-card-title-link:hover {
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
