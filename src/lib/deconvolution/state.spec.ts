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
		['a wrong version', { v: 3 }],
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

describe('2D settings', () => {
	it('2D presets are valid and parse back unchanged', async () => {
		const { PRESETS2 } = await import('./state');
		const { validate2 } = await import('./dist2');
		for (const p of PRESETS2) {
			expect(validate2(p.x), p.id).toEqual([]);
			expect(validate2(p.y), p.id).toEqual([]);
			const s = { ...presetSettings(), dim: 2 as const, x2: p.x, y2: p.y };
			expect(parseSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
		}
	});

	it('migrates version-1 settings, keeping the 1D model', () => {
		const old = { ...JSON.parse(JSON.stringify(presetSettings('counts'))), v: 1 };
		delete old.dim;
		delete old.x2;
		delete old.y2;
		delete old.methods2;
		const s = parseSettings(old);
		expect(s?.dim).toBe(1);
		expect(s?.x).toEqual(presetSettings('counts').x);
		expect(s?.x2).toEqual(presetSettings().x2);
	});

	it.each([
		['a bad dimension', { dim: 3 }],
		['a 2D noise that is a mixture', { y2: presetSettings().x2 }],
		['a short Gaussian parameter list', { x2: { family: 'gauss2', params: [0, 0, 1, 1] } }],
		['an unknown 2D method', { methods2: ['kernel'] }]
	])('rejects %s', (_, patch) => {
		expect(parseSettings({ ...JSON.parse(JSON.stringify(presetSettings())), ...patch })).toBeNull();
	});
});
