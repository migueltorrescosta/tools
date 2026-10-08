import type { LanguageModule } from '$lib/data/language-registry';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Card {
	verb: string;
	tense: string;
	/** Index into PERSON_LABELS (0-5), determines which person is blank */
	personIndex: number;
}

export type DiffOpType = 'same' | 'delete' | 'insert';

export interface DiffSegment {
	type: DiffOpType;
	text: string;
}

export interface HistoryEntry {
	verb: string;
	tense: string;
	person: string;
	translation: string;
	userAnswer: string;
	correctAnswer: string;
	isCorrect: boolean;
	timestamp: number;
	/** Pre-computed diff between userAnswer and "person correctAnswer" */
	diff: DiffSegment[];
}

export interface SessionState {
	wrongVerb: Record<string, number>;
	wrongTense: Record<string, number>;
	wrongPerson: Record<string, number>;
	correctCounts: Record<string, number>;
	history: HistoryEntry[];
}

/** Most recent answers kept in a session; older ones are dropped. */
export const HISTORY_LIMIT = 200;

// ─── Card key helpers ────────────────────────────────────────────────────────

export function cardKey(verb: string, tense: string, person: string): string {
	return `${verb}:${tense}:${person}`;
}

/**
 * True when the slot has a form to practise. Unknown verbs/tenses (e.g. stale
 * selections from storage) and defective slots stored as '' (imperative 1sg,
 * potere/dovere imperativo) are not playable.
 */
export function isPlayable(
	verb: string,
	tense: string,
	person: string,
	module: LanguageModule
): boolean {
	const entry = module.conjugationMap.get(cardKey(verb, tense, person));
	return entry !== undefined && entry.conjugation !== '';
}

// ─── Answer normalisation ────────────────────────────────────────────────────

/**
 * Canonical form for comparing answers: NFC, typographic apostrophes folded to
 * ', runs of whitespace collapsed, trimmed and lowercased. Accents are kept.
 */
