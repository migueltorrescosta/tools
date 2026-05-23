import { conjugationMap, PERSON_LABELS, type ConjugationMap } from '$lib/data/italian-conjugations';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Card {
	verb: string;
	tense: string;
	/** Index into PERSON_LABELS (0-5), determines which person is blank */
	personIndex: number;
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
}

export interface SessionState {
	wrongVerb: Record<string, number>;
	wrongTense: Record<string, number>;
	wrongPerson: Record<string, number>;
	correctCounts: Record<string, number>;
	history: HistoryEntry[];
}

// ─── Card key helpers ────────────────────────────────────────────────────────

export function cardKey(verb: string, tense: string, person: string): string {
	return `${verb}:${tense}:${person}`;
}

// ─── Pool building ───────────────────────────────────────────────────────────

/**
 * Build the active card pool from selected verbs and tenses.
 * Cards that have been answered correctly 2 or more times are removed.
 */
export function buildPool(
	verbs: string[],
	tenses: string[],
	correctCounts: Record<string, number>
): Card[] {
	const pool: Card[] = [];

	for (const verb of verbs) {
		for (const tense of tenses) {
			// Total 6 cards per (verb, tense) — one for each missing person
			for (let personIndex = 0; personIndex < 6; personIndex++) {
				const person = PERSON_LABELS[personIndex];
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
export function selectCard(pool: Card[], session: SessionState): Card | null {
	if (pool.length === 0) return null;

	const weights: number[] = pool.map((card) => {
		const verb = (session.wrongVerb[card.verb] ?? 0) + 2;
		const tense = (session.wrongTense[card.tense] ?? 0) + 2;
		const person = (session.wrongPerson[PERSON_LABELS[card.personIndex]] ?? 0) + 2;
		return verb * tense * person;
	});

	const totalWeight = weights.reduce((a, b) => a + b, 0);
	let random = Math.random() * totalWeight;

	for (let i = 0; i < pool.length; i++) {
		random -= weights[i];
		if (random <= 0) return pool[i];
	}

}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Extract the conjugation from a full-line user input.
 * User types e.g. "io vado" for a card where the blank is "io".
 *
 * Returns the extracted conjugation or null if parsing fails.
 */
export function extractConjugation(
	input: string,
	expectedPersonLabel: string
): string | null {
	const normalized = input.trim().toLowerCase();
	const label = expectedPersonLabel.toLowerCase();

	// Try exact label match first
	if (normalized.startsWith(label + ' ')) {
		return normalized.slice(label.length).trim();
	}
	if (normalized === label) {
		return ''; // just the label, no conjugation
	}

	// For "lui/lei" also accept "lui lei", "lei", and "lui"
	if (label === 'lui/lei') {
		for (const alt of ['lui lei', 'lei', 'lui']) {
			if (normalized.startsWith(alt + ' ')) {
				return normalized.slice(alt.length).trim();
			}
			if (normalized === alt) {
				return '';
			}
		}
	}

	return null;
}

/**
 * Validate a user's full-line answer against the canonical conjugation.
 * Returns true if the extracted conjugation matches the canon.
 */
export function validateAnswer(
	userInput: string,
	verb: string,
	tense: string,
	person: string,
	map: ConjugationMap
): boolean {
	const key = cardKey(verb, tense, person);
	const entry = map.get(key);
	if (!entry) return false;

	const extracted = extractConjugation(userInput, person);
	if (extracted === null) return false;

	return extracted === entry.conjugation.trim().toLowerCase();
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
	translation: string
): SessionState {
	const person = PERSON_LABELS[card.personIndex];
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

	const newHistory: HistoryEntry = {
		verb: card.verb,
		tense: card.tense,
		person,
		translation,
		userAnswer: userInput.trim(),
		correctAnswer: correctConjugation.trim(),
		isCorrect,
		timestamp: Date.now()
	};

	return {
		wrongVerb: newWrongVerb,
		wrongTense: newWrongTense,
		wrongPerson: newWrongPerson,
		correctCounts: newCorrectCounts,
		history: [newHistory, ...session.history]
	};
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface CoverageStats {
	numerator: number;
	denominator: number;
}

/**
 * Coverage = cards with ≥1 correct answer / total possible cards
 */
export function getCoverage(
	correctCounts: Record<string, number>,
	selectedVerbs: string[],
	selectedTenses: string[]
): CoverageStats {
	const denominator = selectedVerbs.length * selectedTenses.length * 6;
	let numerator = 0;

	for (const verb of selectedVerbs) {
		for (const tense of selectedTenses) {
			for (const person of PERSON_LABELS) {
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
