import { describe, it, expect } from 'vitest';
import { portugueseModule, buildConjugationMap } from './portuguese-conjugations';
import { buildPool, validateAnswer } from '$lib/verbs';

const map = portugueseModule.conjugationMap;

describe('Portuguese conjugation map', () => {
	it('creates 2700 entries (30 × 15 × 6)', () => {
		expect(buildConjugationMap().size).toBe(2700);
	});

	it('has all 30 verbs', () => {
		const verbs = new Set([...map.keys()].map((k) => k.split(':')[0]));
		expect(verbs.size).toBe(30);
	});

	it('has all 15 tenses', () => {
		const tenses = new Set([...map.keys()].map((k) => k.split(':')[1]));
		expect(tenses.size).toBe(15);
	});

	// ── Irregular verbs spot checks ──
	const checks: [string, string, string, string][] = [
		['ser', 'presente do indicativo', 'eu', 'sou'],
		['ser', 'presente do indicativo', 'tu', 'és'],
		['ser', 'pretérito perfeito do indicativo', 'eu', 'fui'],
		['ser', 'pretérito imperfeito do indicativo', 'nós', 'éramos'],
		['ser', 'pretérito mais-que-perfeito do indicativo', 'eu', 'fora'],
		['ser', 'futuro do indicativo', 'eu', 'serei'],
		['ser', 'condicional', 'eu', 'seria'],
		['ser', 'presente do conjuntivo', 'eu', 'seja'],
		['ser', 'pretérito imperfeito do conjuntivo', 'eu', 'fosse'],
		['ser', 'futuro do conjuntivo', 'eu', 'for'],
		['ser', 'imperativo afirmativo', 'tu', 'sê'],
		['ser', 'imperativo negativo', 'tu', 'sejas'],
		['ser', 'infinitivo pessoal', 'eu', 'ser'],
		['ser', 'gerúndio', 'eu', 'sendo'],
		['ser', 'particípio passado', 'eu', 'sido'],
		['estar', 'presente do indicativo', 'eu', 'estou'],
		['estar', 'presente do conjuntivo', 'eu', 'esteja'],
		['ter', 'presente do indicativo', 'eu', 'tenho'],
		['ter', 'presente do indicativo', 'eles/elas/vocês', 'têm'],
		['ter', 'pretérito imperfeito do indicativo', 'eu', 'tinha'],
		['haver', 'presente do indicativo', 'eu', 'hei'],
		['haver', 'presente do indicativo', 'eles/elas/vocês', 'hão'],
		['fazer', 'presente do indicativo', 'eu', 'faço'],
		['fazer', 'futuro do indicativo', 'eu', 'farei'],
		['fazer', 'pretérito perfeito do indicativo', 'ele/ela/você', 'fez'],
		['ir', 'presente do indicativo', 'eu', 'vou'],
		['ir', 'presente do conjuntivo', 'nós', 'vamos'],
		['ir', 'pretérito imperfeito do indicativo', 'eu', 'ia'],
		['vir', 'presente do indicativo', 'eu', 'venho'],
		['vir', 'pretérito perfeito do indicativo', 'eu', 'vim'],
		['dizer', 'presente do indicativo', 'eu', 'digo'],
		['dizer', 'pretérito perfeito do indicativo', 'eu', 'disse'],
		['poder', 'presente do indicativo', 'eu', 'posso'],
		['poder', 'pretérito perfeito do indicativo', 'ele/ela/você', 'pôde'],
		['querer', 'presente do conjuntivo', 'nós', 'queiramos'],
		['saber', 'presente do indicativo', 'eu', 'sei'],
		['ver', 'presente do indicativo', 'eu', 'vejo'],
		['ver', 'presente do indicativo', 'eles/elas/vocês', 'veem'],
		['dar', 'presente do indicativo', 'eu', 'dou'],
		['dar', 'presente do conjuntivo', 'eles/elas/vocês', 'deem'],
		['parecer', 'presente do indicativo', 'eu', 'pareço'],
		['parecer', 'presente do conjuntivo', 'eu', 'pareça'],
		['pôr', 'presente do indicativo', 'eu', 'ponho'],
		['pôr', 'presente do indicativo', 'ele/ela/você', 'põe'],
		['pôr', 'futuro do indicativo', 'eu', 'porei'],
		['pôr', 'infinitivo pessoal', 'eu', 'pôr']
	];

	for (const [verb, tense, person, expected] of checks) {
		it(`${verb} ${tense} ${person} = ${expected}`, () => {
			const entry = map.get(`${verb}:${tense}:${person}`);
			expect(entry).toBeDefined();
			expect(entry!.conjugation).toBe(expected);
		});
	}

	// ── Regular verbs ──
	it('falar presente eu = falo', () => {
		expect(map.get('falar:presente do indicativo:eu')!.conjugation).toBe('falo');
	});

	it('falar preterito perfeito nós = falámos', () => {
		expect(map.get('falar:pretérito perfeito do indicativo:nós')!.conjugation).toBe('falámos');
	});

	// ── Spelling change verbs ──
	it('chegar presente conjuntivo eu = chegue', () => {
		expect(map.get('chegar:presente do conjuntivo:eu')!.conjugation).toBe('chegue');
	});

	it('ficar presente conjuntivo eu = fique', () => {
		expect(map.get('ficar:presente do conjuntivo:eu')!.conjugation).toBe('fique');
	});

	it('começar presente conjuntivo eu = comece', () => {
		expect(map.get('começar:presente do conjuntivo:eu')!.conjugation).toBe('comece');
	});

	it('dever preterito perfeito 3sg = deveu', () => {
		expect(map.get('dever:pretérito perfeito do indicativo:ele/ela/você')!.conjugation).toBe(
			'deveu'
		);
	});

	// ── Default selections ──
	it('default verbs = 25', () => {
		expect(portugueseModule.DEFAULT_VERBS).toHaveLength(25);
	});

	it('default tenses = 5', () => {
		expect(portugueseModule.DEFAULT_TENSES).toHaveLength(5);
	});

	it('default verbs include ser, omit pôr', () => {
		expect(portugueseModule.DEFAULT_VERBS).toContain('ser');
		expect(portugueseModule.DEFAULT_VERBS).not.toContain('pôr');
	});

	it('default tenses match expected', () => {
		expect(portugueseModule.DEFAULT_TENSES).toEqual([
			'presente do indicativo',
			'pretérito perfeito do indicativo',
			'pretérito imperfeito do indicativo',
			'futuro do indicativo',
			'presente do conjuntivo'
		]);
	});
});

describe('Portuguese validateAnswer', () => {
	it('correct ser present', () => {
		expect(validateAnswer('eu sou', 'ser', 'presente do indicativo', 'eu', portugueseModule)).toBe(
			true
		);
	});

	it('correct você estar', () => {
		expect(
			validateAnswer(
				'você está',
				'estar',
				'presente do indicativo',
				'ele/ela/você',
				portugueseModule
			)
		).toBe(true);
	});

	it('wrong conjugation', () => {
		expect(validateAnswer('eu ser', 'ser', 'presente do indicativo', 'eu', portugueseModule)).toBe(
			false
		);
	});

	it('correct falo', () => {
		expect(
			validateAnswer('eu falo', 'falar', 'presente do indicativo', 'eu', portugueseModule)
		).toBe(true);
	});

	it('correct ela fala', () => {
		expect(
			validateAnswer(
				'ela fala',
				'falar',
				'presente do indicativo',
				'ele/ela/você',
				portugueseModule
			)
		).toBe(true);
	});
});