export function normalizeAnswer(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[\u2018\u2019\u02bc]/g, "'")
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/** Remove diacritics: "él" → "el", "você" → "voce". */
export function stripAccents(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/**
 * Pronoun prefixes accepted for a person label, longest first so that a
 * combined form ("él ella") is tried before its parts ("él"). For "a/b/c"
 * this yields the label, "a b c", "a/b", "a b", then each part, plus the
 * accent-less spelling of each ("tu" for "tú").
 */
export function personPrefixes(label: string): string[] {
	const base = normalizeAnswer(label);
	const candidates = [base];
	if (base.includes('/')) {
		const parts = base.split('/').map((v) => v.trim());
		candidates.push(parts.join(' '));
		if (parts.length > 2) {
			candidates.push(parts.slice(0, 2).join('/'), parts.slice(0, 2).join(' '));
		}
		candidates.push(...parts);
	}
	const withAccentless = candidates.flatMap((c) => [c, stripAccents(c)]);
	return [...new Set(withAccentless)].sort((a, b) => b.length - a.length);
}

/**
 * Strip the expected pronoun from a full-line answer and return the rest
 * (normalised). Returns '' when only the pronoun was typed and null when the
 * line does not start with an accepted pronoun.
 */
export function extractAfterPerson(input: string, expectedPersonLabel: string): string | null {
	const normalized = normalizeAnswer(input);
	for (const prefix of personPrefixes(expectedPersonLabel)) {
		if (normalized === prefix) return '';
		if (normalized.startsWith(prefix + ' ')) return normalized.slice(prefix.length + 1);
	}
	return null;
}

// ─── Pool building ───────────────────────────────────────────────────────────

/**
 * Build the active card pool from selected verbs and tenses.
 * Cards that have been answered correctly 2 or more times are removed.
 */
export function buildPool(
	verbs: string[],
	tenses: string[],
	correctCounts: Record<string, number>,
	module: LanguageModule
): Card[] {
	const pool: Card[] = [];

	for (const verb of verbs) {
		for (const tense of tenses) {
			// Up to 6 cards per (verb, tense) — one for each playable person
			for (let personIndex = 0; personIndex < module.PERSON_LABELS.length; personIndex++) {
				const person = module.PERSON_LABELS[personIndex];
				if (!isPlayable(verb, tense, person, module)) continue;
				const key = cardKey(verb, tense, person);
				const correctCount = correctCounts[key] ?? 0;
				if (correctCount >= 2) continue; // removal rule
				pool.push({ verb, tense, personIndex });
			}
		}
	}

	return pool;
}

// ─── Weighted selection ──────────────────────────────────────────────────────

/**
 * Select a card from the pool using weighted random selection.
 * Weight formula: (2 + wrongVerb) * (2 + wrongTense) * (2 + wrongPerson)
 */
export function selectCard(
	pool: Card[],
	session: SessionState,
	module: LanguageModule
): Card | null {
	if (pool.length === 0) return null;

	const weights: number[] = pool.map((card) => {
		const verb = (session.wrongVerb[card.verb] ?? 0) + 2;
		const tense = (session.wrongTense[card.tense] ?? 0) + 2;
		const person = (session.wrongPerson[module.PERSON_LABELS[card.personIndex]] ?? 0) + 2;
		return verb * tense * person;
	});

	const totalWeight = weights.reduce((a, b) => a + b, 0);
	let random = Math.random() * totalWeight;

	for (let i = 0; i < pool.length; i++) {
		random -= weights[i];
		if (random <= 0) return pool[i];
	}

	return pool[pool.length - 1];
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a user's full-line answer against the canonical conjugation or one
 * of its accepted alternatives. Both sides go through normalizeAnswer.
 */
export function validateAnswer(
	userInput: string,
	verb: string,
	tense: string,
	person: string,
	module: LanguageModule
): boolean {
	const key = cardKey(verb, tense, person);
	const entry = module.conjugationMap.get(key);
	if (!entry || entry.conjugation === '') return false;

	const extracted = module.extractConjugation(normalizeAnswer(userInput), person);
	if (extracted === null) return false;

	const accepted = [entry.conjugation, ...(entry.alternatives ?? [])].map(normalizeAnswer);
	return accepted.includes(normalizeAnswer(extracted));
}

// ─── Wagner-Fischer diff ──────────────────────────────────────────────────────

/**
 * Compute character-level diff between two strings using the Wagner-Fischer
 * (edit distance) algorithm. Returns segments grouped so removals precede
 * additions at each aligned position.
 *
 * Tiebreaker: prefer insert > substitute > delete when costs are equal.
 * This produces cleaner diffs (e.g. "h→son" instead of "so→h→n" for
 * "ho" → "sono").
 */
export function computeDiff(a: string, b: string): DiffSegment[] {
	const m = a.length;
	const n = b.length;

	// DP table: d[i][j] = edit distance between a[0..i) and b[0..j)
	const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 1; i <= m; i++) d[i][0] = i;
	for (let j = 1; j <= n; j++) d[0][j] = j;

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(
				d[i - 1][j] + 1, // delete
				d[i][j - 1] + 1, // insert
				d[i - 1][j - 1] + cost // match or substitute
			);
		}
	}

	// Backtrace
	const ops: Array<{ type: DiffOpType; char: string }> = [];
	let i = m;
	let j = n;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
			// Match
			ops.push({ type: 'same', char: a[i - 1] });
			i--;
			j--;
		} else {
			const subCost = i > 0 && j > 0 ? d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) : Infinity;
			const delCost = i > 0 ? d[i - 1][j] + 1 : Infinity;
			const insCost = j > 0 ? d[i][j - 1] + 1 : Infinity;

			// Tiebreaker: insert > substitute > delete (cleaner diffs)
			if (insCost <= delCost && insCost <= subCost) {
				// Insert
				ops.push({ type: 'insert', char: b[j - 1] });
				j--;
			} else if (subCost <= delCost) {
				// Substitute: push insert then delete, so after reversal
				// deletes come before inserts (removals then additions)
				ops.push({ type: 'insert', char: b[j - 1] });
				ops.push({ type: 'delete', char: a[i - 1] });
				i--;
				j--;
			} else {
				// Delete
				ops.push({ type: 'delete', char: a[i - 1] });
				i--;
			}
		}
	}

	ops.reverse();

	// Within each contiguous region without 'same', reorder so all
	// deletions come before all insertions. This produces cleaner
	// diffs like "v~~ad~~oy" instead of "v~~a~~o~~d~~y".
	const reordered: Array<{ type: DiffOpType; char: string }> = [];
	let idx = 0;
	while (idx < ops.length) {
		if (ops[idx].type === 'same') {
			reordered.push(ops[idx]);
			idx++;
		} else {
			// Collect a no-same region
			const deletes: string[] = [];
			const inserts: string[] = [];
			while (idx < ops.length && ops[idx].type !== 'same') {
				if (ops[idx].type === 'delete') {
					deletes.push(ops[idx].char);
				} else {
					inserts.push(ops[idx].char);
				}
				idx++;
			}
			for (const ch of deletes) reordered.push({ type: 'delete', char: ch });
			for (const ch of inserts) reordered.push({ type: 'insert', char: ch });
		}
	}

	// Group consecutive same-type ops into segments
	const segments: DiffSegment[] = [];
	for (const op of reordered) {
		const last = segments[segments.length - 1];
		if (last && last.type === op.type) {
			last.text += op.char;
		} else {
			segments.push({ type: op.type, text: op.char });
		}
	}

	return segments;
}

