import { describe, it, expect } from 'vitest';
import { italianModule } from '$lib/data/italian-conjugations';
import { buildConjugationMap } from '$lib/data/italian-conjugations';
import {
	buildPool,
	selectCard,
	validateAnswer,
	processAnswer,
	getCoverage,
	getAccuracy,
	createFreshSession,
	cardKey,
	type SessionState,
	type Card
} from '$lib/verbs';

const conjugationMap = italianModule.conjugationMap;
const PERSON_LABELS = italianModule.PERSON_LABELS;
const extractConjugation = italianModule.extractConjugation;

describe('buildConjugationMap', () => {
	it('creates map with all 30 verbs × 21 tenses × 6 persons = 3780 entries', () => {
		const map = buildConjugationMap();
		expect(map.size).toBe(3780);
	});

	it('contains correct conjugation for essere indicativo presente io', () => {
		const entry = conjugationMap.get('essere:indicativo presente:io');
		expect(entry).toBeDefined();
		expect(entry!.conjugation).toBe('sono');
		expect(entry!.translation).toBe('I am');
	});

	it('contains correct conjugation for fare futuro semplice loro', () => {
		const entry = conjugationMap.get('fare:futuro semplice:loro');
		expect(entry).toBeDefined();
		expect(entry!.conjugation).toBe('faranno');
	});

	it('contains accented characters correctly', () => {
		const entry = conjugationMap.get('essere:indicativo presente:lui/lei');
		expect(entry!.conjugation).toBe('è');
	});
});

describe('buildPool', () => {
	it('returns correct number of cards for 1 verb × 1 tense', () => {
		const pool = buildPool(['essere'], ['presente'], {}, italianModule);
		expect(pool).toHaveLength(6);
	});

	it('returns correct number of cards for 2 verbs × 2 tenses', () => {
		const pool = buildPool(
			['essere', 'avere'],
			['presente', 'futuro semplice'],
			{},
			italianModule
		);
		expect(pool).toHaveLength(2 * 2 * 6); // 24
	});

	it('removes cards that have been answered correctly 2 times', () => {
		const correctCounts: Record<string, number> = {
			'essere:presente:io': 2,
			'essere:presente:tu': 1
		};
		const pool = buildPool(['essere'], ['presente'], correctCounts, italianModule);
		expect(pool).toHaveLength(5); // io removed (2 corrects), tu kept (1 correct)
		expect(
			pool.find(
				(c: Card) => c.verb === 'essere' && c.tense === 'presente' && c.personIndex === 0
			)
		).toBeUndefined();
		expect(
			pool.find(
				(c: Card) => c.verb === 'essere' && c.tense === 'presente' && c.personIndex === 1
			)
		).toBeDefined();
	});

	it('returns empty pool for empty verbs', () => {
		expect(buildPool([], ['presente'], {}, italianModule)).toHaveLength(0);
	});

	it('returns empty pool for empty tenses', () => {
		expect(buildPool(['essere'], [], {}, italianModule)).toHaveLength(0);
	});
});

describe('selectCard', () => {
	it('returns null for empty pool', () => {
		const session = createFreshSession();
		expect(selectCard([], session, italianModule)).toBeNull();
	});

	it('returns a card from the pool', () => {
		const pool = buildPool(['essere'], ['presente'], {}, italianModule);
		const session = createFreshSession();
		const card = selectCard(pool, session, italianModule);
		expect(card).toBeDefined();
		expect(pool).toContainEqual(card);
	});

	it('returns a valid card with all expected fields', () => {
		const pool = buildPool(['avere'], ['passato prossimo'], {}, italianModule);
		const session = createFreshSession();
		const card = selectCard(pool, session, italianModule)!;
		expect(card.verb).toBe('avere');
		expect(card.tense).toBe('passato prossimo');
		expect(card.personIndex).toBeGreaterThanOrEqual(0);
		expect(card.personIndex).toBeLessThan(6);
	});

	it('biased weights produce different distributions (statistical)', () => {
		// With wrongVerb['essere'] = 10, essere cards should be heavily favored
		const verbs = ['essere', 'avere'];
		const pool = buildPool(verbs, ['presente'], {}, italianModule);
		const session: SessionState = {
			...createFreshSession(),
			wrongVerb: { essere: 10, avere: 0 }
		};

		// Weight for essere: (2+10) * 2 * 2 = 48
		// Weight for avere: (2+0) * 2 * 2 = 8
		// Draw 100 cards, expect most to be essere
		let essereCount = 0;
		for (let i = 0; i < 100; i++) {
			const card = selectCard(pool, session, italianModule);
			if (card?.verb === 'essere') essereCount++;
		}
		expect(essereCount).toBeGreaterThan(60);
	});
});

