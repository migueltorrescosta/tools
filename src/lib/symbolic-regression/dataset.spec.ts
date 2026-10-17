import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import {
	analyzeColumns,
	buildDataset,
	defaultInputs,
	parseNumber,
	splitDataset,
	type BuiltDataset
} from './dataset';

describe('parseNumber', () => {
	it.each([
		['1', 1],
		['-2.5', -2.5],
		['1e-3', 0.001],
		['.5', 0.5],
		['  3  ', 3],
		['+4.', 4],
		['2E5', 2e5]
	])('accepts %j', (s, n) => {
		expect(parseNumber(s)).toBe(n);
	});

	it.each(['', ' ', 'NaN', 'abc', '1,5', 'Infinity', '1e', '--1', '0x10', '1 2'])(
		'rejects %j',
		(s) => {
			expect(parseNumber(s)).toBeNaN();
		}
	);
});

const csv = parseCsv(
	['name,x,y,mixed,empty', 'a,1,2,3,', 'b,2,4,oops,', 'c,,6,5,', 'd,4,abc,7,', 'e,5,10,8,'].join(
		'\n'
	)
);

describe('analyzeColumns', () => {
	it('flags columns where most non-empty values are numbers', () => {
		expect(analyzeColumns(csv)).toEqual([
			{ name: 'name', index: 0, numeric: false },
			{ name: 'x', index: 1, numeric: true },
			{ name: 'y', index: 2, numeric: true },
			{ name: 'mixed', index: 3, numeric: true },
			{ name: 'empty', index: 4, numeric: false }
		]);
	});

	it('defaultInputs picks every other numeric column', () => {
		expect(defaultInputs(analyzeColumns(csv), 2)).toEqual([1, 3]);
	});
});

describe('buildDataset', () => {
	it('drops rows with a missing or non-numeric selected value', () => {
		const built = buildDataset(csv, 2, [1, 3]);
		expect(built.inputNames).toEqual(['x', 'mixed']);
		expect(built.targetName).toBe('y');
		expect(built.totalRows).toBe(5);
		expect(built.droppedRows).toBe(3);
		expect(Array.from(built.data.y)).toEqual([2, 10]);
		expect(built.data.x.map((c) => Array.from(c))).toEqual([
			[1, 5],
			[3, 8]
		]);
	});

	it('ignores unselected columns', () => {
		const built = buildDataset(csv, 2, []);
		expect(built.droppedRows).toBe(1);
		expect(built.data.x).toEqual([]);
		expect(built.data.y).toBeInstanceOf(Float64Array);
	});
});

function sequence(n: number): BuiltDataset {
	const y = Float64Array.from({ length: n }, (_, i) => i);
	return {
		inputNames: ['x'],
		targetName: 'y',
		data: { x: [Float64Array.from(y, (v) => v * 10)], y },
		droppedRows: 0,
		totalRows: n
	};
}

describe('splitDataset', () => {
	it('is deterministic for a fixed seed and differs across seeds', () => {
		const built = sequence(100);
		const a = splitDataset(built, 0.2, 7);
		const b = splitDataset(built, 0.2, 7);
		const c = splitDataset(built, 0.2, 8);
		expect(Array.from(a.validation.y)).toEqual(Array.from(b.validation.y));
		expect(Array.from(a.validation.y)).not.toEqual(Array.from(c.validation.y));
	});

	it('produces disjoint, complete parts of the right size with aligned columns', () => {
		const built = sequence(101);
		const { train, validation, inputNames, targetName } = splitDataset(built, 0.25, 3);
		expect(inputNames).toEqual(['x']);
		expect(targetName).toBe('y');
		expect(validation.y.length).toBe(25);
		expect(train.y.length).toBe(76);
		const all = [...train.y, ...validation.y].sort((p, q) => p - q);
		expect(all).toEqual(Array.from(built.data.y));
		for (const part of [train, validation]) {
			part.y.forEach((v, i) => expect(part.x[0][i]).toBe(v * 10));
		}
	});

	it('keeps at least one row in each part', () => {
		expect(splitDataset(sequence(2), 0.01, 1).validation.y.length).toBe(1);
		expect(splitDataset(sequence(2), 0.99, 1).train.y.length).toBe(1);
		expect(splitDataset(sequence(10), 0.999, 1).train.y.length).toBe(1);
		const one = splitDataset(sequence(1), 0.5, 1);
		expect([one.train.y.length, one.validation.y.length]).toEqual([1, 0]);
	});
});
