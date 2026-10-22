import { describe, expect, it } from 'vitest';
import {
	argsortStable,
	linspace,
	nextUp,
	pairwiseSum,
	quantileSorted,
	sortedCopy
} from './numeric';
import { pyFixed, pyGeneral, pyRepr, pyRoundString, roundHalfEven } from './format';

function lcg(seed: number) {
	return () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
}

describe('pairwiseSum', () => {
	it('adds short runs in order and long runs pairwise', () => {
		expect(pairwiseSum([1, 2, 3], 0, 3)).toBe(6);
		expect(Object.is(pairwiseSum([-0, -0], 0, 2), -0)).toBe(true);
		const a = Float64Array.from({ length: 1000 }, (_, i) => 0.1 * (i + 1));
		expect(pairwiseSum(a, 0, 1000)).toBeCloseTo(50050, 9);
		// Strided view of the second column of a 2-column matrix.
		const m = new Float64Array(20).map((_, i) => (i % 2 ? i : 0));
		expect(pairwiseSum(m, 1, 10, 2)).toBe(100);
	});
});

describe('linspace and nextUp', () => {
	it('matches NumPy', () => {
		expect(Array.from(linspace(0, 1, 5))).toEqual([0, 0.25, 0.5, 0.75, 1]);
		expect(linspace(0.1, 0.9, 9)[8]).toBe(0.9);
		expect(nextUp(1)).toBe(1 + Number.EPSILON);
		expect(nextUp(0)).toBe(Number.MIN_VALUE);
		expect(nextUp(-1)).toBe(-1 + Number.EPSILON / 2);
	});
});

describe('quantileSorted', () => {
	it('interpolates linearly like np.quantile', () => {
		const s = [1, 2, 4, 8];
		expect(quantileSorted(s, 0)).toBe(1);
		expect(quantileSorted(s, 1)).toBe(8);
		expect(quantileSorted(s, 0.5)).toBe(3);
		expect(quantileSorted(s, 0.25)).toBe(1.75);
		expect(quantileSorted([5], 0.3)).toBe(5);
	});
});

describe('argsortStable and sortedCopy', () => {
	it('keeps ties in input order on the radix path', () => {
		const rnd = lcg(7);
		const values = Float64Array.from({ length: 5000 }, () => Math.floor(rnd() * 50) - 25 + 0.5);
		values[10] = -0;
		values[11] = 0;
		values[12] = -1e-300;
		const order = argsortStable(values);
		const expected = Array.from(values.keys()).sort((a, b) => values[a] - values[b] || a - b);
		expect(Array.from(order)).toEqual(expected);
		const sorted = sortedCopy(values);
		expect(Array.from(sorted)).toEqual(expected.map((i) => values[i] + 0));
	});

	it('sorts small inputs the same way', () => {
		const values = Float64Array.from([3, 1, 3, -2, 1]);
		expect(Array.from(argsortStable(values))).toEqual([3, 1, 4, 0, 2]);
	});
});

describe('Python formatting', () => {
	it('prints floats like repr', () => {
		expect(pyRepr(9934)).toBe('9934.0');
		expect(pyRepr(0.050000000000000044)).toBe('0.050000000000000044');
		expect(pyRepr(1e16)).toBe('1e+16');
		expect(pyRepr(1.5e-5)).toBe('1.5e-05');
		expect(pyRepr(123456789012345680)).toBe('1.2345678901234568e+17');
		expect(pyRepr(-0)).toBe('-0.0');
		expect(pyRepr(0.0001)).toBe('0.0001');
	});

	it('rounds ties to even in fixed and general formats', () => {
		expect(pyFixed(2.5, 0)).toBe('2');
		expect(pyFixed(3.5, 0)).toBe('4');
		expect(pyFixed(-2.5, 0)).toBe('-2');
		expect(pyFixed(0.0625, 3)).toBe('0.062');
		expect(pyFixed(0.125, 2)).toBe('0.12');
		expect(pyFixed(-0, 1)).toBe('-0.0');
		expect(pyGeneral(10084.5, 5)).toBe('10084');
		expect(pyGeneral(0.2920030316562984, 5)).toBe('0.292');
		expect(pyGeneral(142.14805730719786, 5)).toBe('142.15');
		expect(pyGeneral(0.020633208126359562, 5)).toBe('0.020633');
		expect(pyGeneral(123456, 5)).toBe('1.2346e+05');
		expect(pyGeneral(0.00001234, 5)).toBe('1.234e-05');
		expect(pyGeneral(99999.5, 5)).toBe('1e+05');
		expect(pyGeneral(-0.5, 5)).toBe('-0.5');
		expect(roundHalfEven(2.5)).toBe(2);
		expect(roundHalfEven(-3.5)).toBe(-4);
		expect(pyRoundString(NaN)).toBe('–');
		expect(pyRoundString(-0.4)).toBe('0');
	});
});
