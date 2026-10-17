import { describe, it, expect } from 'vitest';
import {
	canSaveCsv,
	clearSaved,
	decodeShareParams,
	encodeShareParams,
	hasShareParams,
	MAX_SAVED_CSV_LENGTH,
	readJson,
	STORAGE_PREFIX,
	type ShareState
} from './state';

function memoryStorage(entries: Record<string, string>): Storage {
	const map = new Map(Object.entries(entries));
	return {
		get length() {
			return map.size;
		},
		key: (i) => [...map.keys()][i] ?? null,
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
		clear: () => map.clear()
	};
}

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
	it('clears only keys under the prefix', () => {
		const storage = memoryStorage({
			[`${STORAGE_PREFIX}settings`]: '{}',
			[`${STORAGE_PREFIX}front`]: '[]',
			'decision-tree-path': '[]'
		});
		clearSaved(storage);
		expect(storage.length).toBe(1);
		expect(storage.getItem('decision-tree-path')).toBe('[]');
	});

	it('saves CSV text up to the limit only', () => {
		expect(canSaveCsv('x'.repeat(MAX_SAVED_CSV_LENGTH))).toBe(true);
		expect(canSaveCsv('x'.repeat(MAX_SAVED_CSV_LENGTH + 1))).toBe(false);
	});

	it('reads JSON, returning null when absent or corrupt', () => {
		const storage = memoryStorage({ a: '{"x":1}', b: '{' });
		expect(readJson(storage, 'a')).toEqual({ x: 1 });
		expect(readJson(storage, 'b')).toBeNull();
		expect(readJson(storage, 'c')).toBeNull();
		expect(readJson(null, 'a')).toBeNull();
	});
});
