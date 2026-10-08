import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	loadFavorites,
	parseUrlFavorites,
	resolveShared,
	saveFavorites,
	syncFavorites,
	toggleFavorite,
	updateUrlFavorites
} from './favorites';

vi.mock('$app/navigation', () => ({
	replaceState: vi.fn((url: string | URL) => {
		href = url.toString();
	})
}));

const KEY = 'volt-ga-favorites';
let store: Map<string, string>;
let href: string;

beforeEach(() => {
	store = new Map();
	href = 'https://tools.test/volt-ga';
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v)
	});
	vi.stubGlobal('window', {
		get location() {
			const u = new URL(href);
			return { href: u.toString(), search: u.search };
		}
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('toggleFavorite', () => {
	it('adds a missing id and removes a present one without mutating the input', () => {
		const current = ['a'];
		expect(toggleFavorite('b', current)).toEqual(['a', 'b']);
		expect(toggleFavorite('a', current)).toEqual([]);
		expect(current).toEqual(['a']);
	});
});

describe('loadFavorites / saveFavorites', () => {
	it('round-trips through localStorage', () => {
		saveFavorites(['x', 'y']);
		expect(loadFavorites()).toEqual(['x', 'y']);
	});

	it('returns [] for missing, corrupt or non-array data and drops non-strings', () => {
		expect(loadFavorites()).toEqual([]);
		store.set(KEY, '{not json');
		expect(loadFavorites()).toEqual([]);
		store.set(KEY, '{"a":1}');
		expect(loadFavorites()).toEqual([]);
		store.set(KEY, '["a",1,null,"b"]');
		expect(loadFavorites()).toEqual(['a', 'b']);
	});

	it('swallows storage errors', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('quota');
			}
		});
		expect(() => saveFavorites(['a'])).not.toThrow();
		expect(loadFavorites()).toEqual([]);
	});
});

describe('URL favorites', () => {
	it('parses ?sessions= as trimmed, non-empty ids, or null when absent', () => {
		expect(parseUrlFavorites()).toBeNull();
		href = 'https://tools.test/volt-ga?sessions=a,%20b,,c';
		expect(parseUrlFavorites()).toEqual(['a', 'b', 'c']);
	});

	it('drops unknown and duplicate ids from the URL', () => {
		href = 'https://tools.test/volt-ga?sessions=a,bogus,a,b';
		expect(parseUrlFavorites(new Set(['a', 'b']))).toEqual(['a', 'b']);
	});

	it('loads stored favorites when there is no shared link', () => {
		store.set(KEY, '["stored"]');
		expect(syncFavorites()).toEqual({ favorites: ['stored'], shared: null });
	});

	it('never overwrites stored favorites with a shared link', () => {
		store.set(KEY, '["mine"]');
		href = 'https://tools.test/volt-ga?sessions=theirs';
		expect(syncFavorites()).toEqual({ favorites: ['mine'], shared: ['theirs'] });
		expect(store.get(KEY)).toBe('["mine"]');
	});

	it('adopts a shared link silently when the user has no favorites', () => {
		href = 'https://tools.test/volt-ga?sessions=theirs';
		expect(syncFavorites()).toEqual({ favorites: ['theirs'], shared: null });
		expect(store.get(KEY)).toBe('["theirs"]');
	});

	it('does not prompt when the link holds the same set as storage (own link reload)', () => {
		store.set(KEY, '["a","b"]');
		href = 'https://tools.test/volt-ga?sessions=b,a';
		expect(syncFavorites()).toEqual({ favorites: ['a', 'b'], shared: null });
	});

	it('filters stored and shared ids against the known sessions', () => {
		const valid = new Set(['a', 'b']);
		store.set(KEY, '["a","gone"]');
		href = 'https://tools.test/volt-ga?sessions=b,bogus';
		expect(syncFavorites(valid)).toEqual({ favorites: ['a'], shared: ['b'] });
		href = 'https://tools.test/volt-ga?sessions=bogus';
		expect(syncFavorites(valid)).toEqual({ favorites: ['a'], shared: null });
	});

	it('merges, replaces or keeps on the user decision', () => {
		expect(resolveShared(['a', 'b'], ['b', 'c'], 'merge')).toEqual(['a', 'b', 'c']);
		expect(resolveShared(['a', 'b'], ['b', 'c'], 'replace')).toEqual(['b', 'c']);
		expect(resolveShared(['a', 'b'], ['b', 'c'], 'keep')).toEqual(['a', 'b']);
	});

	it('writes ids to the URL and removes the param when empty', () => {
		updateUrlFavorites(['a', 'b']);
		expect(new URL(href).searchParams.get('sessions')).toBe('a,b');
		updateUrlFavorites([]);
		expect(new URL(href).searchParams.has('sessions')).toBe(false);
	});
});
