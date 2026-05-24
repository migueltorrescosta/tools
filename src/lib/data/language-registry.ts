// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConjugationEntry {
	verb: string;
	tense: string;
	person: string;
	conjugation: string;
	translation: string;
}

export type ConjugationMap = Map<string, ConjugationEntry>;

/** UI labels for the interface */
export interface UILabels {
	coverage: string;
	accuracy: string;
	conjugation: string;
	history: string;
	verb: string;
	tense: string;
}

export interface LanguageModule {
	/** Unique ID for localStorage keys, e.g. "italian" */
	id: string;
	/** Display flag emoji, e.g. "🇮🇹" */
	flag: string;
	/** English name, e.g. "Italian" */
	name: string;
	/** Native language name for button: "Italiano", "Español" */
	displayName: string;

	/** All available verbs */
	VERB_LIST: readonly string[];
	/** All available tenses */
	TENSE_LIST: readonly string[];
	/** Person labels (6 items) */
	PERSON_LABELS: readonly string[];

	/** The conjugation lookup map */
	conjugationMap: ConjugationMap;

	/** Default selected verbs */
	DEFAULT_VERBS: string[];
	/** Default selected tenses */
	DEFAULT_TENSES: string[];

	/** UI labels translated */
	ui: UILabels;

	/**
	 * Language-specific conjugation extraction from user input.
	 * E.g. for "lui/lei" accept "lui", "lei", or "lui/lei" prefix.
	 */
	extractConjugation(input: string, expectedPersonLabel: string): string | null;
}

// ─── Registry ────────────────────────────────────────────────────────────────

import { italianModule } from './italian-conjugations';
import { spanishModule } from './spanish-conjugations';
import { portugueseModule } from './portuguese-conjugations';

export { italianModule, spanishModule, portugueseModule };

export const LANGUAGE_REGISTRY: LanguageModule[] = [italianModule, spanishModule, portugueseModule];

export function getLanguage(id: string): LanguageModule | undefined {
	return LANGUAGE_REGISTRY.find((l) => l.id === id);
}
