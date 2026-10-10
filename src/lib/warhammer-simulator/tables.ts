/**
 * Official Warhammer: The Old World rulebook lookup tables.
 *
 * These functions implement the core to-hit and to-wound tables
 * as defined in the Warhammer: The Old World rules.
 */

// ── Weapon Skill To-Hit Table ──
// Returns the minimum D6 roll needed to hit in combat, per The Old World chart:
//   attacker WS higher than target            -> 3+
//   attacker WS equal or lower                -> 4+
//   target WS more than double attacker's WS  -> 5+
// Rules note: some readings of the chart add a 2+ row when the attacker's WS is
// more than double the target's. That row is not confirmed against the rulebook,
// so it is deliberately not modelled; a superior attacker always needs 3+.
export function getToHitTarget(attackerWS: number, defenderWS: number): number {
	if (attackerWS > defenderWS) return 3;
	if (defenderWS > attackerWS * 2) return 5;
	return 4;
}

// Returns a human-readable label for the WS comparison.
export function getWSComparisonLabel(attackerWS: number, defenderWS: number): string {
	if (attackerWS > defenderWS) return 'WS higher (3+)';
	if (defenderWS > attackerWS * 2) return 'Target WS more than double (5+)';
	return 'WS equal or lower (4+)';
}

// ── Strength vs Toughness Wound Table ──
// Returns the minimum D6 roll needed to wound, per The Old World chart, which
// depends only on the difference S - T:
//   S >= T+2 -> 2+,  S = T+1 -> 3+,  S = T -> 4+,  S = T-1 -> 5+,  S <= T-2 -> 6+
// Rules note: older editions had an "impossible" band for very low S; this
// models the TOW reading where any S can wound on a 6+.
export function getToWoundTarget(strength: number, toughness: number): number {
	const d = strength - toughness;
	if (d >= 2) return 2;
	if (d === 1) return 3;
	if (d === 0) return 4;
	if (d === -1) return 5;
	return 6;
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
