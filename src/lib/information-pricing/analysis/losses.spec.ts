import { describe, expect, it } from 'vitest';
import { displayedUnit, scaledValue, unitExponent, unitPrefix } from './losses';

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
});
