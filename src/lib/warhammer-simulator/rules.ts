import type { Character, RerollSource, WeaponType } from './types';
import { SeededRNG } from './rng';
import { getToHitTarget, getToWoundTarget, computeEffectiveSave, clampSave } from './tables';
import armouryData from './data/armoury.json';
import type { WeaponStats, ArmourStats, ShieldStats } from './types';

// ── Weapon/Armour/Shield lookup helpers ──

const weapons = armouryData.weapons as WeaponStats[];
const armourTypes = armouryData.armour as ArmourStats[];
const shields = armouryData.shields as ShieldStats[];

export function getWeaponStats(type: WeaponType): WeaponStats {
	const w = weapons.find((w) => w.type === type);
	if (!w) {
		// Default to hand weapon if not found
		return weapons.find((w) => w.type === 'hand-weapon')!;
	}
	return w;
}

export function getArmourStats(type: string): ArmourStats {
	const a = armourTypes.find((a) => a.type === type);
	if (!a) return armourTypes.find((a) => a.type === 'none')!;
	return a;
}

export function getShieldStats(type: string): ShieldStats {
	const s = shields.find((s) => s.type === type);
	if (!s) return shields.find((s) => s.type === 'none')!;
	return s;
}

// ── Combat Resolution Functions ──

/**
 * Resolve a single attack roll.
 * Returns true if the attack hits.
 */
export function resolveHit(
	rng: SeededRNG,
	attackerWS: number,
	defenderWS: number,
	reroll?: RerollSource
): boolean {
	const target = getToHitTarget(attackerWS, defenderWS);
	const roll = rng.rollD6();
	const hit = roll >= target;

	// Single-layer reroll
	if (!hit && reroll) {
		return rng.rollD6() >= target;
	}

	return hit;
}

/**
 * Resolve a single wound roll.
 * Returns true if the attack wounds.
 */
export function resolveWound(
	rng: SeededRNG,
	strength: number,
	toughness: number,
	reroll?: RerollSource
): boolean {
	const target = getToWoundTarget(strength, toughness);
	const roll = rng.rollD6();
	const wound = roll >= target;

	if (!wound && reroll) {
		return rng.rollD6() >= target;
	}

	return wound;
}

/**
 * Resolve an armour save.
 * Returns true if the save is successful (i.e., damage is blocked).
 * AP is a negative number: -1, -2, etc.
 */
export function resolveArmourSave(rng: SeededRNG, baseSave: number, ap: number): boolean {
	const effectiveSave = computeEffectiveSave(baseSave, ap);
	if (effectiveSave >= 7) return false; // no save possible
	const roll = rng.rollD6();
	return roll >= effectiveSave;
}

/**
 * Resolve a ward save.
 * Returns true if the ward save is successful.
 */
export function resolveWardSave(rng: SeededRNG, wardSave: number): boolean {
	if (wardSave < 2 || wardSave > 6) return false; // no ward save
	const roll = rng.rollD6();
	return roll >= wardSave;
}

// ── Character stat resolution for a given round ──

export interface EffectiveStats {
	strength: number;
	attacks: number;
	initiative: number;
	ap: number;
	armourSave: number;
	hasRerollHits: boolean;
	hasRerollWounds: boolean;
	hasKillingBlow: boolean;
	hasPoison: boolean;
	hasRegeneration: boolean;
	wardSave: number;
}

/**
 * Compute effective combat stats for a character in a given round.
 * Accounts for weapon, charging, and special rules.
 */
export function computeEffectiveStats(
	char: Character,
	isCharging: boolean,
	roundNumber: number
): EffectiveStats {
	const weapon = getWeaponStats(char.weapon);
	const armour = getArmourStats(char.armour);
	const shield = getShieldStats(char.shield);

	// Base stats
	let strength = char.s + weapon.strengthBonus;
	const attacks = char.a + weapon.attacks;
	let initiative = char.i;
	const ap = weapon.ap;

	// Great Weapon: set initiative to 1 before other modifiers
	if (weapon.type === 'great-weapon') {
		initiative = 1;
	}

	// Flails and lances only get their Strength bonus while charging.
	if (!isCharging && weapon.special.includes('charge-strength-only')) {
		strength = char.s;
	}

	// The charge Initiative bonus is applied once, by CombatEngine, from the
	// user-set chargeBonus; it is not added here.

	// Armour save calculation: base armour + shield + parry + special
	let armourSave = armour.save;
	if (char.shield === 'shield') {
		armourSave -= shield.saveBonus; // subtract because lower = better save
		// Parry: hand weapon + shield in melee = additional +1
		if (char.weapon === 'hand-weapon') {
			armourSave -= shield.parryBonus;
		}
	}
	armourSave = clampSave(armourSave);

	// Ward save from items/traits
	let wardSave = char.wardSave;

	// Special rules parsing
	let hasRerollHits = false;
	const hasRerollWounds = false;
	let hasKillingBlow = false;
	let hasPoison = false;
	const hasRegeneration = false;

	// Check traits and gifts for special rules (simplified - hardcoded effects)
	if (char.specialRules.includes('hatred-all') || char.traits.includes('immortal-fury')) {
		hasRerollHits = true;
	}
	if (char.traits.includes('poisoned-attacks')) {
		hasPoison = true;
	}
	if (char.traits.includes('killing-blow')) {
		hasKillingBlow = true;
	}

	// Items affecting stats
	if (char.traits.includes('strength+1')) {
		strength += 1;
	}
	if (char.traits.includes('armour-boost')) {
		armourSave = clampSave(armourSave - 1);
	}
	if (char.traits.includes('ward-4')) {
		wardSave = 4;
	} else if (char.traits.includes('ward-5')) {
		wardSave = 5;
	}

	return {
		strength,
		attacks,
		initiative,
		ap,
		armourSave,
		hasRerollHits,
		hasRerollWounds,
		hasKillingBlow,
		hasPoison,
		hasRegeneration,
		wardSave
	};
}

/**
 * Resolve a single attack from attacker against defender.
 * Returns the number of wounds dealt (0 or 1 for now).
 */
export function resolveSingleAttack(
	rng: SeededRNG,
	attacker: Character,
	defender: Character,
	attackerStats: EffectiveStats,
	defenderStats: EffectiveStats
): number {
	// 1. Hit roll
	const hitReroll = attackerStats.hasRerollHits ? ('always' as RerollSource) : undefined;
	const hits = resolveHit(rng, attacker.ws, defender.ws, hitReroll);
	if (!hits) return 0;

	// 2. Poison check (autowound on 6 to hit)
	// For simplification, we model poison as a flat % boost in the engine
	// since the hit roll is abstracted

	// 3. Wound roll
	const woundReroll = attackerStats.hasRerollWounds ? ('always' as RerollSource) : undefined;
	const wounds = resolveWound(rng, attackerStats.strength, defender.t, woundReroll);
	if (!wounds) return 0;

	// 4. Killing blow: if natural 6 was rolled to wound (we approximate this)
	// For simplicity, KB is handled at the engine level

	// 5. Armour save (AP reduces the defender's save)
	const saveSuccessful = resolveArmourSave(rng, defenderStats.armourSave, attackerStats.ap);
	if (saveSuccessful) return 0;

	// 6. Ward save
	if (defenderStats.wardSave >= 2 && defenderStats.wardSave <= 6) {
		const wardSuccessful = resolveWardSave(rng, defenderStats.wardSave);
		if (wardSuccessful) return 0;
	}

	// Damage inflicted
	return 1;
}
