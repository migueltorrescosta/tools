import { describe, it, expect } from 'vitest';
import { createPersistGate } from '$lib/persist-gate';
import { createFreshSession, type SessionState } from '$lib/verbs';
import { languageStorageKeys, loadLanguageState } from '$lib/verbs-storage';

function memoryStorage(entries: Record<string, string> = {}) {
	const data = new Map(Object.entries(entries));
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value)
	};
}

describe('createPersistGate', () => {
	it('drops writes until opened', () => {
		const storage = memoryStorage();
		const gate = createPersistGate(storage);
		expect(gate.isOpen).toBe(false);
		gate.write('k', 'before');
		expect(storage.data.has('k')).toBe(false);
		gate.open();
		expect(gate.isOpen).toBe(true);
		gate.write('k', 'after');
		expect(storage.data.get('k')).toBe('after');
	});

	it('drops every write without storage', () => {
		const gate = createPersistGate(null);
		gate.open();
		expect(() => gate.write('k', 'v')).not.toThrow();
	});

	it('keeps a saved verb-conjugator session when the persistence effect fires before onMount', () => {
		// Regression (mg-drp8.110): the session effect wrote a fresh session over the
		// saved one before onMount loaded it.
		const keys = languageStorageKeys('italian');
		const saved: SessionState = {
			...createFreshSession(),
			correctCounts: { 'essere:presente:io': 1 }
		};
		const storage = memoryStorage({ [keys.session]: JSON.stringify(saved) });
		const gate = createPersistGate(storage);

		// Page order: the $effect runs first with the initial fresh session...
		gate.write(keys.session, JSON.stringify(createFreshSession()));
		// ...then onMount restores and opens the gate.
		const state = loadLanguageState('italian', storage);
		gate.open();
		expect(state.session).toEqual(saved);

		// The effect re-runs with the restored session.
		gate.write(keys.session, JSON.stringify(state.session));
		expect(JSON.parse(storage.data.get(keys.session)!)).toEqual(saved);
	});
});
