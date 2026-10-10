import type { Session } from './timeline';

export interface SearchResult {
	session: Session;
	field: 'title' | 'description' | 'speaker' | 'moderator';
}

/** Lower-case and strip diacritics so "Schaffer", "Schäffer" (NFC) and its NFD form compare equal */
export function foldText(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Search sessions by title, description, speaker and moderator names, ignoring case and
 * diacritics. Each session appears once, tagged with its first matching field, and
 * results are ordered by start time.
 */
export function searchSessions(query: string, sessions: Session[]): SearchResult[] {
	const q = foldText(query.trim());
	if (!q) return [];
	const matches = (text: string) => foldText(text).includes(q);
	const results: SearchResult[] = [];

	for (const session of sessions) {
		let field: SearchResult['field'] | null = null;
		if (matches(session.title)) field = 'title';
		else if (matches(session.description)) field = 'description';
		else if (session.speakers.some((s) => matches(s.name))) field = 'speaker';
		else if (session.moderators.some(matches)) field = 'moderator';
		if (field) results.push({ session, field });
	}

	return results.sort(
		(a, b) => new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime()
	);
}
