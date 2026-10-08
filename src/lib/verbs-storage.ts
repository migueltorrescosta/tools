import { getLanguage } from '$lib/data/language-registry';
import { createFreshSession, type SessionState } from '$lib/verbs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LanguageState {
	verbs: string[];
	tenses: string[];
	session: SessionState;
}

/** The subset of the Web Storage API this module reads. */
export type ReadableStorage = Pick<Storage, 'getItem'>;

export interface LanguageStorageKeys {
	verbs: string;
	tenses: string;
	session: string;
}

// ─── Keys ────────────────────────────────────────────────────────────────────

/** localStorage keys for one language's selection and session. */
export function languageStorageKeys(langId: string): LanguageStorageKeys {
	return {
		verbs: `${langId}-verbs-selected`,
		tenses: `${langId}-verbs-tenses`,
		session: `${langId}-verbs-session`
	};
}

// ─── Load ────────────────────────────────────────────────────────────────────

/**
 * Load a language's selected verbs, tenses and session from storage.
 * Pass `null` for storage outside the browser (prerender) to get defaults.
 * Missing or empty selections fall back to the language defaults; a missing
 * or unparsable session falls back to a fresh one.
 */
export function loadLanguageState(langId: string, storage: ReadableStorage | null): LanguageState {
	const module = getLanguage(langId);
	if (!module) throw new Error(`Unknown language: ${langId}`);

	if (!storage) {
		return {
			verbs: [...module.DEFAULT_VERBS],
			tenses: [...module.DEFAULT_TENSES],
			session: createFreshSession()
		};
	}

	const keys = languageStorageKeys(langId);
	const savedVerbs = storage.getItem(keys.verbs);
	const savedTenses = storage.getItem(keys.tenses);
	const savedSession = storage.getItem(keys.session);

	const parsedVerbs: string[] = savedVerbs ? JSON.parse(savedVerbs) : [];
	const parsedTenses: string[] = savedTenses ? JSON.parse(savedTenses) : [];

	const verbs = parsedVerbs.length > 0 ? parsedVerbs : [...module.DEFAULT_VERBS];
	const tenses = parsedTenses.length > 0 ? parsedTenses : [...module.DEFAULT_TENSES];

	let session: SessionState;
	if (savedSession) {
		try {
			session = JSON.parse(savedSession) as SessionState;
		} catch {
			session = createFreshSession();
		}
	} else {
		session = createFreshSession();
	}

	return { verbs, tenses, session };
}
