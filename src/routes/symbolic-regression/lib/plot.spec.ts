import { describe, it, expect } from 'vitest';
import { formatTick, niceTicks, thin } from './plot';

describe('plot helpers', () => {
	it('picks round ticks inside the range', () => {
		expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
		expect(niceTicks(-0.3, 0.3, 5)).toEqual([-0.2, 0, 0.2].map((t) => expect.closeTo(t, 9)));
		expect(niceTicks(0, 1, 10)).toHaveLength(11);
	});

	it('formats ticks compactly', () => {
		expect(formatTick(0)).toBe('0');
		expect(formatTick(1234.5678)).toBe('1235');
		expect(formatTick(2e-5)).toBe('2.0e-5');
	});

	it('thins long series evenly', () => {
		const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i }));
		expect(thin(points, 100)).toHaveLength(100);
		expect(thin(points.slice(0, 10), 100)).toHaveLength(10);
	});
});