describe('extractConjugation', () => {
	it('extracts basic conjugation', () => {
		expect(extractConjugation('io vado', 'io')).toBe('vado');
	});

	it('handles lui/lei label', () => {
		expect(extractConjugation('lui/lei va', 'lui/lei')).toBe('va');
	});

	it('handles alternative lui lei format', () => {
		expect(extractConjugation('lui lei va', 'lui/lei')).toBe('va');
	});

	it('accepts "lei" as alternative for "lui/lei"', () => {
		expect(extractConjugation('lei va', 'lui/lei')).toBe('va');
		expect(extractConjugation('lei è', 'lui/lei')).toBe('è');
	});

	it('accepts "lui" as alternative for "lui/lei"', () => {
		expect(extractConjugation('lui va', 'lui/lei')).toBe('va');
		expect(extractConjugation('lui è', 'lui/lei')).toBe('è');
	});

	it('returns null for mismatched person label', () => {
		expect(extractConjugation('tu vado', 'io')).toBeNull();
	});

	it('returns empty string for label-only input', () => {
		expect(extractConjugation('io', 'io')).toBe('');
	});

	it('trims whitespace and lowercases', () => {
		expect(extractConjugation('  IO VADO  ', 'io')).toBe('vado');
	});

	it('handles multi-word conjugations (passato prossimo)', () => {
		expect(extractConjugation('io ho fatto', 'io')).toBe('ho fatto');
	});
});

describe('validateAnswer', () => {
	it('returns true for correct answer', () => {
		expect(
			validateAnswer(
				'io sono',
				'essere',
				'indicativo presente',
				'io',
				italianModule
			)
		).toBe(true);
	});

	it('returns true ignoring case', () => {
		expect(
			validateAnswer(
				'IO SONO',
				'essere',
				'indicativo presente',
				'io',
				italianModule
			)
		).toBe(true);
	});

	it('returns false for wrong conjugation', () => {
		expect(
			validateAnswer('io sei', 'essere', 'indicativo presente', 'io', italianModule)
		).toBe(false);
	});

	it('returns false for wrong person label', () => {
		expect(
			validateAnswer('tu sono', 'essere', 'indicativo presente', 'io', italianModule)
		).toBe(false);
	});

	it('returns false for empty input', () => {
		expect(
			validateAnswer('', 'essere', 'indicativo presente', 'io', italianModule)
		).toBe(false);
	});

	it('validates passato prossimo correctly', () => {
		expect(
			validateAnswer('ho fatto', 'fare', 'passato prossimo', 'io', italianModule)
		).toBe(false);
		expect(
			validateAnswer('io ho fatto', 'fare', 'passato prossimo', 'io', italianModule)
		).toBe(true);
	});

	it('validates accented characters strictly', () => {
		// è is correct, e is wrong
		expect(
			validateAnswer(
				'lui/lei è',
				'essere',
				'indicativo presente',
				'lui/lei',
				italianModule
			)
		).toBe(true);
		expect(
			validateAnswer(
				'lui/lei e',
				'essere',
				'indicativo presente',
				'lui/lei',
				italianModule
			)
		).toBe(false);
	});
});

