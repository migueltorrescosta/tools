import { describe, expect, it } from 'vitest';
import {
	displayedUnit,
	formatLoss,
	formatMoney,
	formatSavings,
	scaledValue,
	unitExponent,
	unitPrefix
} from './losses';

describe('monetary unit', () => {
	it('lands the best expected loss in [10, 10 000)', () => {
		expect(unitExponent(87.02)).toBe(0);
		expect(unitExponent(9999)).toBe(0);
		expect(unitExponent(10_000)).toBe(1);
		expect(unitExponent(31_198)).toBe(1);
		expect(unitExponent(5e7)).toBe(2);
		expect(unitExponent(9.3)).toBe(-1);
		expect(unitExponent(0)).toBe(0);
		expect(unitExponent(NaN)).toBe(0);
		expect(unitExponent(1e40)).toBe(6);
	});

	it('prefixes the native unit, including an already prefixed one', () => {
		expect(displayedUnit(1, '€')).toBe('k€');
		expect(displayedUnit(0, 'M€')).toBe('M€');
		expect(displayedUnit(1, 'M€')).toBe('B€');
		expect(displayedUnit(-1, 'M€')).toBe('k€');
		expect(displayedUnit(-2, 'M€')).toBe('€');
		expect(displayedUnit(2, 'M€')).toBe('T€');
		expect(displayedUnit(2, '€')).toBe('M€');
		expect(displayedUnit(3, '$')).toBe('B$');
		expect(displayedUnit(1, 'MWh')).toBe('GWh');
		expect(displayedUnit(1, 'kg')).toBe('Mg');
		expect(displayedUnit(2, '')).toBe('');
		expect(unitPrefix(-2)).toBe('µ');
		expect(() => unitPrefix(7)).toThrow(RangeError);
		expect(scaledValue(31198, 1)).toBe(31.198);
	});

	it('formats like the reference tables', () => {
		expect(formatLoss(5445.364393456948)).toBe('5445.364');
		expect(formatLoss(87.5)).toBe('87.5');
		expect(formatLoss(12)).toBe('12');
		expect(formatSavings(2.5)).toBe('2');
		expect(formatMoney(31198.4, 1, '€')).toBe('31.198 k€');
		expect(formatMoney(31198.4, 1, '')).toBe('31198.4');
	});
});
