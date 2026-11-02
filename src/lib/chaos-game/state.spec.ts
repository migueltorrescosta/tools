import { describe, expect, it } from 'vitest';
import { decodeShareParams, encodeShareParams, hasShareParams, type ShareState } from './state';

const full: ShareState = {
	setup: {
		points: [
			{ x: 0, y: 1 },
			{ x: -0.5, y: 0.25, weight: 3 },
			{ x: 1, y: -1, ratio: 0.3, rotation: -15 },
			{ x: 2, y: 2, weight: 0.5, matrix: [0, 0, 0, 0.16] }
		],
		ratio: 0.6,
		rule: { forbid: [1, 3] },
		seed: 42
	},
	colour: 'point',
	gamma: 3.5,
	challenge: 'barnsley-fern'
};

describe('share params', () => {
	it('round-trips every field', () => {
		const back = decodeShareParams(new URLSearchParams(encodeShareParams(full).toString()));
		expect(back).toEqual(full);
	});

	it('needs no percent-encoding', () => {
		const text = encodeShareParams(full).toString();
		expect(text).not.toMatch(/%/);
		expect(text).toContain('p=0_1*-0.5_0.25_3*1_-1__0.3_-15*2_2_0.5___0_0_0_0.16');
	});

	it('leaves out empty rules and challenges', () => {
		const params = encodeShareParams({
			...full,
			setup: { ...full.setup, rule: { forbid: [] } },
			challenge: null
		});
		expect(params.has('f')).toBe(false);
		expect(params.has('ch')).toBe(false);
		expect(decodeShareParams(params).setup?.rule).toEqual({ forbid: [] });
	});

	it('is recognised by its points', () => {
		expect(hasShareParams(new URLSearchParams('p=0_0'))).toBe(true);
		expect(hasShareParams(new URLSearchParams('r=0.5'))).toBe(false);
	});

	it.each([
		['p=0_0*x_1', 'points'],
		['p=0', 'points'],
		['p=0_0_-', 'points'],
		['r=1', 'ratio'],
		['r=abc', 'ratio'],
		['s=1.5', 'seed']
	])('drops an invalid %s', (query, key) => {
		expect(decodeShareParams(new URLSearchParams(query)).setup?.[key as 'points']).toBeUndefined();
	});

	it('drops more than 32 points', () => {
		const p = Array.from({ length: 33 }, () => '0_0').join('*');
		expect(decodeShareParams(new URLSearchParams(`p=${p}`)).setup).toEqual({
			rule: { forbid: [] }
		});
	});

	it('drops bad colours, gammas, rules and challenge ids', () => {
		const d = decodeShareParams(new URLSearchParams('c=x&g=9&f=1_a&ch=Bad%20id'));
		expect(d.colour).toBeUndefined();
		expect(d.gamma).toBeUndefined();
		expect(d.setup).toBeUndefined();
		expect(d.challenge).toBeNull();
	});

	it('reads density colour and an empty point list', () => {
		const d = decodeShareParams(new URLSearchParams('p=&c=d&g=0.5'));
		expect(d.setup?.points).toEqual([]);
		expect(d.colour).toBe('density');
		expect(d.gamma).toBe(0.5);
	});
});
