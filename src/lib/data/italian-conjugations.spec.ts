import { describe, it, expect } from 'vitest';
import { italianModule } from '$lib/data/italian-conjugations';
import { buildPool, cardKey, validateAnswer } from '$lib/verbs';

const { conjugationMap, VERB_LIST, PERSON_LABELS } = italianModule;

function conj(verb: string, tense: string, person: string): string | undefined {
	return conjugationMap.get(cardKey(verb, tense, person))?.conjugation;
}

describe('Italian conjugation data integrity', () => {
	it('never contains "undefined"', () => {
		const corrupt = [...conjugationMap.values()].filter((e) => /undefined/.test(e.conjugation));
		expect(corrupt.map((e) => `${e.verb}|${e.tense}|${e.person}`)).toEqual([]);
	});

	it('has a non-empty form for every slot except imperativo io and defective imperativi', () => {
		const defective = new Set(['potere', 'dovere']);
		const blank = [...conjugationMap.values()].filter(
			(e) =>
				e.conjugation.trim() === '' &&
				!(e.tense === 'imperativo' && (e.person === 'io' || defective.has(e.verb)))
		);
		expect(blank.map((e) => `${e.verb}|${e.tense}|${e.person}`)).toEqual([]);
	});

	it('is person-invariant for every non-finite tense', () => {
		const nonFinite = [
			'infinito presente',
			'infinito passato',
			'participio presente',
			'participio passato',
			'gerundio presente',
			'gerundio passato'
		];
		for (const verb of VERB_LIST) {
			for (const tense of nonFinite) {
				const forms = new Set(PERSON_LABELS.map((p) => conj(verb, tense, p)));
				expect(forms.size, `${verb} ${tense}`).toBe(1);
			}
		}
	});
});

describe('Italian irregular non-finite forms', () => {
	it('uses the irregular gerundio and participio presente for every person', () => {
		for (const person of PERSON_LABELS) {
			expect(conj('essere', 'gerundio presente', person)).toBe('essendo');
			expect(conj('fare', 'gerundio presente', person)).toBe('facendo');
			expect(conj('essere', 'participio presente', person)).toBe('ente');
		}
	});

	it('accepts "tu essendo" and rejects the bare pronoun', () => {
		expect(validateAnswer('tu essendo', 'essere', 'gerundio presente', 'tu', italianModule)).toBe(
			true
		);
		expect(validateAnswer('tu', 'essere', 'gerundio presente', 'tu', italianModule)).toBe(false);
	});
});

describe('Italian non-finite compound tenses', () => {
	it('builds infinito passato with the bare auxiliary for every person', () => {
		for (const person of PERSON_LABELS) {
			expect(conj('parlare', 'infinito passato', person)).toBe('avere parlato');
			expect(conj('andare', 'infinito passato', person)).toBe('essere andato');
		}
	});

	it('builds gerundio passato with the bare auxiliary for every person', () => {
		for (const person of PERSON_LABELS) {
			expect(conj('parlare', 'gerundio passato', person)).toBe('avendo parlato');
			expect(conj('andare', 'gerundio passato', person)).toBe('essendo andato');
		}
	});

	it('accepts the real form and rejects the literal "undefined"', () => {
		expect(
			validateAnswer('tu avere parlato', 'parlare', 'infinito passato', 'tu', italianModule)
		).toBe(true);
		expect(
			validateAnswer('tu undefined parlato', 'parlare', 'infinito passato', 'tu', italianModule)
		).toBe(false);
	});
});

