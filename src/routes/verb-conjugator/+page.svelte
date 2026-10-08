<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { LANGUAGE_REGISTRY, getLanguage, type LanguageModule } from '$lib/data/language-registry';
	import { createPersistGate } from '$lib/persist-gate';
	import {
		LANGUAGE_STORAGE_KEY,
		languageStorageKeys,
		loadLanguageState,
		loadSelectedLanguage
	} from '$lib/verbs-storage';
	import {
		buildPool,
		selectCard,
		validateAnswer,
		processAnswer,
		getCoverage,
		getAccuracy,
		createFreshSession,
		cardKey,
		type Card,
		type SessionState,
		type HistoryEntry
	} from '$lib/verbs';

	// ─── Language Selection ────────────────────────────────────────────────────

	let selectedLanguageId = $state('italian');

	let lang = $derived.by(() => {
		const m = getLanguage(selectedLanguageId);
		if (!m) throw new Error(`Unknown language: ${selectedLanguageId}`);
		return m;
	});

	const ALL_VERBS = $derived([...lang.VERB_LIST].sort());
	const ALL_TENSES = $derived([...lang.TENSE_LIST].sort());

	// localStorage keys, per-language (for persistence only)
	const lsKeys = $derived(languageStorageKeys(lang.id));

	// ─── Language switcher ─────────────────────────────────────────────────────

	function switchLanguage(langId: string) {
		if (langId === selectedLanguageId) return;

		// Load state SYNCHRONOUSLY BEFORE updating selectedLanguageId
		// This prevents the race condition where activePool derives with wrong state
		const state = loadLanguageState(langId, browser ? localStorage : null);

		// Now update everything atomically
		selectedLanguageId = langId;
		selectedVerbs = state.verbs;
		selectedTenses = state.tenses;
		session = state.session;

		// Safe to clear currentCard now that pool will derive correctly
		currentCard = null;
		userInput = '';
		isSubmitting = false;
		pickCard();

		setTimeout(focusInput, 50);
	}

	// ─── State ───────────────────────────────────────────────────────────────────

	let selectedVerbs = $state<string[]>([]);
	let selectedTenses = $state<string[]>([]);
	let session = $state<SessionState>(createFreshSession());
	let currentCard = $state<Card | null>(null);
	let userInput = $state('');
	let isSubmitting = $state(false);

	// ─── Derived ─────────────────────────────────────────────────────────────────

	let activePool = $derived(
		selectedVerbs.length > 0 && selectedTenses.length > 0
			? buildPool(selectedVerbs, selectedTenses, session.correctCounts, lang)
			: []
	);

	let coverage = $derived(getCoverage(session.correctCounts, selectedVerbs, selectedTenses, lang));
	let accuracy = $derived(getAccuracy(session.history));
	// No playable slot at all (e.g. only potere + imperativo): nothing to complete
	let hasNoForms = $derived(
		coverage.denominator === 0 && selectedVerbs.length > 0 && selectedTenses.length > 0
	);
	let isComplete = $derived(
		activePool.length === 0 && selectedVerbs.length > 0 && selectedTenses.length > 0 && !hasNoForms
	);

	// ─── Card lines data ─────────────────────────────────────────────────────────

	let cardLines = $derived.by(() => {
		const card = currentCard;
		if (!card) return [];
		return lang.PERSON_LABELS.map((person) => {
			const key = cardKey(card.verb, card.tense, person);
			const entry = lang.conjugationMap.get(key);
			return {
				person,
				conjugation: entry?.conjugation ?? '',
				translation: entry?.translation ?? ''
			};
		});
	});

	let blankTranslation = $derived(
		currentCard ? (cardLines[currentCard.personIndex]?.translation ?? '') : ''
	);

	// ─── Pool change: pick a new card ────────────────────────────────────────────

	function pickCard() {
		if (activePool.length > 0) {
			currentCard = selectCard(activePool, session, lang);
		} else {
			currentCard = null;
		}
	}

	// ─── Submit answer ───────────────────────────────────────────────────────────

	function handleSubmit() {
		if (!currentCard || !userInput.trim() || isSubmitting) return;

		isSubmitting = true;
		const person = lang.PERSON_LABELS[currentCard.personIndex];
		const isCorrect = validateAnswer(userInput, currentCard.verb, currentCard.tense, person, lang);

		const key = cardKey(currentCard.verb, currentCard.tense, person);
		const entry = lang.conjugationMap.get(key);

		session = processAnswer(
			session,
			currentCard,
			userInput,
			isCorrect,
			entry?.conjugation ?? '',
			entry?.translation ?? '',
			lang
		);

		userInput = '';
		isSubmitting = false;
		pickCard();
		focusInput();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	// ─── Pill toggles ────────────────────────────────────────────────────────────

	function focusInput() {
		if (browser) {
			const input = document.querySelector('.verb-input') as HTMLInputElement | null;
			input?.focus();
		}
	}

	function toggleVerb(verb: string) {
		if (selectedVerbs.includes(verb)) {
			if (selectedVerbs.length <= 1) return; // prevent all deselected
			selectedVerbs = selectedVerbs.filter((v) => v !== verb);
		} else {
			selectedVerbs = [...selectedVerbs, verb];
		}
		currentCard = null;
		pickCard();
		setTimeout(focusInput, 50);
	}

	function toggleTense(tense: string) {
		if (selectedTenses.includes(tense)) {
			if (selectedTenses.length <= 1) return;
			selectedTenses = selectedTenses.filter((t) => t !== tense);
		} else {
			selectedTenses = [...selectedTenses, tense];
		}
		currentCard = null;
		pickCard();
		setTimeout(focusInput, 50);
	}

	function restart() {
		session = createFreshSession();
		userInput = '';
		isSubmitting = false;
		if (browser) {
			try {
				localStorage.removeItem(lsKeys.session);
			} catch {
				// Storage unavailable; the fresh session is still used in memory
			}
		}
		pickCard();
		setTimeout(focusInput, 50);
	}

	// ─── LocalStorage persistence ────────────────────────────────────────────────

	// Closed until onMount has restored saved state, so the initial defaults
	// never overwrite it.
	const persist = createPersistGate(browser ? localStorage : null);

	/** Persist through the gate; a full or blocked storage must not break the page. */
	function save(key: string, value: string) {
		try {
			persist.write(key, value);
		} catch {
			// QuotaExceededError / SecurityError: keep working without persistence
		}
	}

	$effect(() => {
		save(LANGUAGE_STORAGE_KEY, selectedLanguageId);
	});

	$effect(() => {
		if (selectedVerbs.length > 0) {
			save(lsKeys.verbs, JSON.stringify(selectedVerbs));
		}
	});

	$effect(() => {
		if (selectedTenses.length > 0) {
			save(lsKeys.tenses, JSON.stringify(selectedTenses));
		}
	});

	$effect(() => {
		save(lsKeys.session, JSON.stringify(session));
	});

	// ─── Init ────────────────────────────────────────────────────────────────────

	onMount(() => {
		// Restore the last language, then its state, before opening the gate
		const storage = browser ? localStorage : null;
		selectedLanguageId = loadSelectedLanguage(storage, selectedLanguageId);
		const state = loadLanguageState(selectedLanguageId, storage);
		selectedVerbs = state.verbs;
		selectedTenses = state.tenses;
		session = state.session;
		persist.open();
		pickCard();
		focusInput();
	});
</script>

<svelte:head>
	<title>Practice Verb Conjugation</title>
</svelte:head>

<div class="container">
	<header>
		<h1>PRACTICE VERB CONJUGATION</h1>

		<!-- Language Selector -->
		<div class="language-selector">
			<div class="format-buttons">
				{#each LANGUAGE_REGISTRY as language (language.id)}
					<button
						class="format-btn"
						class:active={selectedLanguageId === language.id}
						onclick={() => switchLanguage(language.id)}
					>
						{language.flag}
						{language.displayName}
					</button>
				{/each}
			</div>
		</div>

		<div class="stats-row">
			<span class="stat">{lang.ui.coverage}: {coverage.numerator} / {coverage.denominator}</span>
			<span class="stat-sep">·</span>
			<span class="stat">{lang.ui.accuracy}: {accuracy}%</span>
		</div>
	</header>

	<!-- Main 2x2 grid: Conjugation | History / Verbs | Tenses -->
	<div class="main-grid">
		<!-- Top-left: Conjugations -->
		<div class="conjugation-col">
			<section class="section">
				{#if hasNoForms}
					<p class="empty-pool-text">
						These tenses have no forms for the selected verbs. Select another verb or tense.
					</p>
				{:else if isComplete}
					<div class="completion">
						<p class="completion-text">Congratulations. Restart?</p>
						<button class="process-btn restart-btn-x" onclick={restart}>
							<span class="btn-text">Restart</span>
							<span class="btn-glow"></span>
						</button>
					</div>
				{:else}
					<div class="verb-card">
						<div class="verb-card-header">
							<span class="dot red"></span>
							<span class="dot yellow"></span>
							<span class="dot green"></span>
							<span class="panel-title">{lang.ui.conjugation.toUpperCase()}</span>
						</div>
						<div class="verb-card-body">
							{#if currentCard}
								<div class="card-lines">
									{#each cardLines as line, i}
										<span class="line-translation" class:is-blank={i === currentCard.personIndex}
											>{line.translation}</span
										>
										<span class="line-content" class:is-blank={i === currentCard.personIndex}>
											<span class="line-content-inner">
												{#if i === currentCard.personIndex}
													<span class="line-blank">______</span>
												{:else}
													<span class="line-person">{line.person}</span>
													<span class="line-conjugation">{line.conjugation || '—'}</span>
												{/if}
											</span>
										</span>
									{/each}
								</div>
							{:else}
								<p class="empty-pool-text">Select at least one verb and one tense to begin.</p>
							{/if}
						</div>
					</div>

					{#if currentCard}
						<!-- Input area -->
						<div class="input-area">
							<div class="input-row">
								<input
									class="verb-input"
									type="text"
									bind:value={userInput}
									placeholder={blankTranslation}
									aria-label="Answer: {lang.PERSON_LABELS[currentCard.personIndex]} form"
									onkeydown={handleKeydown}
									spellcheck="false"
									autocomplete="off"
								/>
								<button
									class="submit-verb-btn"
									aria-label="Submit"
									onclick={handleSubmit}
									disabled={!userInput.trim()}>↵</button
								>
							</div>
						</div>
					{/if}
				{/if}
			</section>
		</div>

		<!-- Top-right: History -->
		<div class="history-col">
			<section class="section">
				<div class="verb-card">
					<div class="verb-card-header">
						<span class="dot red"></span>
						<span class="dot yellow"></span>
						<span class="dot green"></span>
						<span class="panel-title">{lang.ui.history.toUpperCase()}</span>
					</div>
					{#if session.history.length === 0}
						<div class="verb-card-body">
							<p class="hint" style="margin: 0;">No attempts yet.</p>
						</div>
					{:else}
						<div class="history-scroll">
							<table class="history-table">
								<tbody>
									{#each session.history as entry}
										<tr>
											<td class="hist-meaning">{entry.translation}</td>
											<td class="hist-answer">
												<span class="answer-person">({entry.person}) </span>
												{#each entry.diff as seg}
													{#if seg.type === 'delete'}
														<span class="diff-delete">{seg.text}</span>
													{:else if seg.type === 'insert'}
														<span class="diff-insert">{seg.text}</span>
													{:else}
														<span class="diff-same">{seg.text}</span>
													{/if}
												{/each}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</section>
		</div>

		<!-- Bottom-left: Verbs -->
		<div class="verbs-col">
			<section class="section">
				<div class="section-header">
					<span class="label">{lang.ui.verb}</span>
				</div>
				<div class="format-buttons pills-small">
					{#each ALL_VERBS as verb}
						<button
							class="format-btn"
							class:active={selectedVerbs.includes(verb)}
							onclick={() => toggleVerb(verb)}
							disabled={selectedVerbs.length === 1 && selectedVerbs.includes(verb)}>{verb}</button
						>
					{/each}
				</div>
			</section>
		</div>

		<!-- Bottom-right: Verb Tenses -->
		<div class="tenses-col">
			<section class="section">
				<div class="section-header">
					<span class="label">{lang.ui.tense}</span>
				</div>
				<div class="format-buttons pills-small">
					{#each ALL_TENSES as tense}
						<button
							class="format-btn"
							class:active={selectedTenses.includes(tense)}
							onclick={() => toggleTense(tense)}
							disabled={selectedTenses.length === 1 && selectedTenses.includes(tense)}
							>{tense}</button
						>
					{/each}
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	/* ─── Language selector ────────────────────────────────────────── */
	.language-selector {
		display: flex;
		justify-content: center;
		margin: 1rem 0 0.5rem;
	}

	/* ─── Stats row ────────────────────────────────────────────── */
	.stats-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
		letter-spacing: 0.05em;
	}

	.stat {
		color: var(--futuristic-cyan);
	}

	.stat-sep {
		color: var(--futuristic-text-dim);
		opacity: 0.5;
	}

	/* ─── Main 2x2 grid layout ────────────────────────────────────── */
	.main-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		width: 100%;
	}

	.conjugation-col,
	.history-col,
	.verbs-col,
	.tenses-col {
		min-width: 0;
		width: 100%;
	}

	:global(.pills-small .format-btn) {
		font-size: 0.75rem;
		padding: 0.3rem 0.5rem;
		font-weight: 400;
	}

	/* Constrain scrollable panels so pills don't push layout too tall */
	.verbs-col .format-buttons,
	.tenses-col .format-buttons {
		max-height: 280px;
		overflow-y: auto;
	}

	.history-col .history-scroll {
		max-height: 360px;
	}

	@media (max-width: 800px) {
		.main-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ─── Verb Card ─────────────────────────────────────────────── */
	.verb-card {
		width: 100%; /* ensure cards expand to fill column */
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.verb-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.25);
		border-bottom: 1px solid var(--futuristic-border);
	}

	.verb-card-body {
		padding: 1rem 1.25rem;
	}

	.card-lines {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem;
		align-items: center;
	}

	.line-translation {
		text-align: right;
		white-space: nowrap;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-text-dim);
		padding: 0.15rem 0 0.15rem 0.75rem;
	}

	.line-content {
		white-space: nowrap;
		font-size: 0.85rem;
		padding: 0.15rem 0.75rem 0.15rem 0;
	}

	.line-content-inner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Row separator borders */
	.line-translation:not(:nth-last-child(2)) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.line-content:not(:last-child) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	/* Blank row */
	.line-translation.is-blank,
	.line-content.is-blank {
		background: rgba(0, 245, 255, 0.04);
		outline: 1px dashed rgba(0, 245, 255, 0.25);
		outline-offset: -1px;
	}

	.line-person,
	.line-conjugation {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-text);
		font-weight: 500;
		letter-spacing: 0.03em;
	}

	.line-blank {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--futuristic-text-dim);
		opacity: 0.5;
		letter-spacing: 0.1em;
	}

	/* ─── Diff colours ─────────────────────────────────────────── */
	.diff-delete {
		color: #ff6666;
		text-decoration: line-through;
	}

	.diff-insert {
		color: #4da6ff;
	}

	.diff-same {
		color: #4dff6a;
	}

	/* ─── Input area ────────────────────────────────────────────── */
	.input-area {
		margin-top: 0.5rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.verb-input {
		flex: 1;
		padding: 0.75rem 1rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 8px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 1rem;
		color: var(--futuristic-text);
		outline: none;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
	}

	.verb-input:focus {
		border-color: var(--futuristic-cyan);
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.2);
	}

	.verb-input:disabled {
		opacity: 0.5;
	}

	.verb-input::placeholder {
		color: var(--futuristic-text-dim);
		opacity: 0.7;
	}

	.submit-verb-btn {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(255, 0, 255, 0.1));
		border: 1px solid var(--futuristic-cyan);
		border-radius: 8px;
		color: var(--futuristic-cyan);
		font-family: 'Inter', sans-serif;
		font-size: 1.2rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s;
		flex-shrink: 0;
	}

	.submit-verb-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(255, 0, 255, 0.2));
		box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
	}

	.submit-verb-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ─── Completion ────────────────────────────────────────────── */
	.completion {
		text-align: center;
		padding: 2rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
	}

	.completion-text {
		font-family: 'Orbitron', sans-serif;
		font-size: 1.3rem;
		color: var(--futuristic-cyan);
		margin: 0 0 1.5rem;
		letter-spacing: 0.1em;
	}

	.restart-btn-x {
		display: inline-block;
		width: auto;
		padding: 0.75rem 2rem;
	}

	.empty-pool-text {
		color: var(--futuristic-text-dim);
		font-size: 0.95rem;
		margin: 0;
	}

	/* ─── History table ─────────────────────────────────────────── */
	.history-scroll {
		max-height: 400px;
		overflow-y: auto;
	}

	.history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.history-table td {
		padding: 0.15rem 0.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		vertical-align: middle;
		font-size: 0.85rem;
	}

	.history-table tbody tr:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.history-table tbody tr:first-child td {
		border-top: none;
	}

	.history-table .hist-meaning {
		text-align: right;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
	}

	.hist-answer {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.85rem;
	}

	.answer-person {
		color: var(--futuristic-text-dim);
		opacity: 0.6;
		margin-right: 0.25rem;
	}

	/* ─── Section spacing ───────────────────────────────────────── */
	.section {
		margin-bottom: 1.5rem;
	}

	/* ─── Mobile ────────────────────────────────────────────────── */
	@media (max-width: 600px) {
		.line-person,
		.line-conjugation {
			font-size: 0.8rem;
		}

		.card-lines {
			gap: 0.15rem;
		}

		.line-translation {
			font-size: 0.8rem;
			padding: 0.1rem 0 0.1rem 0.5rem;
		}

		.line-content {
			font-size: 0.8rem;
			padding: 0.1rem 0.5rem 0.1rem 0;
		}

		.verb-input {
			font-size: 0.9rem;
			padding: 0.6rem 0.75rem;
		}

		.submit-verb-btn {
			width: 42px;
			height: 42px;
			font-size: 1rem;
		}

		.history-table {
			font-size: 0.7rem;
		}

		.history-table td {
			padding: 0.1rem 0.4rem;
		}

		.stats-row {
			font-size: 0.75rem;
			flex-wrap: wrap;
		}
	}

	/* Override shared.css full-width pills on mobile */
	@media (max-width: 768px) {
		.pills-small.format-buttons {
			flex-direction: row;
			flex-wrap: wrap;
		}
		.pills-small .format-btn {
			width: auto;
			text-align: initial;
		}
	}
</style>
