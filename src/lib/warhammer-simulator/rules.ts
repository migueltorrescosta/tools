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

/** Outcome of a to-hit or to-wound roll, keeping the natural D6 that counted. */
export interface RollOutcome {
	success: boolean;
	/** The natural roll that stood (the reroll, if one was taken). */
	natural: number;
}

/**
 * Roll against a target number with an optional single reroll of a failure.
 * `rerollOnes` rerolls only a failed natural 1 (e.g. Murderous Prowess).
 */
function rollWithReroll(
	rng: SeededRNG,
	target: number,
	reroll?: RerollSource,
	rerollOnes = false
): RollOutcome {
	let natural = rng.rollD6();
	if (natural < target && (reroll || (rerollOnes && natural === 1))) natural = rng.rollD6();
	return { success: natural >= target, natural };
}

/** Roll to hit, reporting the natural roll (for poison). */
export function rollToHit(
	rng: SeededRNG,
	attackerWS: number,
	defenderWS: number,
	reroll?: RerollSource
): RollOutcome {
	return rollWithReroll(rng, getToHitTarget(attackerWS, defenderWS), reroll);
}

/** Roll to wound, reporting the natural roll (for killing blow). */
export function rollToWound(
	rng: SeededRNG,
	strength: number,
	toughness: number,
	reroll?: RerollSource,
	rerollOnes = false
): RollOutcome {
	return rollWithReroll(rng, getToWoundTarget(strength, toughness), reroll, rerollOnes);
}

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
	return rollToHit(rng, attackerWS, defenderWS, reroll).success;
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
	return rollToWound(rng, strength, toughness, reroll).success;
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
	if (!isValidSave(wardSave)) return false; // no ward save
	const roll = rng.rollD6();
	return roll >= wardSave;
}

/** True for a usable 2+ to 6+ save; 0 or 7 mean "no save". */
function isValidSave(save: number): boolean {
	return save >= 2 && save <= 6;
}

/** The better of two ward-style saves (lower is better), treating 0/7 as none. Returns 0 for none. */
export function bestSave(a: number, b: number): number {
	const valid = [a, b].filter(isValidSave);
	return valid.length ? Math.min(...valid) : 0;
}

// ── Special rules ──

/**
 * Special rules the simulator models. Every other id (fear, stubborn,
 * martial-prowess, ...) has no effect in a one-on-one duel as modelled here.
 *   hatred-all            reroll failed to-hit rolls in the first round of combat
 *   hatred-of-<faction>   the same, only against an opponent of that faction
 *   murderous-prowess     reroll to-wound rolls of a natural 1
 */
export function isModelledSpecialRule(id: string): boolean {
	return id === 'murderous-prowess' || id === 'hatred-all' || id.startsWith('hatred-of-');
}

/** Whether `char` has Hatred against `opponent` (any faction if no opponent is given). */
function hates(char: Character, opponent?: Character): boolean {
	return char.specialRules.some(
		(id) =>
			id === 'hatred-all' ||
			(id.startsWith('hatred-of-') && (!opponent || id === `hatred-of-${opponent.faction}`))
	);
}

// ── Character stat resolution for a given round ──

export interface EffectiveStats {
	strength: number;
	toughness: number;
	attacks: number;
	initiative: number;
	ap: number;
	armourSave: number;
	hasRerollHits: boolean;
	hasRerollWounds: boolean;
	/** Reroll to-wound rolls of a natural 1 (Murderous Prowess). */
	rerollWoundOnes: boolean;
	hasKillingBlow: boolean;
	hasPoison: boolean;
	ignoresArmour: boolean;
	/** Strikes Last (great weapon): strikes after models without it, even when charging. */
	strikesLast: boolean;
	wardSave: number;
	/** Regeneration (X+) save, 0 = none. Does not stack with wardSave; the better is used. */
	regenerationSave: number;
}

/**
 * Compute effective combat stats for a character in a given round.
 * Accounts for weapon, charging, and special rules. `isCharging` is true only
 * in the round the character charged. `opponent` scopes faction Hatred; without
 * it, any Hatred applies (used for the display panel).
 */
