import { describe, it, expect } from 'vitest';
import { searchSessions } from './search';
import type { Session } from './timeline';

function session(id: string, fields: Partial<Session>): Session {
	return {
		id,
		day: 'saturday',
		room: 'Sala 1',
		title: '',
		startTime: '2026-06-13T09:00:00+02:00',
		endTime: '2026-06-13T10:00:00+02:00',
		description: '',
		speakers: [],
		moderator: null,
		type: 'session',
		...fields
	};
}

const sessions = [
	session('t', { title: 'Climate Policy Workshop', description: 'climate everywhere' }),
	session('d', { title: 'Opening', description: 'A talk on housing policy' }),
	session('s', {
		title: 'Panel',
		speakers: [
			{ name: 'Ana Gomes', type: 'external' },
			{ name: 'Ana Policyova', type: 'internal' }
		]
	})
];

describe('searchSessions', () => {
	it('returns nothing for an empty or whitespace query', () => {
		expect(searchSessions('', sessions)).toEqual([]);
		expect(searchSessions('   ', sessions)).toEqual([]);
	});

	it('matches case-insensitively and trims the query', () => {
		expect(searchSessions('  CLIMATE ', sessions).map((r) => r.session.id)).toEqual(['t']);
	});

	it('reports the first matching field: title, then description, then speaker', () => {
		const results = searchSessions('polic', sessions);
		expect(results.map((r) => [r.session.id, r.field])).toEqual([
			['t', 'title'],
			['d', 'description'],
			['s', 'speaker']
		]);
	});

	it('returns each session at most once', () => {
		const results = searchSessions('ana', sessions);
		expect(results.map((r) => r.session.id)).toEqual(['s']);
	});

	it.todo('matches moderators and ignores diacritics (mg-drp8.133)');
});
