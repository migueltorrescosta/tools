import { LANGUAGE_REGISTRY, getLanguage } from '$lib/data/language-registry';
import {
	HISTORY_LIMIT,
	createFreshSession,
	type HistoryEntry,
	type SessionState
} from '$lib/verbs';

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

/** localStorage key for the last selected language id. */
export const LANGUAGE_STORAGE_KEY = 'verbs-language';

/** localStorage keys for one language's selection and session. */
export function languageStorageKeys(langId: string): LanguageStorageKeys {
	return {
		verbs: `${langId}-verbs-selected`,
		tenses: `${langId}-verbs-tenses`,
		session: `${langId}-verbs-session`
	};
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

/** getItem that treats a throwing storage (blocked, sandboxed) as empty. */
function safeGet(storage: ReadableStorage, key: string): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function safeParse(raw: string | null): unknown {
	if (raw === null) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep the saved names that still exist in `known`, in order, without
 * duplicates. Falls back to `defaults` when nothing valid remains, so renamed
 * or removed verbs/tenses never produce unanswerable cards.
 */
function parseSelection(
	raw: string | null,
	known: readonly string[],
	defaults: string[]
): string[] {
	const parsed = safeParse(raw);
	const valid = Array.isArray(parsed)
		? [...new Set(parsed.filter((v): v is string => typeof v === 'string' && known.includes(v)))]
		: [];
	return valid.length > 0 ? valid : [...defaults];
}

function parseCounts(value: unknown): Record<string, number> {
	if (!isRecord(value)) return {};
	const counts: Record<string, number> = {};
	for (const [key, n] of Object.entries(value)) {
		if (typeof n === 'number' && Number.isFinite(n) && n >= 0) counts[key] = n;
	}
	return counts;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
	if (!isRecord(value)) return false;
	return (
		typeof value.verb === 'string' &&
		typeof value.tense === 'string' &&
		typeof value.person === 'string' &&
		typeof value.translation === 'string' &&
		typeof value.userAnswer === 'string' &&
		typeof value.correctAnswer === 'string' &&
		typeof value.isCorrect === 'boolean' &&
		typeof value.timestamp === 'number' &&
		Array.isArray(value.diff) &&
		value.diff.every(
			(seg) =>
				isRecord(seg) &&
				(seg.type === 'same' || seg.type === 'delete' || seg.type === 'insert') &&
				typeof seg.text === 'string'
		)
	);
}

/**
 * Rebuild a session from untrusted JSON: every field falls back to the fresh
 * default when missing or malformed, and history is capped at HISTORY_LIMIT.
 */
export function parseSession(raw: string | null): SessionState {
	const parsed = safeParse(raw);
	if (!isRecord(parsed)) return createFreshSession();
	return {
		wrongVerb: parseCounts(parsed.wrongVerb),
		wrongTense: parseCounts(parsed.wrongTense),
		wrongPerson: parseCounts(parsed.wrongPerson),
		correctCounts: parseCounts(parsed.correctCounts),
		history: Array.isArray(parsed.history)
			? parsed.history.filter(isHistoryEntry).slice(0, HISTORY_LIMIT)
			: []
	};
}

// ─── Load ────────────────────────────────────────────────────────────────────

/**
 * Load the last selected language id, falling back to `fallback` when
 * nothing (or an unknown id) is stored.
 */
export function loadSelectedLanguage(
	storage: ReadableStorage | null,
	fallback: string = LANGUAGE_REGISTRY[0].id
): string {
	if (!storage) return fallback;
	const saved = safeGet(storage, LANGUAGE_STORAGE_KEY);
	return saved !== null && getLanguage(saved) ? saved : fallback;
}

/**
 * Load a language's selected verbs, tenses and session from storage.
 * Pass `null` for storage outside the browser (prerender) to get defaults.
 * Saved selections are intersected with the language's verb/tense lists and
 * fall back to the defaults when empty; the session is validated field by
 * field. Nothing stored can make this throw.
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
	return {
		verbs: parseSelection(safeGet(storage, keys.verbs), module.VERB_LIST, module.DEFAULT_VERBS),
		tenses: parseSelection(safeGet(storage, keys.tenses), module.TENSE_LIST, module.DEFAULT_TENSES),
		session: parseSession(safeGet(storage, keys.session))
	};
}