export function computeEffectiveStats(
	char: Character,
	isCharging: boolean,
	roundNumber: number,
	opponent?: Character
): EffectiveStats {
	const weapon = getWeaponStats(char.weapon);
	const armour = getArmourStats(char.armour);
	const shield = getShieldStats(char.shield);

	// Base stats
	let strength = char.s + weapon.strengthBonus;
	let toughness = char.t;
	let attacks = char.a + weapon.attacks;
	const initiative = char.i;
	let ap = weapon.ap;
	const firstRound = roundNumber === 1;

	// Lance: Strength and AP bonus only in the round the wielder charges.
	// Flail: Strength and AP bonus only in the first round of combat.
	const bonusLost =
		(weapon.special.includes('charge-bonus-only') && !isCharging) ||
		(weapon.special.includes('first-round-bonus-only') && !firstRound);
	if (bonusLost) {
		strength = char.s;
		ap = 0;
	}

	// Great weapon: Strikes Last is a strike-order rule applied by CombatEngine;
	// Initiative itself is unchanged.
	const strikesLast = weapon.special.includes('always-strikes-last');

	// Charging changes strike order only (the charger strikes first in round 1,
	// in CombatEngine); it adds no Initiative here.

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

	// Special rules, gifts and items. Effects follow each entry's description in
	// data/gift-traits.json; "first round" items apply only in round 1.
	const has = (id: string) => char.traits.includes(id);

	const hasRerollHits =
		has('immortal-fury') || (firstRound && (has('reroll-hits') || hates(char, opponent)));
	const hasRerollWounds = has('reroll-wounds') && firstRound;
	const rerollWoundOnes = char.specialRules.includes('murderous-prowess');
	const hasKillingBlow = has('killing-blow');
	const hasPoison = has('poisoned-attacks');
	const regenerationSave = has('regeneration') ? 4 : 0;
	const ignoresArmour = has('blasted-standard');

	if (has('strength+1')) strength += 1;
	if (has('strength-boost') && firstRound) strength += 1;
	if (has('toughness-boost') && firstRound) toughness += 1;
	if (has('attacks+1') && firstRound) attacks += 1;
	// Daemonic Mount: the duel assumes the character is mounted on it.
	if (has('daemonic-mount')) {
		attacks += 1;
		toughness += 1;
	}
	if (has('armour-boost')) {
		armourSave = clampSave(armourSave - 1);
	}
	// Talismans grant a ward but never worsen a better innate one.
	if (has('ward-4')) wardSave = bestSave(wardSave, 4);
	if (has('ward-5')) wardSave = bestSave(wardSave, 5);

	return {
		strength,
		toughness,
		attacks,
		initiative,
		ap,
		armourSave,
		hasRerollHits,
		hasRerollWounds,
		rerollWoundOnes,
		hasKillingBlow,
		hasPoison,
		ignoresArmour,
		strikesLast,
		wardSave,
		regenerationSave
	};
}

/**
 * Resolve a single attack from attacker against defender.
 * Returns the number of wounds dealt: 0, 1, or the defender's full starting
 * Wounds when a Killing Blow slays outright.
 * `onActivate` is called with a trait id each time that trait actually fires.
 */
export function resolveSingleAttack(
	rng: SeededRNG,
	attacker: Character,
	defender: Character,
	attackerStats: EffectiveStats,
	defenderStats: EffectiveStats,
	onActivate?: (id: string) => void
): number {
	// 1. Hit roll
	const hitReroll = attackerStats.hasRerollHits ? ('always' as RerollSource) : undefined;
	const hit = rollToHit(rng, attacker.ws, defender.ws, hitReroll);
	if (!hit.success) return 0;

	// 2. Poisoned Attacks: a natural 6 to hit wounds automatically.
	const poisoned = attackerStats.hasPoison && hit.natural === 6;
	let killingBlow = false;

	if (poisoned) {
		onActivate?.('poisoned-attacks');
	} else {
		// 3. Wound roll
		const woundReroll = attackerStats.hasRerollWounds ? ('always' as RerollSource) : undefined;
		const wound = rollToWound(
			rng,
			attackerStats.strength,
			defenderStats.toughness,
			woundReroll,
			attackerStats.rerollWoundOnes
		);
		if (!wound.success) return 0;
		// 4. Killing Blow: a natural 6 to wound slays outright, no armour save.
		// Rules note: an auto-wound from poison has no wound roll, so it cannot
		// also trigger Killing Blow. Ward saves still apply, as in TOW.
		killingBlow = attackerStats.hasKillingBlow && wound.natural === 6;
	}

	// 5. Armour save (AP reduces the defender's save)
	if (!killingBlow && !attackerStats.ignoresArmour) {
		const saveSuccessful = resolveArmourSave(rng, defenderStats.armourSave, attackerStats.ap);
		if (saveSuccessful) return 0;
	}

	// 6. Ward or Regeneration save. They do not stack: the defender takes the
	// better one (ward on a tie). Rules note: Killing Blow does not bypass either.
	const ward = defenderStats.wardSave;
	const regen = defenderStats.regenerationSave;
	const useRegen = isValidSave(regen) && (!isValidSave(ward) || regen < ward);
	const save = useRegen ? regen : ward;
	if (resolveWardSave(rng, save)) {
		if (useRegen) onActivate?.('regeneration');
		return 0;
	}

	if (killingBlow) {
		onActivate?.('killing-blow');
		return defender.wounds;
	}
	return 1;
}
