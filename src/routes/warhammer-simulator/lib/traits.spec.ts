import { describe, expect, it } from 'vitest';
import { PRESET_CHARACTERS } from '$lib/warhammer-simulator/presets';
import { GIFT_POINT_LIMIT, MAX_ITEMS, itemCount, totalGiftPoints } from './traits';

describe('presets', () => {
	it.each(PRESET_CHARACTERS.map((p) => [p.name, p] as const))(
		'%s fits the gift-point and item limits',
		(_, preset) => {
			expect(totalGiftPoints(preset.traits)).toBeLessThanOrEqual(GIFT_POINT_LIMIT);
			expect(itemCount(preset.traits)).toBeLessThanOrEqual(MAX_ITEMS);
		}
	);
});
