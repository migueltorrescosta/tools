import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { parse } from './parse';

const env: Record<string, number> = { x: 3, y: -2, z: 0, n: NaN };
const run = (text: string) => {
	const r = parse(text);
	if (!r.ok) throw new Error(r.error.message);
	return evaluate(r.ast, (name) => env[name]);
};

describe('evaluate', () => {
	it.each([
		['1 + 2 * 3', 7],
		['-x^2', -9],
		['2^3^2', 512],
		['x / y', -1.5],
		['x > y', 1],
		['x <= y', 0],
		['x == 3', 1],
		['x != 3', 0],
		['x and z', 0],
		['x or z', 1],
		['not z', 1],
		['not x', 0],
		['n and 1', 1],
		['n > 0', 0],
		['n != n', 1],
		['z ? 1 : 2', 2],
		['n ? 1 : 2', 1],
		['if(y < 0, 10, 20)', 10],
		['ind(y)', 1],
		['ind(z)', 0],
		['min(x, y, 7)', -2],
		['max(x, y)', 3],
		['abs(y)', 2],
		['exp(0) + ln(1)', 1],
		['sqrt(16)', 4],
		['floor(-1.5) + ceil(1.5)', 0],
		['clamp(x, 0, 1)', 1],
		['clamp(y, 0, 1)', 0],
		['pow(2, 10)', 1024],
		['1e6 * .5', 500000]
	])('%s = %d', (text, value) => expect(run(text)).toBe(value));

	it('lets NaN and infinities through', () => {
		expect(run('1 / z')).toBe(Infinity);
		expect(run('ln(y)')).toBeNaN();
		expect(run('z / z')).toBeNaN();
	});
});
