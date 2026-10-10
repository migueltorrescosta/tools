import { replaceState } from '$app/navigation';

const STORAGE_KEY = 'volt-ga-favorites';

/** Load favorites from localStorage */
export function loadFavorites(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
		return [];
	} catch {
		return [];
	}
}

/** Save favorites to localStorage */
export function saveFavorites(ids: string[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch {
		// localStorage may be full or unavailable
	}
}

/** Keep only ids present in validIds (when given), dropping duplicates, in first-seen order */
function cleanIds(ids: string[], validIds?: ReadonlySet<string>): string[] {
	return [...new Set(ids)].filter((id) => !validIds || validIds.has(id));
}

/** Parse favorites from URL ?sessions=id1,id2,...; unknown ids are dropped when validIds is given */
export function parseUrlFavorites(validIds?: ReadonlySet<string>): string[] | null {
	const params = new URLSearchParams(window.location.search);
	const raw = params.get('sessions');
	if (!raw) return null;
	return cleanIds(
		raw
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0),
		validIds
	);
}

export interface FavoritesSync {
	/** The user's own favorites, to display and persist */
	favorites: string[];
	/** A shared ?sessions= selection that differs from the user's own, awaiting a decision; null if none */
	shared: string[] | null;
}

function sameSet(a: string[], b: string[]): boolean {
	const set = new Set(a);
	return a.length === b.length && b.every((id) => set.has(id));
}

/**
 * Resolve favorites on startup without clobbering the user's own list.
 * A shared link is adopted directly only when the user has no favorites of their own;
 * otherwise it is returned as `shared` so the user can merge, replace or ignore it.
 */
export function syncFavorites(validIds?: ReadonlySet<string>): FavoritesSync {
	const own = cleanIds(loadFavorites(), validIds);
	const urlFavs = parseUrlFavorites(validIds);
	if (!urlFavs || urlFavs.length === 0 || sameSet(own, urlFavs)) {
		return { favorites: own, shared: null };
	}
	if (own.length === 0) {
		saveFavorites(urlFavs);
		return { favorites: urlFavs, shared: null };
	}
	return { favorites: own, shared: urlFavs };
}

export type SharedChoice = 'merge' | 'replace' | 'keep';

/** Apply the user's decision about a shared selection to their own favorites */
export function resolveShared(own: string[], shared: string[], choice: SharedChoice): string[] {
	if (choice === 'replace') return [...shared];
	if (choice === 'merge') return cleanIds([...own, ...shared]);
	return [...own];
}

/** Update URL with current favorites (no page reload), through the SvelteKit router */
export function updateUrlFavorites(ids: string[]): void {
	const url = new URL(window.location.href);
	if (ids.length > 0) {
		url.searchParams.set('sessions', ids.join(','));
	} else {
		url.searchParams.delete('sessions');
	}
	replaceState(url, {});
}

/** Toggle a session in the favorites list */
export function toggleFavorite(id: string, current: string[]): string[] {
	const idx = current.indexOf(id);
	if (idx >= 0) {
		return current.filter((i) => i !== id);
	}
	return [...current, id];
}
