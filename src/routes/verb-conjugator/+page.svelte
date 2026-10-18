<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Button, PageHeader, Panel, SegmentedControl } from '$lib/ui';
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

	const LANGUAGE_OPTIONS = LANGUAGE_REGISTRY.map((l) => ({
		value: l.id,
		label: l.displayName,
		icon: l.flag
	}));

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
		feedback = null;
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
	/** The last answer, announced in the feedback live region. */
	let feedback = $state<HistoryEntry | null>(null);
	/** Set once the page is interactive, so e2e tests can wait for hydration. */
	let hydrated = $state(false);

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

		feedback = session.history[0];
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
		feedback = null;
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
		hydrated = true;
		focusInput();
	});
</script>

{#snippet diff(entry: HistoryEntry)}
	<span class="vc-person">{entry.person}</span>
	{#each entry.diff as seg, i (i)}
		{#if seg.type === 'delete'}
			<del class="vc-wrong">{seg.text}</del>
		{:else if seg.type === 'insert'}
			<ins class="vc-right">{seg.text}</ins>
		{:else}
			<span>{seg.text}</span>
		{/if}
	{/each}
{/snippet}

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/verb-conjugator" />

	<div class="vc-toolbar">
		<SegmentedControl
			legend="Language"
			hideLegend
			options={LANGUAGE_OPTIONS}
			bind:value={() => selectedLanguageId, switchLanguage}
		/>
		<p class="vc-stats" data-testid="stats">
			{lang.ui.coverage}: {coverage.numerator} / {coverage.denominator}
			<span aria-hidden="true">·</span>
			{lang.ui.accuracy}: {accuracy}%
		</p>
	</div>

	<div class="vc-grid">
		<Panel title={lang.ui.conjugation}>
			{#if hasNoForms}
				<p class="vc-empty">
					These tenses have no forms for the selected verbs. Select another verb or tense.
				</p>
			{:else if isComplete}
				<div class="vc-complete">
					<p>Congratulations. Restart?</p>
					<Button variant="primary" onclick={restart}>Restart</Button>
				</div>
			{:else if currentCard}
				<table class="vc-card">
					<tbody>
						{#each cardLines as line, i (line.person)}
							{@const current = i === currentCard.personIndex}
							<tr data-testid="card-row" data-state={current ? 'current' : undefined}>
								<td class="vc-marker" aria-hidden="true">{current ? '▸' : ''}</td>
								<td class="vc-translation">{line.translation}</td>
								{#if current}
									<td class="vc-answer" colspan="2"
										><span class="vc-blank">______</span><span class="sr-only">to answer</span></td
									>
								{:else}
									<td class="vc-person">{line.person}</td>
									<td class="vc-answer">{line.conjugation || '—'}</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="vc-input-row">
					<input
						class="control verb-input"
						type="text"
						bind:value={userInput}
						placeholder={blankTranslation}
						aria-label="Answer: {lang.PERSON_LABELS[currentCard.personIndex]} form"
						onkeydown={handleKeydown}
						spellcheck="false"
						autocomplete="off"
					/>
					<Button
						variant="primary"
						aria-label="Submit"
						onclick={handleSubmit}
						disabled={!userInput.trim()}><span aria-hidden="true">↵</span></Button
					>
				</div>
			{:else}
				<p class="vc-empty">Select at least one verb and one tense to begin.</p>
			{/if}

			<p class="vc-feedback" role="status" data-state={feedback?.isCorrect ? 'correct' : 'wrong'}>
				{#if feedback}
					{#if feedback.isCorrect}
						<span aria-hidden="true">✓</span> Correct: {feedback.person}
						{feedback.correctAnswer}
					{:else}
						<span aria-hidden="true">✗</span> Not quite: {feedback.person}
						{feedback.correctAnswer}
						<span class="vc-muted">(your answer: {feedback.userAnswer})</span>
					{/if}
				{/if}
			</p>
		</Panel>

		<Panel title={lang.ui.history}>
			{#if session.history.length === 0}
				<p class="vc-empty">No attempts yet.</p>
			{:else}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="vc-history" tabindex="0" role="region" aria-label={lang.ui.history}>
					<table data-testid="history">
						<tbody>
							{#each session.history as entry, i (i)}
								<tr data-state={entry.isCorrect ? 'correct' : 'wrong'}>
									<td class="vc-mark"
										><span aria-hidden="true">{entry.isCorrect ? '✓' : '✗'}</span><span
											class="sr-only">{entry.isCorrect ? 'Correct' : 'Wrong'}</span
										></td
									>
									<td class="vc-translation">{entry.translation}</td>
									<td class="vc-answer">{@render diff(entry)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Panel>

		<Panel>
			<div class="vc-group" role="group" aria-labelledby="vc-verbs">
				<h2 id="vc-verbs">{lang.ui.verb}</h2>
				<div class="cluster vc-chips">
					{#each ALL_VERBS as verb (verb)}
						{@const on = selectedVerbs.includes(verb)}
						<Button
							size="sm"
							pressed={on}
							onclick={() => toggleVerb(verb)}
							disabled={on && selectedVerbs.length === 1}>{verb}</Button
						>
					{/each}
				</div>
			</div>
		</Panel>

		<Panel>
			<div class="vc-group" role="group" aria-labelledby="vc-tenses">
				<h2 id="vc-tenses">{lang.ui.tense}</h2>
				<div class="cluster vc-chips">
					{#each ALL_TENSES as tense (tense)}
						{@const on = selectedTenses.includes(tense)}
						<Button
							size="sm"
							pressed={on}
							onclick={() => toggleTense(tense)}
							disabled={on && selectedTenses.length === 1}>{tense}</Button
						>
					{/each}
				</div>
			</div>
		</Panel>
	</div>
</div>

<style>
	.vc-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2) var(--sp-4);
		margin-bottom: var(--sp-3);
	}

	.vc-stats {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.vc-grid {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: 1fr;
		align-items: start;
	}

	@media (min-width: 800px) {
		.vc-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-md);
	}

	td {
		padding: var(--sp-0) var(--sp-2);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	tr:last-child td {
		border-bottom: 0;
	}

	.vc-translation {
		width: 1%;
		text-align: right;
		color: var(--text-muted);
	}

	.vc-person {
		width: 1%;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.vc-answer {
		font-family: var(--font-mono);
		font-weight: 500;
	}

	/* Compound tenses ("you all have been able") would overflow a phone screen. */
	@media (max-width: 480px) {
		.vc-translation,
		.vc-answer {
			white-space: normal;
			overflow-wrap: anywhere;
		}
	}

	.vc-marker,
	.vc-mark {
		width: 1%;
		padding-right: 0;
		font-weight: 700;
	}

	.vc-card tr[data-state='current'] td {
		background: var(--accent-bg);
		color: var(--text);
	}

	.vc-card tr[data-state='current'] .vc-marker {
		color: var(--accent);
		box-shadow: inset 3px 0 0 var(--accent);
	}

	.vc-blank {
		color: var(--text-muted);
		letter-spacing: 0.1em;
	}

	.vc-input-row {
		display: flex;
		gap: var(--sp-2);
		margin-top: var(--sp-3);
	}

	.verb-input {
		flex: 1;
		font-family: var(--font-mono);
	}

	.vc-feedback {
		min-height: 1.5em;
		margin: var(--sp-2) 0 0;
		font-size: var(--text-sm);
	}

	.vc-feedback[data-state='correct'] {
		color: var(--success-text);
	}

	.vc-feedback[data-state='wrong'] {
		color: var(--danger-text);
	}

	.vc-muted {
		color: var(--text-muted);
	}

	.vc-empty {
		margin: 0;
		color: var(--text-muted);
	}

	.vc-complete {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.vc-complete p {
		margin: 0;
	}

	.vc-history {
		max-height: 320px;
		overflow-y: auto;
	}

	.vc-history tr[data-state='correct'] .vc-mark {
		color: var(--success-text);
	}

	.vc-history tr[data-state='wrong'] .vc-mark {
		color: var(--danger-text);
	}

	.vc-history .vc-person::after {
		content: ' ';
	}

	.vc-wrong {
		color: var(--danger-text);
		text-decoration: line-through;
	}

	.vc-right {
		color: var(--success-text);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.vc-group h2 {
		margin: 0 0 var(--sp-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.vc-chips {
		--gap: var(--sp-1);
	}

	/* The last selected chip cannot be turned off, but should still read as selected. */
	.vc-chips :global(.ui-btn[aria-pressed='true']:disabled) {
		opacity: 1;
		cursor: default;
	}
</style>
