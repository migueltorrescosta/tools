import { describe, it, expect } from 'vitest';
import { italianModule, spanishModule } from '$lib/data/language-registry';
import { createFreshSession, type SessionState } from '$lib/verbs';
import { languageStorageKeys, loadLanguageState } from '$lib/verbs-storage';

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
	correctCounts: { 'essere:presente:io': 1 },
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
			[keys.tenses]: JSON.stringify(['presente']),
			[keys.session]: JSON.stringify(savedSession)
		});
		const state = loadLanguageState('italian', storage);
		expect(state.verbs).toEqual(['essere']);
		expect(state.tenses).toEqual(['presente']);
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
