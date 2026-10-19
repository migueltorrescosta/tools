import { describe, it, expect } from 'vitest';
import {
	canSaveCsv,
	decodeShareParams,
	encodeShareParams,
	hasShareParams,
	MAX_SAVED_CSV_LENGTH,
	type ShareState
} from './state';

const state: ShareState = {
	operators: ['add', 'mul', 'sqrt'],
	target: 'T, years',
	inputs: ['a', 'b,c'],
	timeBudgetSec: 30,
	validationFraction: 0.25,
	seed: 7,
	workers: 2,
	exampleId: 'kepler'
};

describe('share params', () => {
	it('round-trips every setting, including names with commas', () => {
		const params = new URLSearchParams(encodeShareParams(state).toString());
		expect(hasShareParams(params)).toBe(true);
		expect(decodeShareParams(params)).toEqual(state);
	});

	it('drops unknown operators and invalid numbers', () => {
		const params = new URLSearchParams('ops=add,eval,cos&budget=-1&split=2&seed=1.5&workers=0');
		expect(decodeShareParams(params)).toEqual({ operators: ['add', 'cos'] });
	});

	it('reports no share params on a bare URL', () => {
		expect(hasShareParams(new URLSearchParams('utm=x'))).toBe(false);
	});
});

describe('saved data', () => {
	it('saves CSV text up to the limit only', () => {
		expect(canSaveCsv('x'.repeat(MAX_SAVED_CSV_LENGTH))).toBe(true);
		expect(canSaveCsv('x'.repeat(MAX_SAVED_CSV_LENGTH + 1))).toBe(false);
	});
});
