/**
 * Official Warhammer: The Old World rulebook lookup tables.
 *
 * These functions implement the core to-hit and to-wound tables
 * as defined in the Warhammer: The Old World rules.
 */

// ── Weapon Skill To-Hit Table ──
// Returns the minimum D6 roll needed to hit (2+ through 6+).
export function getToHitTarget(attackerWS: number, defenderWS: number): number {
	if (attackerWS >= defenderWS * 2) {
		return 3; // 3+ to hit (WS double or more)
	} else if (attackerWS > defenderWS) {
		return 4; // 4+ to hit (WS greater)
	} else if (attackerWS === defenderWS) {
		return 4; // 4+ to hit (WS equal)
	} else if (attackerWS * 2 > defenderWS) {
		return 5; // 5+ to hit (WS less but more than half)
	} else {
		return 6; // 6+ to hit (WS half or less)
	}
}

// Returns a human-readable label for the WS comparison.
export function getWSComparisonLabel(attackerWS: number, defenderWS: number): string {
	if (attackerWS >= defenderWS * 2) return 'WS double or more (3+)';
	if (attackerWS > defenderWS) return 'WS greater (4+)';
	if (attackerWS === defenderWS) return 'WS equal (4+)';
	if (attackerWS * 2 > defenderWS) return 'WS less (5+)';
	return 'WS half or less (6+)';
}

// ── Strength vs Toughness Wound Table ──
// Returns the minimum D6 roll needed to wound (2+ through 6+).
export function getToWoundTarget(strength: number, toughness: number): number {
	if (strength >= toughness * 2) {
		return 2; // 2+ to wound (S double or more)
	} else if (strength > toughness) {
		return 3; // 3+ to wound (S greater)
	} else if (strength === toughness) {
		return 4; // 4+ to wound (S equal)
	} else if (strength * 2 > toughness) {
		return 5; // 5+ to wound (S less but more than half)
	} else {
		return 6; // 6+ to wound (S half or less)
	}
}

/**
 * Computes the effective armour save after AP modification.
 * AP works as a negative modifier: AP -1 makes a 4+ save into a 5+ save.
 * The result is clamped to the [2, 7] range, where 7 means no save.
 */
export function computeEffectiveSave(baseSave: number, ap: number): number {
	// AP reduces save: AP -1 makes 4+ → 5+ (worse), so we *increase* the needed roll
	const modified = baseSave - ap; // ap is typically 0, -1, -2, so -(-1) = +1 makes the number bigger
	return clampSave(modified);
}

/**
 * Clamp save value to valid range.
 * 2 = 2+ (best), 7 = no save (worst).
 */
export function clampSave(save: number): number {
	return Math.max(2, Math.min(7, Math.round(save)));
}
