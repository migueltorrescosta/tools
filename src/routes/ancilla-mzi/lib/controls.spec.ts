import { describe, expect, it } from 'vitest';
import { applyPreset, defaultSetup } from '$lib/ancilla-mzi/presets';
import { controlCount } from '$lib/ancilla-mzi/types';
import { activeControls } from './controls';

describe('activeControls', () => {
	it('lists every switched-on entry in the engine layout', () => {
		const s = applyPreset(defaultSetup(), 'active+S');
		const entries = activeControls(s);
		expect(entries.map((e) => e.index)).toEqual(
			Array.from({ length: controlCount(2) }, (_, i) => i)
		);
		expect(entries[1]).toMatchObject({ symbol: 'α', sub: 'xy' });
		expect(entries[9]).toMatchObject({ symbol: 'b', sub: 'x' });
		expect(entries[15 + 6]).toMatchObject({ symbol: 'v1', sub: 'Sx', bound: s.pulseBound });
	});

	it('skips masked entries', () => {
		const s = applyPreset(defaultSetup(), 'local');
		s.fieldS = [false, false, true];
		const idx = activeControls(s).map((e) => e.index);
		expect(idx).toEqual([9, 10, 11, 14, 15, 16, 17, 18, 19, 20]);
	});
});
