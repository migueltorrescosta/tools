import { describe, it, expect, vi, afterEach } from 'vitest';
import { browserStorage, clearSaved, createPersistGate, readJson } from '$lib/persist-gate';
import { createFreshSession, type SessionState } from '$lib/verbs';
import { languageStorageKeys, loadLanguageState } from '$lib/verbs-storage';

const env = vi.hoisted(() => ({ browser: true }));
vi.mock('$app/environment', () => ({
	get browser() {
		return env.browser;
	}
}));

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

describe('clearSaved and readJson', () => {
	function fullStorage(entries: Record<string, string>): Storage {
		const map = new Map(Object.entries(entries));
		return {
			get length() {
				return map.size;
			},
			key: (i) => [...map.keys()][i] ?? null,
			getItem: (k) => map.get(k) ?? null,
			setItem: (k, v) => void map.set(k, v),
			removeItem: (k) => void map.delete(k),
			clear: () => map.clear()
		};
	}

	it('clears only keys under the prefix', () => {
		const storage = fullStorage({ 'tool:settings': '{}', 'tool:front': '[]', 'other-tool': '[]' });
		clearSaved(storage, 'tool:');
		expect(storage.length).toBe(1);
		expect(storage.getItem('other-tool')).toBe('[]');
	});

	it('reads JSON, returning null when absent or corrupt', () => {
		const storage = fullStorage({ a: '{"x":1}', b: '{' });
		expect(readJson(storage, 'a')).toEqual({ x: 1 });
		expect(readJson(storage, 'b')).toBeNull();
		expect(readJson(storage, 'c')).toBeNull();
		expect(readJson(null, 'a')).toBeNull();
	});
});

describe('browserStorage', () => {
	const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
	function setLocalStorage(descriptor: PropertyDescriptor) {
		Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
	}
	afterEach(() => {
		env.browser = true;
		if (original) Object.defineProperty(globalThis, 'localStorage', original);
		else delete (globalThis as { localStorage?: Storage }).localStorage;
	});

	it('returns localStorage in the browser', () => {
		const storage = memoryStorage();
		setLocalStorage({ value: storage });
		expect(browserStorage()).toBe(storage);
	});

	it('returns null where reading localStorage throws (blocked storage)', () => {
		setLocalStorage({
			get() {
				throw new DOMException('denied', 'SecurityError');
			}
		});
		expect(browserStorage()).toBeNull();
	});

	it('returns null outside the browser', () => {
		env.browser = false;
		setLocalStorage({ value: memoryStorage() });
		expect(browserStorage()).toBeNull();
	});
});
