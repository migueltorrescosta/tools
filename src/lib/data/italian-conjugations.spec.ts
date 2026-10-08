import { describe, it, expect } from 'vitest';
import { italianModule } from '$lib/data/italian-conjugations';
import { cardKey, validateAnswer } from '$lib/verbs';

const { conjugationMap, VERB_LIST, PERSON_LABELS } = italianModule;

function conj(verb: string, tense: string, person: string): string | undefined {
	return conjugationMap.get(cardKey(verb, tense, person))?.conjugation;
}

describe('Italian conjugation data integrity', () => {
	it('never contains "undefined"', () => {
		const corrupt = [...conjugationMap.values()].filter((e) => /undefined/.test(e.conjugation));
		expect(corrupt.map((e) => `${e.verb}|${e.tense}|${e.person}`)).toEqual([]);
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

	it('is person-invariant for every verb', () => {
		for (const verb of VERB_LIST) {
			for (const tense of ['infinito passato', 'gerundio passato']) {
				const forms = new Set(PERSON_LABELS.map((p) => conj(verb, tense, p)));
				expect(forms.size, `${verb} ${tense}`).toBe(1);
			}
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