// ─── Session processing ──────────────────────────────────────────────────────

/**
 * Process an answer: update session state (wrong counts, correct counts, history).
 * Returns the updated session state.
 */
export function processAnswer(
	session: SessionState,
	card: Card,
	userInput: string,
	isCorrect: boolean,
	correctConjugation: string,
	translation: string,
	module: LanguageModule
): SessionState {
	const person = module.PERSON_LABELS[card.personIndex];
	const key = cardKey(card.verb, card.tense, person);

	const newCorrectCounts = { ...session.correctCounts };
	const newWrongVerb = { ...session.wrongVerb };
	const newWrongTense = { ...session.wrongTense };
	const newWrongPerson = { ...session.wrongPerson };

	if (isCorrect) {
		newCorrectCounts[key] = (newCorrectCounts[key] ?? 0) + 1;
	} else {
		newWrongVerb[card.verb] = (newWrongVerb[card.verb] ?? 0) + 1;
		newWrongTense[card.tense] = (newWrongTense[card.tense] ?? 0) + 1;
		newWrongPerson[person] = (newWrongPerson[person] ?? 0) + 1;
	}

	const userVerb =
		module.extractConjugation(normalizeAnswer(userInput), person) ?? userInput.trim();
	const diff = computeDiff(userVerb, correctConjugation.trim());

	const newHistory: HistoryEntry = {
		verb: card.verb,
		tense: card.tense,
		person,
		translation,
		userAnswer: userInput.trim(),
		correctAnswer: correctConjugation.trim(),
		isCorrect,
		timestamp: Date.now(),
		diff
	};

	return {
		wrongVerb: newWrongVerb,
		wrongTense: newWrongTense,
		wrongPerson: newWrongPerson,
		correctCounts: newCorrectCounts,
		history: [newHistory, ...session.history].slice(0, HISTORY_LIMIT)
	};
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface CoverageStats {
	numerator: number;
	denominator: number;
}

/**
 * Coverage = cards with ≥1 correct answer / total playable cards
 */
export function getCoverage(
	correctCounts: Record<string, number>,
	selectedVerbs: string[],
	selectedTenses: string[],
	module: LanguageModule
): CoverageStats {
	let denominator = 0;
	let numerator = 0;

	for (const verb of selectedVerbs) {
		for (const tense of selectedTenses) {
			for (const person of module.PERSON_LABELS) {
				if (!isPlayable(verb, tense, person, module)) continue;
				denominator++;
				const key = cardKey(verb, tense, person);
				if ((correctCounts[key] ?? 0) >= 1) {
					numerator++;
				}
			}
		}
	}

	return { numerator, denominator };
}

/**
 * Accuracy = correct attempts / total attempts
 */
export function getAccuracy(history: HistoryEntry[]): number {
	if (history.length === 0) return 0;
	const correct = history.filter((h) => h.isCorrect).length;
	return Math.round((correct / history.length) * 100);
}

// ─── Fresh session ───────────────────────────────────────────────────────────

export function createFreshSession(): SessionState {
	return {
		wrongVerb: {},
		wrongTense: {},
		wrongPerson: {},
		correctCounts: {},
		history: []
	};
}