describe('processAnswer', () => {
	it('increments correctCounts on correct answer', () => {
		const session = createFreshSession();
		const card = { verb: 'essere', tense: 'indicativo presente', personIndex: 0 };
		const newSession = processAnswer(
			session,
			card,
			'io sono',
			true,
			'sono',
			'I am',
			italianModule
		);
		expect(newSession.correctCounts['essere:indicativo presente:io']).toBe(1);
		expect(newSession.history).toHaveLength(1);
		expect(newSession.history[0].isCorrect).toBe(true);
	});

	it('increments wrong counters on incorrect answer', () => {
		const session = createFreshSession();
		const card = { verb: 'essere', tense: 'indicativo presente', personIndex: 1 };
		const newSession = processAnswer(
			session,
			card,
			'tu sei',
			false,
			'sei',
			'you are',
			italianModule
		);
		expect(newSession.wrongVerb['essere']).toBe(1);
		expect(newSession.wrongTense['indicativo presente']).toBe(1);
		expect(newSession.wrongPerson['tu']).toBe(1);
	});

	it('reaches 2 correct and triggers removal threshold', () => {
		const session = createFreshSession();
		const card = { verb: 'essere', tense: 'indicativo presente', personIndex: 0 };

		const s1 = processAnswer(
			session,
			card,
			'io sono',
			true,
			'sono',
			'I am',
			italianModule
		);
		expect(s1.correctCounts['essere:indicativo presente:io']).toBe(1);

		const s2 = processAnswer(
			s1,
			card,
			'io sono',
			true,
			'sono',
			'I am',
			italianModule
		);
		expect(s2.correctCounts['essere:indicativo presente:io']).toBe(2);

		// Card should now be filtered out by buildPool
		const pool = buildPool(['essere'], ['indicativo presente'], s2.correctCounts, italianModule);
		expect(
			pool.find(
				(c: Card) =>
					c.verb === 'essere' && c.tense === 'indicativo presente' && c.personIndex === 0
			)
		).toBeUndefined();
	});

	it('prepends new history entries', () => {
		const session = createFreshSession();
		const card = { verb: 'essere', tense: 'indicativo presente', personIndex: 0 };

		const s1 = processAnswer(
			session,
			card,
			'io sono',
			true,
			'sono',
			'I am',
			italianModule
		);
		const s2 = processAnswer(
			s1,
			card,
			'io sono',
			true,
			'sono',
			'I am',
			italianModule
		);

		expect(s2.history).toHaveLength(2);
		// Newest first
		expect(s2.history[0].timestamp).toBeGreaterThanOrEqual(s2.history[1].timestamp);
	});
});

describe('getCoverage', () => {
	it('returns 0/denominator when no cards answered', () => {
		const stats = getCoverage({}, ['essere', 'avere'], ['indicativo presente'], italianModule);
		expect(stats.numerator).toBe(0);
		expect(stats.denominator).toBe(2 * 1 * 6); // 2 verbs × 1 tense × 6 persons = 12
	});

	it('counts cards with ≥1 correct answer', () => {
		const correctCounts = {
			'essere:indicativo presente:io': 1,
			'essere:indicativo presente:tu': 2,
			'avere:indicativo presente:noi': 1
		};
		const stats = getCoverage(
			correctCounts,
			['essere', 'avere'],
			['indicativo presente'],
			italianModule
		);
		expect(stats.numerator).toBe(3);
		expect(stats.denominator).toBe(12);
	});
});

describe('getAccuracy', () => {
	it('returns 0 for no history', () => {
		expect(getAccuracy([])).toBe(0);
	});

	it('returns 100 for all correct', () => {
		const history = [
			{ isCorrect: true } as any,
			{ isCorrect: true } as any
		];
		expect(getAccuracy(history)).toBe(100);
	});

	it('returns 50 for half correct', () => {
		const history = [
			{ isCorrect: true } as any,
			{ isCorrect: false } as any
		];
		expect(getAccuracy(history)).toBe(50);
	});
});

describe('createFreshSession', () => {
	it('returns empty session state', () => {
		const session = createFreshSession();
		expect(session.wrongVerb).toEqual({});
		expect(session.wrongTense).toEqual({});
		expect(session.wrongPerson).toEqual({});
		expect(session.correctCounts).toEqual({});
		expect(session.history).toEqual([]);
	});
});
