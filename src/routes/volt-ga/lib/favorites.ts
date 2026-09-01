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

/** Parse favorites from URL ?sessions=id1,id2,... */
export function parseUrlFavorites(): string[] | null {
	const params = new URLSearchParams(window.location.search);
	const raw = params.get('sessions');
	if (!raw) return null;
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Sync favorites on startup: URL params take priority */
export function syncFavorites(): string[] {
	const urlFavs = parseUrlFavorites();
	if (urlFavs) {
		saveFavorites(urlFavs);
		return urlFavs;
	}
	return loadFavorites();
}

/** Update URL with current favorites (no page reload) */
export function updateUrlFavorites(ids: string[]): void {
	const url = new URL(window.location.href);
	if (ids.length > 0) {
		url.searchParams.set('sessions', ids.join(','));
	} else {
		url.searchParams.delete('sessions');
	}
	window.history.replaceState({}, '', url.toString());
}

/** Toggle a session in the favorites list */
export function toggleFavorite(id: string, current: string[]): string[] {
	const idx = current.indexOf(id);
	if (idx >= 0) {
		return current.filter((i) => i !== id);
	}
	return [...current, id];
}
