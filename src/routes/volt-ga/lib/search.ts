import type { Session } from './timeline';

export interface SearchResult {
	session: Session;
	field: 'title' | 'description' | 'speaker';
}

/** Search sessions by query, matching title, description, and speaker names */
export function searchSessions(query: string, sessions: Session[]): SearchResult[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const results: SearchResult[] = [];
	const seen = new Set<string>();

	for (const session of sessions) {
		// Match title
		if (session.title.toLowerCase().includes(q)) {
			if (!seen.has(session.id)) {
				results.push({ session, field: 'title' });
				seen.add(session.id);
			}
		}
		// Match description
		if (!seen.has(session.id) && session.description.toLowerCase().includes(q)) {
			results.push({ session, field: 'description' });
			seen.add(session.id);
		}
		// Match speaker names
		if (!seen.has(session.id)) {
			for (const speaker of session.speakers) {
				if (speaker.name.toLowerCase().includes(q)) {
					results.push({ session, field: 'speaker' });
					seen.add(session.id);
					break;
				}
			}
		}
	}

	return results;
}
