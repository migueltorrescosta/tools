<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import events from '../volt-ga/data/events.json';
	import {
		getMasterBoundaries,
		getRowSpan,
		getNowOffset,
		getActiveSessions,
		getNextSessions,
		formatTime,
		formatTimeRange,
		formatDuration,
		ROOMS,
		ROOM_COLORS
	} from './lib/timeline';
	import {
		syncFavorites,
		saveFavorites,
		updateUrlFavorites,
		toggleFavorite as toggleFav
	} from './lib/favorites';
	import { searchSessions } from './lib/search';
	import type { Session } from './lib/timeline';

	const allSessions = events as Session[];

	// ── State ──
	let now = $state(new Date());
	let favorites = $state<string[]>([]);
	let searchQuery = $state('');
	let searchOpen = $state(false);
	let selectedSession = $state<Session | null>(null);
	let shareOpen = $state(false);
	let qrDataUrl = $state('');
	let highlightId = $state<string | null>(null);

	// ── Derived ──
	const boundaries = $derived(getMasterBoundaries(allSessions));
	const roomColumns = $derived(ROOMS);
	const activeSessions = $derived(getActiveSessions(allSessions, now));
	const nextSessions = $derived(getNextSessions(allSessions, now));
	const nowOffset = $derived(getNowOffset(now, boundaries));
	const searchResults = $derived(searchSessions(searchQuery, allSessions));
	const isEventRunning = $derived({
		before: now.getTime() < new Date(allSessions[0].startTime).getTime(),
		after: now.getTime() > new Date(allSessions[allSessions.length - 1].endTime).getTime()
	});
	const favSet = $derived(new Set(favorites));

	// Sessions grouped by room
	const sessionsByRoom = $derived.by(() => {
		const map = new Map<string, Session[]>();
		for (const s of allSessions) {
			const list = map.get(s.room) || [];
			list.push(s);
			map.set(s.room, list);
		}
		return map;
	});

	// ── Functions ──
	function isActive(session: Session): boolean {
		return activeSessions.some((a) => a.id === session.id);
	}

	function isNextInRoom(session: Session): boolean {
		const next = nextSessions.get(session.room);
		return next?.id === session.id;
	}

	function isFavorited(id: string): boolean {
		return favSet.has(id);
	}

	function handleToggleFavorite(id: string) {
		const updated = toggleFav(id, favorites);
		favorites = updated;
		saveFavorites(updated);
		updateUrlFavorites(updated);
		if (shareOpen) generateQR();
	}

	function openDetail(session: Session) {
		if (session.type === 'buffer' || session.type === 'break') return;
		selectedSession = session;
	}

	function closeDetail() {
		selectedSession = null;
	}

	function openSearch() {
		searchQuery = '';
		searchOpen = true;
	}

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
	}

	function selectSearchResult(session: Session) {
		closeSearch();
		highlightId = session.id;
		scrollToSession(session.id);
		setTimeout(() => {
			highlightId = null;
		}, 2000);
	}

	function scrollToSession(sessionId: string) {
		const el = document.getElementById('session-' + sessionId);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function jumpToNow() {
		const nowLine = document.querySelector('.now-line') as HTMLElement;
		if (nowLine) {
			nowLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function openShare() {
		shareOpen = true;
		generateQR();
	}

	function closeShare() {
		shareOpen = false;
	}

	function copyShareLink() {
		const url = window.location.href;
		navigator.clipboard.writeText(url);
	}

	async function generateQR() {
		if (typeof window === 'undefined') return;
		try {
			const QRCode = (await import('qrcode')).default;
			const url = window.location.href;
			const dataUrl = await QRCode.toDataURL(url, {
				width: 256,
				margin: 2,
				color: { dark: '#00f5ff', light: '#0f0f18' }
			});
			qrDataUrl = dataUrl;
		} catch {
			// QR generation failed silently
		}
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeSearch();
	}

	function handleDetailKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeDetail();
	}

	function handleShareKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeShare();
	}

	function getSpeakerNameList(session: Session): string {
		if (session.speakers.length === 0) return '';
		return session.speakers.map((s) => s.name).join(', ');
	}

	// ── Effects ──
	$effect(() => {
		// Init favorites from URL or localStorage
		favorites = syncFavorites();
	});

	$effect(() => {
		// Update now every 30 seconds
		const interval = setInterval(() => {
			now = new Date();
		}, 30000);
		return () => clearInterval(interval);
	});

	// ── Mount ──
	onMount(() => {
		// Auto-scroll to "now" on initial load
		setTimeout(() => {
			jumpToNow();
		}, 100);
	});
</script>

<svelte:head>
	<title>Volt GA Bratislava 2026</title>
</svelte:head>

<div class="container">
	<header>
		<h1>VOLT GA BRATISLAVA 2026</h1>
		<p class="subtitle">Saturday 13 June &middot; Schedule</p>
	</header>

	<!-- Toolbar -->
	<div class="toolbar">
		<button class="toolbar-btn" onclick={openSearch}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
				><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" /><path
					d="M11 11l4 4"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/></svg
			>
			Search
		</button>
		<button class="toolbar-btn" onclick={jumpToNow}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
				><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" /><line
					x1="8"
					y1="4"
					x2="8"
					y2="8"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/><line
					x1="8"
					y1="8"
					x2="11"
					y2="8"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/></svg
			>
			Jump to Now
		</button>
		<button class="toolbar-btn" onclick={openShare}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
				><circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5" /><circle
					cx="12"
					cy="4"
					r="2.5"
					stroke="currentColor"
					stroke-width="1.5"
				/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5" /><line
					x1="6.5"
					y1="6.5"
					x2="9.5"
					y2="4.5"
					stroke="currentColor"
					stroke-width="1.5"
				/><line x1="6.5" y1="9" x2="9.5" y2="11" stroke="currentColor" stroke-width="1.5" /></svg
			>
			Share
		</button>
		<div class="toolbar-status">
			<span class="status-dot" class:active={!isEventRunning.before && !isEventRunning.after}
			></span>
			<span class="status-time">{formatTime(now.toISOString())}</span>
		</div>
	</div>

	<!-- Schedule Grid -->
	<div class="schedule-wrapper">
		<div
			class="schedule-grid"
			style="grid-template-rows: auto repeat({boundaries.length - 1}, 1fr);"
		>
			<!-- Room Headers -->
			<div class="time-header-cell">Time</div>
			{#each roomColumns as room (room)}
				{@const color = ROOM_COLORS[room]}
				<div class="room-header" style="--room-color: {color};">
					{room}
				</div>
			{/each}

			<!-- Timeline rows & Time Labels -->
			{#each boundaries as b, i (b)}
				{@const nextBoundary = boundaries[i + 1]}
				{#if nextBoundary}
					<div class="time-label" style="grid-row: {i + 2} / {i + 3};">
						{b}
					</div>
				{/if}
			{/each}

			<!-- Session Cards -->
			{#each allSessions as session (session.id)}
				{@const span = getRowSpan(session, boundaries)}
				{@const roomIdx = roomColumns.indexOf(session.room)}
				{@const color = ROOM_COLORS[session.room]}
				{@const active = isActive(session)}
				{@const next = isNextInRoom(session)}
				{@const fav = isFavorited(session.id)}
				{@const highlighted = highlightId === session.id}
				{@const isClickable = session.type !== 'buffer' && session.type !== 'break'}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					id="session-{session.id}"
					class="session-card"
					class:active
					class:next
					class:favorited={fav}
					class:highlighted
					class:clickable={isClickable}
					class:buffer={session.type === 'buffer'}
					class:break={session.type === 'break'}
					style="
						--room-color: {color};
						grid-column: {roomIdx + 2} / {roomIdx + 3};
						grid-row: {span.rowStart} / {span.rowEnd};
					"
					onclick={isClickable ? () => openDetail(session) : undefined}
					role={isClickable ? 'button' : 'presentation'}
					tabindex={isClickable ? 0 : -1}
					onkeydown={isClickable
						? (e) => {
								if (e.key === 'Enter') openDetail(session);
							}
						: undefined}
					aria-label={session.title}
				>
					{#if next}
						<span class="next-badge">NEXT</span>
					{/if}
					<button
						class="fav-btn"
						class:faved={fav}
						onclick={(e) => {
							e.stopPropagation();
							handleToggleFavorite(session.id);
						}}
						aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
					>
						{fav ? '\u2605' : '\u2606'}
					</button>
					<div class="card-content">
						<div class="card-title">{session.title}</div>
						<div class="card-time">{formatTimeRange(session.startTime, session.endTime)}</div>
						{#if session.speakers.length > 0}
							<div class="card-speakers">{getSpeakerNameList(session)}</div>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Now Line -->
			<div class="now-line" style="top: calc({nowOffset * 100}% + 40px);" aria-hidden="true">
				<span class="now-label">NOW {formatTime(now.toISOString())}</span>
			</div>
		</div>
	</div>

	<!-- Legend -->
	<div class="legend">
		<div class="legend-item">
			<span class="legend-swatch" style="background: #00f5ff;"></span>
			<span class="legend-text">Active</span>
		</div>
		<div class="legend-item">
			<span class="legend-swatch" style="background: #f59e0b;"></span>
			<span class="legend-text">Next</span>
		</div>
		<div class="legend-item">
			<span class="legend-swatch fav-swatch">&#9733;</span>
			<span class="legend-text">Favorited</span>
		</div>
	</div>

	<!-- Overlay -->
	{#if searchOpen || selectedSession || shareOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="overlay"
			onclick={() => {
				closeSearch();
				closeDetail();
				closeShare();
			}}
		></div>
	{/if}

	<!-- Search Modal -->
	{#if searchOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onkeydown={handleSearchKeydown} role="dialog" aria-label="Search sessions" tabindex="-1">
			<div class="modal-header">
				<span class="modal-title">SEARCH</span>
				<button class="modal-close" onclick={closeSearch} aria-label="Close search">&times;</button>
			</div>
			<div class="modal-body">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					class="search-input"
					placeholder="Search by title, description, or speaker..."
					bind:value={searchQuery}
					autofocus
				/>
				{#if searchQuery && searchResults.length === 0}
					<div class="search-empty">No sessions found</div>
				{/if}
				{#if searchResults.length > 0}
					<div class="search-results">
						{#each searchResults as result (result.session.id)}
							{@const s = result.session}
							<button class="search-result" onclick={() => selectSearchResult(s)}>
								<span class="search-result-title">{s.title}</span>
								<span class="search-result-meta">
									{s.room} &middot; {formatTimeRange(s.startTime, s.endTime)}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Session Detail Modal -->
	{#if selectedSession}
		{@const s = selectedSession}
		{@const roomColor = ROOM_COLORS[s.room]}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="modal modal-detail"
			onkeydown={handleDetailKeydown}
			role="dialog"
			aria-label={s.title}
			tabindex="-1"
		>
			<div class="modal-header">
				<span class="modal-title">SESSION</span>
				<button class="modal-close" onclick={closeDetail} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				<div class="detail-room" style="--room-color: {roomColor};">{s.room}</div>
				<h2 class="detail-title">{s.title}</h2>
				<div class="detail-time">
					{formatTimeRange(s.startTime, s.endTime)}
					<span class="detail-duration">({formatDuration(s.startTime, s.endTime)})</span>
				</div>
				{#if s.description}
					<div class="detail-description">{s.description}</div>
				{/if}
				{#if s.speakers.length > 0}
					<div class="detail-section">
						<h3 class="detail-section-title">Speakers</h3>
						<ul class="detail-speakers">
							{#each s.speakers as speaker (speaker.name)}
								<li>{speaker.name}</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if s.moderator}
					<div class="detail-section">
						<h3 class="detail-section-title">Moderator</h3>
						<p class="detail-moderator">{s.moderator}</p>
					</div>
				{/if}
				<button
					class="fav-button"
					class:faved={isFavorited(s.id)}
					onclick={() => handleToggleFavorite(s.id)}
				>
					{isFavorited(s.id) ? '\u2605' : '\u2606'}
					{isFavorited(s.id) ? 'Favorited' : 'Add to Favorites'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Share Modal -->
	{#if shareOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="modal modal-share"
			onkeydown={handleShareKeydown}
			role="dialog"
			aria-label="Share schedule"
			tabindex="-1"
		>
			<div class="modal-header">
				<span class="modal-title">SHARE</span>
				<button class="modal-close" onclick={closeShare} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body share-body">
				<p class="share-hint">Share your favorited sessions. The link preserves your selection.</p>
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="QR code for favorites" class="qr-code" />
				{:else}
					<div class="qr-placeholder">Generating QR&hellip;</div>
				{/if}
				<button class="copy-link-btn" onclick={copyShareLink}> Copy Link </button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Toolbar ── */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1rem;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		color: var(--futuristic-text-dim);
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.toolbar-btn:hover {
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.toolbar-btn svg {
		flex-shrink: 0;
	}

	.toolbar-status {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #555;
		transition: background 0.3s;
	}

	.status-dot.active {
		background: #4dff6a;
		box-shadow: 0 0 8px rgba(77, 255, 106, 0.6);
	}

	.status-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
	}

	/* ── Schedule Grid ── */
	.schedule-wrapper {
		overflow-x: auto;
		overflow-y: visible;
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		background: var(--futuristic-surface);
		position: relative;
	}

	.schedule-wrapper::-webkit-scrollbar {
		height: 10px;
	}

	.schedule-wrapper::-webkit-scrollbar-track {
		background: var(--futuristic-bg);
	}

	.schedule-wrapper::-webkit-scrollbar-thumb {
		background: linear-gradient(90deg, var(--futuristic-cyan), var(--futuristic-blue));
		border-radius: 5px;
	}

	.schedule-grid {
		display: grid;
		grid-template-columns: 80px repeat(4, minmax(220px, 1fr));
		min-width: 960px;
		position: relative;
	}

	/* ── Room Headers ── */
	.time-header-cell {
		padding: 0.75rem 0.5rem;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.1em;
		text-align: center;
		border-bottom: 1px solid var(--futuristic-border);
		border-right: 1px solid var(--futuristic-border);
		background: rgba(0, 0, 0, 0.3);
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.room-header {
		padding: 0.75rem 0.5rem;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.1em;
		text-align: center;
		border-bottom: 1px solid var(--futuristic-border);
		border-right: 1px solid var(--futuristic-border);
		background: color-mix(in srgb, var(--room-color) 25%, var(--futuristic-surface));
		position: sticky;
		top: 0;
		z-index: 5;
	}

	/* ── Time Labels ── */
	.time-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
		color: var(--futuristic-text-dim);
		padding: 0.15rem 0.5rem;
		text-align: right;
		border-right: 1px solid rgba(0, 245, 255, 0.15);
		border-bottom: 1px solid rgba(0, 245, 255, 0.06);
		white-space: nowrap;
	}

	/* ── Session Cards ── */
	.session-card {
		position: relative;
		margin: 2px;
		padding: 0.4rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-left: 3px solid var(--room-color);
		border-radius: 6px;
		overflow: hidden;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.session-card.clickable {
		cursor: pointer;
	}

	.session-card.clickable:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--room-color);
	}

	.session-card.active {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 15px rgba(0, 245, 255, 0.3);
		background: rgba(0, 245, 255, 0.08);
	}

	.session-card.next {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.06);
	}

	.session-card.favorited {
		border-left-color: #ffd700;
		background: rgba(255, 215, 0, 0.06);
	}

	.session-card.favorited.active {
		box-shadow:
			0 0 15px rgba(0, 245, 255, 0.3),
			0 0 8px rgba(255, 215, 0, 0.3);
	}

	.session-card.highlighted {
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.5);
		border-color: var(--futuristic-cyan);
		animation: pulse-highlight 2s ease-out;
	}

	@keyframes pulse-highlight {
		0% {
			box-shadow: 0 0 30px rgba(0, 245, 255, 0.7);
		}
		100% {
			box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
		}
	}

	.session-card.buffer {
		border-style: dashed;
		opacity: 0.4;
		background: transparent;
	}

	.session-card.break {
		opacity: 0.6;
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.05);
	}

	.next-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		padding: 1px 5px;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.5rem;
		font-weight: 700;
		color: #000;
		background: #f59e0b;
		border-radius: 3px;
		letter-spacing: 0.05em;
		z-index: 2;
	}

	.fav-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.3);
		font-size: 1rem;
		cursor: pointer;
		padding: 2px;
		line-height: 1;
		z-index: 2;
		transition: color 0.2s;
	}

	.fav-btn:hover {
		color: #ffd700;
	}

	.fav-btn.faved {
		color: #ffd700;
		text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
	}

	.card-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
	}

	.card-title {
		font-family: 'Inter', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--futuristic-text);
		line-height: 1.3;
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		padding-right: 1.2rem;
	}

	.card-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		color: var(--futuristic-text-dim);
	}

	.card-speakers {
		font-family: 'Inter', sans-serif;
		font-size: 0.6rem;
		color: var(--futuristic-text-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Now Line ── */
	.now-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--futuristic-magenta);
		box-shadow: 0 0 10px rgba(255, 0, 255, 0.6);
		z-index: 10;
		pointer-events: none;
	}

	.now-label {
		position: absolute;
		left: 8px;
		top: -10px;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--futuristic-magenta);
		white-space: nowrap;
		text-shadow: 0 0 8px rgba(255, 0, 255, 0.5);
		background: var(--futuristic-bg);
		padding: 0 4px;
	}

	/* ── Legend ── */
	.legend {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.legend-swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fav-swatch {
		background: rgba(255, 215, 0, 0.2);
		border: 1px solid #ffd700;
		color: #ffd700;
		font-size: 0.6rem;
	}

	.legend-text {
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
		color: var(--futuristic-text-dim);
	}

	/* ── Overlay ── */
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 100;
	}

	/* ── Modal ── */
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90%;
		max-width: 500px;
		max-height: 80vh;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		z-index: 200;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 0 40px rgba(0, 245, 255, 0.3);
	}

	.modal-header {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.25);
		border-bottom: 1px solid var(--futuristic-border);
	}

	.modal-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--futuristic-cyan);
		letter-spacing: 0.1em;
	}

	.modal-close {
		margin-left: auto;
		background: none;
		border: none;
		color: var(--futuristic-text-dim);
		font-size: 1.5rem;
		cursor: pointer;
		line-height: 1;
		padding: 0;
	}

	.modal-close:hover {
		color: var(--futuristic-cyan);
	}

	.modal-body {
		padding: 1rem;
		overflow-y: auto;
		flex: 1;
	}

	/* ── Search ── */
	.search-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--futuristic-bg);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-size: 0.95rem;
		color: var(--futuristic-text);
		outline: none;
		margin-bottom: 0.75rem;
		transition: border-color 0.3s;
	}

	.search-input:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.search-input::placeholder {
		color: var(--futuristic-text-dim);
	}

	.search-empty {
		text-align: center;
		padding: 2rem;
		color: var(--futuristic-text-dim);
		font-family: 'Inter', sans-serif;
		font-size: 0.9rem;
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 50vh;
		overflow-y: auto;
	}

	.search-result {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.6rem 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font-family: inherit;
		transition: all 0.2s;
	}

	.search-result:hover {
		border-color: var(--futuristic-cyan);
		background: rgba(0, 245, 255, 0.05);
	}

	.search-result-title {
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--futuristic-text);
	}

	.search-result-meta {
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
		color: var(--futuristic-text-dim);
	}

	/* ── Detail Modal ── */
	.modal-detail {
		max-width: 550px;
	}

	.detail-room {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		color: #fff;
		letter-spacing: 0.1em;
		background: color-mix(in srgb, var(--room-color) 40%, transparent);
		border: 1px solid var(--room-color);
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	.detail-title {
		font-family: 'Inter', sans-serif;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--futuristic-text);
		margin: 0 0 0.5rem 0;
		line-height: 1.3;
	}

	.detail-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-cyan);
		margin-bottom: 1rem;
	}

	.detail-duration {
		color: var(--futuristic-text-dim);
		margin-left: 0.3rem;
	}

	.detail-description {
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
		line-height: 1.6;
		margin-bottom: 1rem;
		white-space: pre-wrap;
	}

	.detail-section {
		margin-bottom: 0.75rem;
	}

	.detail-section-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.1em;
		margin: 0 0 0.3rem 0;
	}

	.detail-speakers {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.detail-speakers li {
		padding: 0.25rem 0;
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		color: var(--futuristic-text);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.detail-moderator {
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		color: var(--futuristic-text);
		margin: 0;
	}

	.fav-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.6rem;
		margin-top: 1rem;
		background: rgba(255, 215, 0, 0.08);
		border: 1px solid rgba(255, 215, 0, 0.3);
		border-radius: 8px;
		color: #ffd700;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.2s;
	}

	.fav-button:hover {
		background: rgba(255, 215, 0, 0.15);
		border-color: #ffd700;
	}

	.fav-button.faved {
		background: rgba(255, 215, 0, 0.15);
		border-color: #ffd700;
	}

	/* ── Share Modal ── */
	.modal-share {
		max-width: 380px;
	}

	.share-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.share-hint {
		font-family: 'Inter', sans-serif;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
		text-align: center;
		margin: 0;
	}

	.qr-code {
		width: 180px;
		height: 180px;
		border-radius: 8px;
		border: 2px solid var(--futuristic-border);
	}

	.qr-placeholder {
		width: 180px;
		height: 180px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Inter', sans-serif;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
		border: 2px dashed var(--futuristic-border);
		border-radius: 8px;
	}

	.copy-link-btn {
		padding: 0.6rem 1.5rem;
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(255, 0, 255, 0.1));
		border: 1px solid var(--futuristic-cyan);
		border-radius: 8px;
		color: var(--futuristic-cyan);
		font-family: 'Orbitron', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.3s;
	}

	.copy-link-btn:hover {
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(255, 0, 255, 0.2));
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
	}

	/* ── Responsive ── */
	@media (max-width: 1024px) {
		.schedule-grid {
			grid-template-columns: 70px repeat(4, minmax(200px, 1fr));
			min-width: 870px;
		}
	}

	@media (max-width: 768px) {
		.schedule-grid {
			grid-template-columns: 60px repeat(4, minmax(180px, 1fr));
			min-width: 780px;
		}

		.toolbar {
			gap: 0.3rem;
			padding: 0.5rem;
		}

		.toolbar-btn {
			font-size: 0.75rem;
			padding: 0.4rem 0.6rem;
		}

		.room-header {
			font-size: 0.65rem;
			padding: 0.5rem 0.25rem;
		}

		.card-title {
			font-size: 0.6rem;
		}

		.session-card {
			padding: 0.25rem 0.35rem;
		}
	}
</style>
