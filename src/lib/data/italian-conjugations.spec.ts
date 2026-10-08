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

	it('has a non-empty form for every slot except imperativo io', () => {
		const blank = [...conjugationMap.values()].filter(
			(e) => e.conjugation.trim() === '' && !(e.tense === 'imperativo' && e.person === 'io')
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
