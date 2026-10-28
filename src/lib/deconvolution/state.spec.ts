import { describe, expect, it } from 'vitest';
import { validateParams } from './families';
import { PRESETS, decodeSettings, encodeSettings, parseSettings, presetSettings } from './state';
import type { DistSpec } from './types';

const specValid = (s: DistSpec) =>
	s.family === 'mixture'
		? s.components.every((c) => validateParams(c.family, c.params).length === 0)
		: validateParams(s.family, s.params).length === 0;

describe('presets', () => {
	it('are valid and parse back unchanged', () => {
		for (const p of PRESETS) {
			const s = presetSettings(p.id);
			expect(specValid(s.x), p.id).toBe(true);
			expect(specValid(s.y), p.id).toBe(true);
			expect(parseSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
		}
	});

	it('an unknown preset id falls back to the first', () => {
		expect(presetSettings('nope')).toEqual(presetSettings(PRESETS[0].id));
	});
});

describe('parseSettings', () => {
	const base = () => JSON.parse(JSON.stringify(presetSettings())) as Record<string, unknown>;

	it.each([
		['a wrong version', { v: 2 }],
		['an unknown family', { y: { family: 'zeta', params: [1] } }],
		['a wrong parameter count', { y: { family: 'normal', params: [0] } }],
		['a non-finite parameter', { y: { family: 'normal', params: [0, null] } }],
		['n too small', { n: 5 }],
		['n not whole', { n: 100.5 }],
		['a negative seed', { seed: -1 }],
		['an unknown source', { source: 'url' }],
		['an unknown method', { methods: ['mle', 'magic'] }],
		['a non-boolean fitNoise', { fitNoise: 'yes' }],
		['df out of range', { df: 40 }],
		['a negative bandwidth', { bandwidth: -1 }],
		['B too large', { bootstrapB: 1e6 }],
		[
			'a one-component mixture',
			{ x: { family: 'mixture', components: [{ family: 'normal', params: [0, 1], weight: 1 }] } }
		],
		[
			'a zero mixture weight',
			{
				x: {
					family: 'mixture',
					components: [
						{ family: 'normal', params: [0, 1], weight: 0 },
						{ family: 'normal', params: [1, 1], weight: 1 }
					]
				}
			}
		]
	])('rejects %s', (_, patch) => {
		expect(parseSettings({ ...base(), ...patch })).toBeNull();
	});

	it('drops duplicate methods and keeps a null bandwidth', () => {
		const s = parseSettings({ ...base(), methods: ['mle', 'mle', 'kernel'], bandwidth: null });
		expect(s?.methods).toEqual(['mle', 'kernel']);
		expect(s?.bandwidth).toBeNull();
	});
});

describe('share link', () => {
	it('round-trips settings, including non-ASCII-free JSON', () => {
		const s = { ...presetSettings('fringes'), n: 1234, seed: 99, methods: ['kernel' as const] };
		const text = encodeSettings(s);
		expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeSettings(text)).toEqual(s);
	});

	it('returns null for garbage or tampered links', () => {
		expect(decodeSettings('not-a-real-link')).toBeNull();
		expect(decodeSettings(encodeSettings(presetSettings()).slice(0, 20))).toBeNull();
		expect(decodeSettings('x'.repeat(30_000))).toBeNull();
	});
});
