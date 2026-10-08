import { describe, it, expect } from 'vitest';
import { italianModule, spanishModule } from '$lib/data/language-registry';
import {
	HISTORY_LIMIT,
	createFreshSession,
	type HistoryEntry,
	type SessionState
} from '$lib/verbs';
import {
	LANGUAGE_STORAGE_KEY,
	languageStorageKeys,
	loadLanguageState,
	loadSelectedLanguage,
	parseSession
} from '$lib/verbs-storage';

function memoryStorage(entries: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(entries));
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key) => data.get(key) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (key) => void data.delete(key),
		setItem: (key, value) => void data.set(key, value)
	};
}

const savedSession: SessionState = {
	...createFreshSession(),
	correctCounts: { 'essere:indicativo presente:io': 1 },
	wrongVerb: { avere: 2 }
};

describe('languageStorageKeys', () => {
	it('namespaces every key by language', () => {
		expect(languageStorageKeys('italian')).toEqual({
			verbs: 'italian-verbs-selected',
			tenses: 'italian-verbs-tenses',
			session: 'italian-verbs-session'
		});
	});
});

describe('loadLanguageState', () => {
	it('throws for an unknown language', () => {
		expect(() => loadLanguageState('klingon', memoryStorage())).toThrow(/Unknown language/);
	});

	it('returns defaults and a fresh session without storage', () => {
		const state = loadLanguageState('italian', null);
		expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
		expect(state.tenses).toEqual(italianModule.DEFAULT_TENSES);
		expect(state.session).toEqual(createFreshSession());
	});

	it('returns copies of the defaults, not the module arrays', () => {
		const state = loadLanguageState('italian', memoryStorage());
		expect(state.verbs).not.toBe(italianModule.DEFAULT_VERBS);
		expect(state.tenses).not.toBe(italianModule.DEFAULT_TENSES);
	});

	it('returns defaults when storage is empty', () => {
		const state = loadLanguageState('italian', memoryStorage());
		expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
		expect(state.tenses).toEqual(italianModule.DEFAULT_TENSES);
		expect(state.session).toEqual(createFreshSession());
	});

	it('restores saved verbs, tenses and session', () => {
		const keys = languageStorageKeys('italian');
		const storage = memoryStorage({
			[keys.verbs]: JSON.stringify(['essere']),
			[keys.tenses]: JSON.stringify(['indicativo presente']),
			[keys.session]: JSON.stringify(savedSession)
		});
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(['essere']);
		expect(state.tenses).toEqual(['indicativo presente']);
		expect(state.session).toEqual(savedSession);
	});

	it('falls back to defaults for empty saved selections', () => {
		const keys = languageStorageKeys('italian');
		const storage = memoryStorage({ [keys.verbs]: '[]', [keys.tenses]: '[]' });
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
		expect(state.tenses).toEqual(italianModule.DEFAULT_TENSES);
	});

	it('falls back to a fresh session when the saved one is not JSON', () => {
		const keys = languageStorageKeys('italian');
		const storage = memoryStorage({ [keys.session]: '{not json' });
		expect(loadLanguageState('italian', storage).session).toEqual(createFreshSession());
	});

	it('keeps languages isolated', () => {
		const italianKeys = languageStorageKeys('italian');
		const storage = memoryStorage({
			[italianKeys.verbs]: JSON.stringify(['essere']),
			[italianKeys.session]: JSON.stringify(savedSession)
		});
		const spanish = loadLanguageState('spanish', storage);
		expect(spanish.verbs).toEqual(spanishModule.DEFAULT_VERBS);
		expect(spanish.session).toEqual(createFreshSession());
		expect(loadLanguageState('italian', storage).session).toEqual(savedSession);
	});
});

describe('loadLanguageState stale selections', () => {
	const keys = languageStorageKeys('italian');

	it('drops verbs and tenses that no longer exist', () => {
		const storage = memoryStorage({
			[keys.verbs]: JSON.stringify(['essere', 'ghostverb', 'essere']),
			[keys.tenses]: JSON.stringify(['presente', 'imperfetto'])
		});
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(['essere']);
		expect(state.tenses).toEqual(['imperfetto']);
	});

	it('falls back to defaults when nothing saved is still valid', () => {
		const storage = memoryStorage({
			[keys.verbs]: JSON.stringify(['ghostverb']),
			[keys.tenses]: JSON.stringify(['presente'])
		});
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
		expect(state.tenses).toEqual(italianModule.DEFAULT_TENSES);
	});
});

describe('loadLanguageState corrupt storage', () => {
	const keys = languageStorageKeys('italian');

	it.each(['{not json', '"essere"', '{"a":1}', 'null', '[1, 2]'])(
		'falls back to defaults for saved selections %s',
		(raw) => {
			const storage = memoryStorage({ [keys.verbs]: raw, [keys.tenses]: raw });
			const state = loadLanguageState('italian', storage);
			expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
			expect(state.tenses).toEqual(italianModule.DEFAULT_TENSES);
		}
	);

	it('treats a throwing storage as empty', () => {
		const storage = {
			getItem: () => {
				throw new DOMException('denied', 'SecurityError');
			}
		};
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(italianModule.DEFAULT_VERBS);
		expect(state.session).toEqual(createFreshSession());
	});
});

describe('parseSession', () => {
	const entry: HistoryEntry = {
		verb: 'essere',
		tense: 'indicativo presente',
		person: 'io',
		translation: 'I am',
		userAnswer: 'io sono',
		correctAnswer: 'sono',
		isCorrect: true,
		timestamp: 1,
		diff: [{ type: 'same', text: 'sono' }]
	};

	it.each([null, '{not json', '[]', '42', 'null'])('returns a fresh session for %s', (raw) => {
		expect(parseSession(raw)).toEqual(createFreshSession());
	});

	it('fills fields missing from an older schema', () => {
		const session = parseSession(JSON.stringify({ correctCounts: { 'essere:imperfetto:io': 1 } }));
		expect(session).toEqual({
			...createFreshSession(),
			correctCounts: { 'essere:imperfetto:io': 1 }
		});
		expect(session.wrongPerson).toEqual({});
	});

	it('drops non-numeric counts and malformed history entries', () => {
		const session = parseSession(
			JSON.stringify({
				wrongVerb: { essere: 2, avere: 'x', fare: null },
				wrongTense: [],
				history: [entry, { verb: 'essere' }, 'junk', { ...entry, diff: [{ type: 'x' }] }]
			})
		);
		expect(session.wrongVerb).toEqual({ essere: 2 });
		expect(session.wrongTense).toEqual({});
		expect(session.history).toEqual([entry]);
	});

	it(`caps history at ${HISTORY_LIMIT} entries`, () => {
		const history = Array.from({ length: HISTORY_LIMIT + 50 }, (_, i) => ({
			...entry,
			timestamp: i
		}));
		const session = parseSession(JSON.stringify({ history }));
		expect(session.history).toHaveLength(HISTORY_LIMIT);
		expect(session.history[0].timestamp).toBe(0);
	});
});

describe('loadSelectedLanguage', () => {
	it('defaults to the first registered language', () => {
		expect(loadSelectedLanguage(null)).toBe('italian');
		expect(loadSelectedLanguage(memoryStorage())).toBe('italian');
	});

	it('restores a saved language', () => {
		const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'portuguese' });
		expect(loadSelectedLanguage(storage)).toBe('portuguese');
	});

	it('ignores an unknown saved language', () => {
		const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'klingon' });
		expect(loadSelectedLanguage(storage, 'spanish')).toBe('spanish');
	});
});
