import { describe, expect, it } from 'vitest';
import {
	dash,
	dataColour,
	decades,
	formatLogTick,
	formatNumber,
	linePath,
	linear,
	logDomain,
	logScale,
	logTicks,
	money,
	spreadLabels,
	voiBounds
} from './format';

describe('format', () => {
	it('formats display numbers to about three significant digits', () => {
		expect(formatNumber(5426.4)).toBe('5,426');
		expect(formatNumber(85.83)).toBe('85.8');
		expect(formatNumber(3.456)).toBe('3.46');
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(NaN)).toBe('–');
	});

	it('scales money into the display unit', () => {
		const m = money(1, 'k€');
		expect(m.scale(12_345)).toBeCloseTo(12.345);
		expect(m.format(12_345)).toBe('12.3 k€');
		expect(money(0, '').format(5)).toBe('5');
	});

	it('maps linear and log scales', () => {
		expect(linear(0, 10, 0, 100)(5)).toBe(50);
		expect(linear(1, 1, 0, 100)(1)).toBe(50);
		const s = logScale(1, 100, 0, 200);
		expect(s(10)).toBeCloseTo(100);
		expect(s(0)).toBe(0);
		expect(logTicks(1, 1000)).toEqual([1, 10, 100, 1000]);
		expect(logDomain([0, 3, 450])).toEqual([1, 1000]);
		expect(logDomain([0])).toEqual([0.1, 1]);
		expect(formatLogTick(10_000)).toBe('10K');
		expect(formatLogTick(0.01)).toBe('0.01');
	});

	it('cycles the data colours and breaks paths at gaps', () => {
		expect(dataColour(0)).toBe('var(--data-1)');
		expect(dataColour(12)).toBe('var(--data-1)');
		expect(linePath([0, 1, 2, 3], [0, NaN, 2, 3])).toBe('M0.0,0.0M2.0,2.0L3.0,3.0');
	});

	it('bounds the value-of-information chart from the EVPI', () => {
		expect(voiBounds(66.7)).toEqual([0.01, 100]);
		// An EVPI on a power of 10 moves the top up, off the frame.
		expect(voiBounds(100)).toEqual([0.1, 1000]);
		expect(voiBounds(1)).toEqual([0.001, 10]);
		expect(voiBounds(0.034)).toEqual([1e-5, 0.1]);
		expect(voiBounds(999.9)).toEqual([0.1, 1000]);
		expect(voiBounds(0)).toBeNull();
		expect(voiBounds(-3)).toBeNull();
		expect(voiBounds(NaN)).toBeNull();
		expect(voiBounds(Infinity)).toBeNull();
	});

	it('lists the decades between two powers of 10', () => {
		expect(decades(0.01, 100)).toEqual([0.01, 0.1, 1, 10, 100]);
		expect(decades(1e-5, 0.1)).toEqual([1e-5, 1e-4, 0.001, 0.01, 0.1]);
	});

	it('nudges end labels apart and keeps them in bounds', () => {
		expect(spreadLabels([50, 52, 100], 12, 0, 200)).toEqual([50, 62, 100]);
		// Same order out as in, whatever the input order.
		expect(spreadLabels([100, 52, 50], 12, 0, 200)).toEqual([100, 62, 50]);
		// Crowded at the bottom: the stack moves up.
		expect(spreadLabels([200, 200, 199], 12, 0, 200)).toEqual([188, 200, 176]);
		expect(spreadLabels([-5], 12, 0, 200)).toEqual([0]);
	});

	it('cycles dash patterns, solid first', () => {
		expect(dash(0)).toBe('');
		expect(dash(1)).not.toBe('');
		expect(dash(6)).toBe(dash(0));
	});
});
