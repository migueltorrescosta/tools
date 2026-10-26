import { describe, expect, it } from 'vitest';
import {
	dash,
	dataColour,
	thresholdLabels,
	decades,
	formatLogTick,
	formatNumber,
	inputColour,
	linePath,
	linear,
	logDomain,
	logScale,
	logDecadeBounds,
	logTicks,
	money,
	placeLabels,
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

	it('labels policy-tree edges like the axes, with digits enough to tell neighbours apart', () => {
		expect(thresholdLabels([5060600])).toEqual(['≤ 5.06M', '> 5.06M']);
		expect(thresholdLabels([2.3749, 3.3722])).toEqual(['≤ 2.37', '2.37 to 3.37', '> 3.37']);
		expect(thresholdLabels([1.1164, 1.1171])).toEqual(['≤ 1.116', '1.116 to 1.117', '> 1.117']);
		expect(thresholdLabels([10104])).toEqual(['≤ 10.1K', '> 10.1K']);
	});

	it('cycles the data colours and breaks paths at gaps', () => {
		expect(dataColour(0)).toBe('var(--data-1)');
		expect(dataColour(12)).toBe('var(--data-1)');
		// The two light-mode blues (--data-1, --data-5) never share the first seven slots
		expect(Array.from({ length: 7 }, (_, i) => dataColour(i))).not.toContain('var(--data-5)');
		expect(dataColour(4)).toBe('var(--data-6)');
		expect(dataColour(7)).toBe('var(--data-5)');
		expect(inputColour(0)).toBe('var(--input-1)');
		expect(inputColour(8)).toBe('var(--input-9)');
		expect(inputColour(9)).toBe('var(--input-1)');
		expect(linePath([0, 1, 2, 3], [0, NaN, 2, 3])).toBe('M0.0,0.0M2.0,2.0L3.0,3.0');
	});

	it('bounds the value-of-information chart tightly around the data', () => {
		// The presets at 100,000 samples: distribution centre (EVPI 85.8 €, least
		// savings 3.88 €; the ties sum to ±1e-14, which is noise) and airline share
		// buyback (EVPI 66.7 M€, least savings 0.401 M€).
		expect(voiBounds(85.8, [1e-14, -2e-14, 0, 3.88, 36.9, 29.9, 5.17])).toEqual([1, 100]);
		expect(voiBounds(66.7, [31, 59.6, 0.401, 2.1, 0, -0.2, NaN])).toEqual([0.1, 100]);
		// Tiny savings reach down; the top stays the next power above the EVPI.
		expect(voiBounds(66.7, [0.003, 12])).toEqual([0.001, 100]);
		// A savings on a power of 10 is its own floor.
		expect(voiBounds(66.7, [1, 50])).toEqual([1, 100]);
		// An EVPI on a power of 10 moves the top up, off the frame.
		expect(voiBounds(100, [5])).toEqual([1, 1000]);
		expect(voiBounds(1, [0.25])).toEqual([0.1, 10]);
		// At least one decade: savings in the EVPI's decade.
		expect(voiBounds(66.7, [40, 60])).toEqual([10, 100]);
		expect(voiBounds(0.034, [0.034])).toEqual([0.01, 0.1]);
		// No positive savings: one decade below the EVPI's, so the ceiling still shows.
		expect(voiBounds(66.7, [0, -1, NaN])).toEqual([1, 100]);
		expect(voiBounds(66.7, [])).toEqual([1, 100]);
		expect(voiBounds(100, [1e-12])).toEqual([10, 1000]);
		expect(voiBounds(0, [1])).toBeNull();
		expect(voiBounds(-3, [1])).toBeNull();
		expect(voiBounds(NaN, [1])).toBeNull();
		expect(voiBounds(Infinity, [1])).toBeNull();
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

	it('bounds a log axis three decades under the next power of 10 above the max', () => {
		expect(logDecadeBounds(42)).toEqual([0.1, 100]);
		expect(logDecadeBounds(15.6)).toEqual([0.1, 100]);
		// A max on a power of 10 moves the top up, off the frame.
		expect(logDecadeBounds(100)).toEqual([1, 1000]);
		expect(logDecadeBounds(0.034)).toEqual([0.0001, 0.1]);
		expect(logDecadeBounds(0)).toBeNull();
		expect(logDecadeBounds(-3)).toBeNull();
		expect(logDecadeBounds(NaN)).toBeNull();
		expect(logDecadeBounds(Infinity)).toBeNull();
	});

	it('places point labels clear of the points, each other and the frame', () => {
		const frame = { x0: 0, x1: 200, y0: 0, y1: 100 };
		// Alone: to the right of the point.
		expect(placeLabels([{ x: 50, y: 50, width: 20 }], frame)).toEqual([
			{ x: 57, y: 54.5, anchor: 'start' }
		]);
		// At the right edge: to the left.
		expect(placeLabels([{ x: 195, y: 50, width: 20 }], frame)[0].anchor).toBe('end');
		// Two points side by side: the labels go outwards, clear of the other point.
		const [a, b] = placeLabels(
			[
				{ x: 50, y: 50, width: 30 },
				{ x: 70, y: 50, width: 30 }
			],
			frame
		);
		expect(a).toEqual({ x: 43, y: 54.5, anchor: 'end' });
		expect(b).toEqual({ x: 77, y: 54.5, anchor: 'start' });
	});

	it('cycles dash patterns, solid first', () => {
		expect(dash(0)).toBe('');
		expect(dash(1)).not.toBe('');
		expect(dash(6)).toBe(dash(0));
		expect(dash(1, 1.5)).toBe('10.5 4.5');
		expect(dash(0, 1.5)).toBe('');
	});
});
