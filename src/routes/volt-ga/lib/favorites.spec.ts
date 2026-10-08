import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	loadFavorites,
	parseUrlFavorites,
	saveFavorites,
	syncFavorites,
	toggleFavorite,
	updateUrlFavorites
} from './favorites';

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
		},
		history: {
			replaceState: (_: unknown, __: string, url: string) => {
				href = url;
			}
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

	it('gives URL favorites precedence over stored ones', () => {
		store.set(KEY, '["stored"]');
		expect(syncFavorites()).toEqual(['stored']);
		href = 'https://tools.test/volt-ga?sessions=shared';
		expect(syncFavorites()).toEqual(['shared']);
	});

	it('writes ids to the URL and removes the param when empty', () => {
		updateUrlFavorites(['a', 'b']);
		expect(new URL(href).searchParams.get('sessions')).toBe('a,b');
		updateUrlFavorites([]);
		expect(new URL(href).searchParams.has('sessions')).toBe(false);
	});
});
