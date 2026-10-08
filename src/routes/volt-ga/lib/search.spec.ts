import { describe, it, expect } from 'vitest';
import { foldText, searchSessions } from './search';
import events from '../data/events.json';
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
		moderators: [],
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

	it('matches moderators after the other fields', () => {
		const withMod = [
			...sessions,
			session('m', { title: 'Election', moderators: ['Chris Luth', 'Ana Other'] })
		];
		expect(searchSessions('luth', withMod).map((r) => [r.session.id, r.field])).toEqual([
			['m', 'moderator']
		]);
	});

	it('ignores diacritics and Unicode normalization form on both sides', () => {
		const nfc = 'Sch\u00e4ffer';
		const nfd = 'Scha\u0308ffer';
		const s = [session('x', { moderators: [nfc] }), session('y', { moderators: [nfd] })];
		for (const q of ['Schaffer', nfc, nfd, 'SCHÄFF']) {
			expect(
				searchSessions(q, s).map((r) => r.session.id),
				q
			).toEqual(['x', 'y']);
		}
		expect(foldText('Babitzov\u00e1')).toBe('babitzova');
	});

	it('orders results by start time, not data order', () => {
		const late = session('late', {
			title: 'Talk',
			startTime: '2026-06-13T11:00:00+02:00',
			endTime: '2026-06-13T12:00:00+02:00'
		});
		const early = session('early', { title: 'Talk' });
		expect(searchSessions('talk', [late, early]).map((r) => r.session.id)).toEqual([
			'early',
			'late'
		]);
	});

	it('finds every session Chris Luth moderates in the bundled data', () => {
		const ids = searchSessions('chris', events as Session[]).map((r) => r.session.id);
		expect(ids).toEqual([
			'election-of-the-board-iac-candidates',
			'election-of-our-co-presidents',
			'election-of-a-treasurer',
			'election-of-the-non-executive-board-members'
		]);
	});
});
