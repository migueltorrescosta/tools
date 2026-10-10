import { describe, it, expect } from 'vitest';
import { spanishModule } from './spanish-conjugations';
import { buildPool, cardKey, validateAnswer } from '$lib/verbs';

const { conjugationMap: map, VERB_LIST, TENSE_LIST, PERSON_LABELS } = spanishModule;

function conj(verb: string, tense: string, person: string): string | undefined {
	return map.get(cardKey(verb, tense, person))?.conjugation;
}

describe('Spanish conjugation map', () => {
	it('has an entry for every verb × tense × person', () => {
		expect(map.size).toBe(VERB_LIST.length * TENSE_LIST.length * PERSON_LABELS.length);
		expect(map.size).toBe(3600);
	});

	it('default selections exist in the verb and tense lists', () => {
		expect(spanishModule.DEFAULT_VERBS.every((v) => VERB_LIST.includes(v))).toBe(true);
		expect(spanishModule.DEFAULT_TENSES.every((t) => TENSE_LIST.includes(t))).toBe(true);
	});
});

describe('Spanish golden forms', () => {
	const checks: [string, string, string, string][] = [
		// Spelling changes: -gar → -gué, -ger/-gir → -j-, -cer → -zc-
		['llegar', 'pretérito indefinido', 'yo', 'llegué'],
		['llegar', 'subjuntivo presente', 'nosotros/nosotras', 'lleguemos'],
		['seguir', 'presente', 'yo', 'sigo'],
		['seguir', 'pretérito indefinido', 'él/ella', 'siguió'],
		['conocer', 'presente', 'yo', 'conozco'],
		['creer', 'pretérito indefinido', 'él/ella', 'creyó'],
		['creer', 'gerundio simple', 'yo', 'creyendo'],
		// Stem changes
		['pensar', 'presente', 'yo', 'pienso'],
		['pensar', 'presente', 'nosotros/nosotras', 'pensamos'],
		['volver', 'presente', 'ellos/ellas', 'vuelven'],
		['volver', 'participio', 'yo', 'vuelto'],
		// Irregulars
		['ser', 'presente', 'yo', 'soy'],
		['ir', 'pretérito indefinido', 'yo', 'fui'],
		['tener', 'futuro simple', 'yo', 'tendré'],
		['hacer', 'pretérito indefinido', 'él/ella', 'hizo'],
		['decir', 'participio', 'yo', 'dicho'],
		['poner', 'pretérito indefinido', 'yo', 'puse'],
		['salir', 'futuro simple', 'yo', 'saldré'],
		['dar', 'subjuntivo presente', 'él/ella', 'dé'],
		// Accents on vosotros forms
		['hablar', 'presente', 'vosotros/vosotras', 'habláis'],
		['hablar', 'pretérito perfecto', 'vosotros/vosotras', 'habéis hablado']
	];

	for (const [verb, tense, person, expected] of checks) {
		it(`${verb} ${tense} ${person} = ${expected}`, () => {
			expect(conj(verb, tense, person)).toBe(expected);
		});
	}
});

describe('Spanish pronoun input', () => {
	const ok = (input: string, person: string, verb = 'hablar', tense = 'presente') =>
		validateAnswer(input, verb, tense, person, spanishModule);

	it.each(['él/ella habla', 'él ella habla', 'él habla', 'ella habla'])('accepts "%s"', (input) => {
		expect(ok(input, 'él/ella')).toBe(true);
	});

	it('extracts only the verb after both pronouns', () => {
		expect(spanishModule.extractConjugation('él ella habla', 'él/ella')).toBe('habla');
	});

	it('accepts both plural pronouns', () => {
		expect(ok('nosotros nosotras hablamos', 'nosotros/nosotras')).toBe(true);
		expect(ok('nosotras hablamos', 'nosotros/nosotras')).toBe(true);
	});

	it('accepts accent-less pronouns', () => {
		expect(ok('tu hablas', 'tú')).toBe(true);
		expect(ok('el habla', 'él/ella')).toBe(true);
	});

	it('keeps the verb accent-strict', () => {
		expect(ok('vosotros hablais', 'vosotros/vosotras')).toBe(false);
		expect(ok('yo llegue', 'yo', 'llegar', 'pretérito indefinido')).toBe(false);
		expect(ok('yo llegué', 'yo', 'llegar', 'pretérito indefinido')).toBe(true);
	});

	it('rejects the wrong pronoun', () => {
		expect(ok('yo habla', 'él/ella')).toBe(false);
	});
});

describe('Spanish imperative', () => {
	it('builds no yo card', () => {
		const pool = buildPool(['hablar'], ['imperativo'], {}, spanishModule);
		expect(pool).toHaveLength(5);
		expect(pool.some((c) => c.personIndex === 0)).toBe(false);
	});
});

describe('Spanish English hints', () => {
	const hint = (verb: string, tense: string, person: string) =>
		map.get(cardKey(verb, tense, person))?.translation;

	it('picks was or were per person for ser/estar indefinido', () => {
		expect(hint('ser', 'pretérito indefinido', 'yo')).toBe('I was');
		expect(hint('ser', 'pretérito indefinido', 'tú')).toBe('you were');
		expect(hint('estar', 'pretérito indefinido', 'él/ella')).toBe('he/she was');
		expect(hint('estar', 'pretérito indefinido', 'ellos/ellas')).toBe('they were');
	});

	it('uses the subjunctive "were" for subjuntivo imperfecto', () => {
		expect(hint('ser', 'subjuntivo imperfecto', 'yo')).toBe('(that) I were');
	});

	it('never leaves a "was/were" placeholder in any hint', () => {
		const bad = [...map.values()].filter((e) => e.translation.includes('was/were'));
		expect(bad.map((e) => `${e.verb}|${e.tense}|${e.person}`)).toEqual([]);
	});
});