describe('Italian -ciare/-giare spelling', () => {
	it('drops the stem i before e in futuro semplice', () => {
		expect(conj('mangiare', 'futuro semplice', 'io')).toBe('mangerò');
		expect(conj('mangiare', 'futuro semplice', 'loro')).toBe('mangeranno');
		expect(conj('lasciare', 'futuro semplice', 'noi')).toBe('lasceremo');
	});

	it('drops the stem i before e in condizionale presente', () => {
		expect(conj('lasciare', 'condizionale presente', 'io')).toBe('lascerei');
		expect(conj('mangiare', 'condizionale presente', 'lui/lei')).toBe('mangerebbe');
	});

	it('still drops the stem i before i', () => {
		expect(conj('mangiare', 'congiuntivo presente', 'noi')).toBe('mangiamo');
		expect(conj('mangiare', 'indicativo presente', 'tu')).toBe('mangi');
	});

	it('keeps the stem i before a and o', () => {
		expect(conj('mangiare', 'imperfetto', 'io')).toBe('mangiavo');
		expect(conj('lasciare', 'indicativo presente', 'io')).toBe('lascio');
	});

	it('accepts io mangerò and rejects io mangierò', () => {
		expect(validateAnswer('io mangerò', 'mangiare', 'futuro semplice', 'io', italianModule)).toBe(
			true
		);
		expect(validateAnswer('io mangierò', 'mangiare', 'futuro semplice', 'io', italianModule)).toBe(
			false
		);
	});
});

describe('Italian defective and rare slots', () => {
	it('has no imperativo for potere and dovere, so no cards are built', () => {
		for (const verb of ['potere', 'dovere']) {
			for (const person of PERSON_LABELS) {
				expect(conj(verb, 'imperativo', person), `${verb} ${person}`).toBe('');
			}
		}
		expect(buildPool(['potere', 'dovere'], ['imperativo'], {}, italianModule)).toEqual([]);
	});

	it('marks defective slots with a dash translation', () => {
		const entry = conjugationMap.get(cardKey('parlare', 'imperativo', 'io'));
		expect(entry?.translation).toBe('—');
	});

	it('uses the attested participio presente capiente for capire', () => {
		expect(conj('capire', 'participio presente', 'io')).toBe('capiente');
		expect(conj('sentire', 'participio presente', 'io')).toBe('sentente');
	});
});

describe('Italian accepted alternatives', () => {
	const ok = (input: string, verb: string, tense: string, person: string) =>
		validateAnswer(input, verb, tense, person, italianModule);

	it('accepts full and truncated imperativo tu forms', () => {
		expect(ok("tu fa'", 'fare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu fai', 'fare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu vai', 'andare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu stai', 'stare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu dai', 'dare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu dì', 'dire', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu fanno', 'fare', 'imperativo', 'tu')).toBe(false);
	});

	it('accepts the typographic apostrophe from smart punctuation', () => {
		expect(ok('tu fa\u2019', 'fare', 'imperativo', 'tu')).toBe(true);
		expect(ok('tu va\u2018', 'andare', 'imperativo', 'tu')).toBe(true);
	});

	it('accepts passato remoto doublets', () => {
		expect(ok('io credetti', 'credere', 'passato remoto', 'io')).toBe(true);
		expect(ok('io credei', 'credere', 'passato remoto', 'io')).toBe(true);
		expect(ok('io dovetti', 'dovere', 'passato remoto', 'io')).toBe(true);
		expect(ok('loro dovettero', 'dovere', 'passato remoto', 'loro')).toBe(true);
	});

	it('accepts the elided aver/esser infinito passato', () => {
		expect(ok('tu aver parlato', 'parlare', 'infinito passato', 'tu')).toBe(true);
		expect(ok('noi esser andato', 'andare', 'infinito passato', 'noi')).toBe(true);
		expect(ok('tu ave parlato', 'parlare', 'infinito passato', 'tu')).toBe(false);
	});
});

describe('Italian input normalisation', () => {
	it('accepts decomposed (NFD) accents', () => {
		const nfd = 'lui è'.normalize('NFD');
		expect(nfd).not.toBe('lui è');
		expect(validateAnswer(nfd, 'essere', 'indicativo presente', 'lui/lei', italianModule)).toBe(
			true
		);
	});

	it('collapses internal runs of whitespace', () => {
		expect(
			validateAnswer('io  ho \t parlato', 'parlare', 'passato prossimo', 'io', italianModule)
		).toBe(true);
	});

	it('still rejects a missing accent on the verb', () => {
		expect(validateAnswer('lui e', 'essere', 'indicativo presente', 'lui/lei', italianModule)).toBe(
			false
		);
	});
});
