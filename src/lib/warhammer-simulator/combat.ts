import type { Character, Charger, CombatResult, CombatState, Winner } from './types';
import { SeededRNG } from './rng';
import { computeEffectiveStats, resolveSingleAttack } from './rules';
import type { EffectiveStats } from './rules';

const MAX_ROUNDS = 50;

/**
 * CombatEngine runs a single round-by-round combat simulation
 * between two characters to a terminal state.
 */
export class CombatEngine {
	private charA: Character;
	private charB: Character;
	private rng: SeededRNG;
	private state: CombatState;
	private chargePersists: boolean;
	private chargeBonus: number;

	constructor(
		charA: Character,
		charB: Character,
		rng: SeededRNG,
		chargePersists = false,
		chargeBonus = 3,
		charger: Charger = 'none'
	) {
		this.charA = charA;
		this.charB = charB;
		this.rng = rng;
		this.chargePersists = chargePersists;
		this.chargeBonus = chargeBonus;
		this.state = {
			charAWounds: charA.wounds,
			charBWounds: charB.wounds,
			roundNumber: 0,
			// Only the side that charged gets charge effects.
			chargeA: charger === 'A',
			chargeB: charger === 'B',
			activeEffects: []
		};
	}

	/** Run the complete combat and return results. */
	run(): CombatResult {
		const abilityActivations: Record<string, number> = {};

		// Check survival before starting a round, so a combat decided in round k
		// reports exactly k rounds.
		while (
			this.state.roundNumber < MAX_ROUNDS &&
			this.state.charAWounds > 0 &&
			this.state.charBWounds > 0
		) {
			this.state.roundNumber++;

			// Resolve the round
			this.resolveRound(abilityActivations);

			// Charge persists only if toggled, and only after round 1
			if (this.state.roundNumber === 1 && !this.chargePersists) {
				this.state.chargeA = false;
				this.state.chargeB = false;
			}
		}

		return this.createResult(abilityActivations);
	}

	private resolveRound(abilityActivations: Record<string, number>): void {
		const aAlive = this.state.charAWounds > 0;
		const bAlive = this.state.charBWounds > 0;
		if (!aAlive || !bAlive) return;

		// Compute effective stats for this round
		const statsA = computeEffectiveStats(this.charA, this.state.chargeA, this.state.roundNumber);
		const statsB = computeEffectiveStats(this.charB, this.state.chargeB, this.state.roundNumber);

		// Determine initiative order
		const initOrder = this.determineInitiative(statsA, statsB);

		if (initOrder === 'simultaneous') {
			// Both strike at the same time — both can kill each other
			const dmgAByB = this.resolveAttacks(
				this.charB,
				this.charA,
				statsB,
				statsA,
				abilityActivations
			);
			const dmgBByA = this.resolveAttacks(
				this.charA,
				this.charB,
				statsA,
				statsB,
				abilityActivations
			);

			this.state.charAWounds = Math.max(0, this.state.charAWounds - dmgAByB);
			this.state.charBWounds = Math.max(0, this.state.charBWounds - dmgBByA);
		} else {
			const [first, second] = initOrder;

			// First actor strikes
			if (first === 'A' && this.state.charAWounds > 0) {
				const dmg = this.resolveAttacks(this.charA, this.charB, statsA, statsB, abilityActivations);
				this.state.charBWounds = Math.max(0, this.state.charBWounds - dmg);
			} else if (first === 'B' && this.state.charBWounds > 0) {
				const dmg = this.resolveAttacks(this.charB, this.charA, statsB, statsA, abilityActivations);
				this.state.charAWounds = Math.max(0, this.state.charAWounds - dmg);
			}

			// Second actor strikes (if still alive)
			if (second === 'A' && this.state.charAWounds > 0) {
				const dmg = this.resolveAttacks(this.charA, this.charB, statsA, statsB, abilityActivations);
				this.state.charBWounds = Math.max(0, this.state.charBWounds - dmg);
			} else if (second === 'B' && this.state.charBWounds > 0) {
				const dmg = this.resolveAttacks(this.charB, this.charA, statsB, statsA, abilityActivations);
				this.state.charAWounds = Math.max(0, this.state.charAWounds - dmg);
			}
		}

		// End of round effects
		this.state.charAWounds = this.regenerate(
			this.charA,
			this.state.charAWounds,
			statsA,
			abilityActivations
		);
		this.state.charBWounds = this.regenerate(
			this.charB,
			this.state.charBWounds,
			statsB,
			abilityActivations
		);
	}

	/** Determine who strikes first. Returns 'simultaneous' or [first, second]. */
	private determineInitiative(
		statsA: EffectiveStats,
		statsB: EffectiveStats
	): 'simultaneous' | ['A', 'B'] | ['B', 'A'] {
		// Charge bonus: the charger adds chargeBonus to its Initiative while its
		// charge is active (round 1, or every round if chargePersists).
		// Rules note: the exact TOW strike-order treatment of chargers is modelled
		// as this user-set Initiative bonus; a large bonus (e.g. +10) reproduces a
		// strict "chargers strike first" reading.
		let initA = statsA.initiative;
		let initB = statsB.initiative;

		if (this.state.chargeA) initA += this.chargeBonus;
		if (this.state.chargeB) initB += this.chargeBonus;

		if (initA > initB) return ['A', 'B'];
		if (initB > initA) return ['B', 'A'];
		return 'simultaneous';
	}

	/** Resolve all attacks for one actor against a defender. Returns total damage dealt. */
	private resolveAttacks(
		attacker: Character,
		defender: Character,
		attackerStats: EffectiveStats,
		defenderStats: EffectiveStats,
		abilityActivations: Record<string, number>
	): number {
		let totalDamage = 0;
		const attackCount = attackerStats.attacks;

		const onActivate = (id: string) => {
			abilityActivations[id] = (abilityActivations[id] || 0) + 1;
		};

		for (let i = 0; i < attackCount; i++) {
			totalDamage += resolveSingleAttack(
				this.rng,
				attacker,
				defender,
				attackerStats,
				defenderStats,
				onActivate
			);
		}

		return totalDamage;
	}

	/**
	 * Regeneration (per data/gift-traits.json): at the end of each round a
	 * surviving character recovers 1 wound on a 4+, up to its starting Wounds.
	 */
	private regenerate(
		char: Character,
		wounds: number,
		stats: EffectiveStats,
		abilityActivations: Record<string, number>
	): number {
		if (!stats.hasRegeneration || wounds <= 0 || wounds >= char.wounds) return wounds;
		if (this.rng.rollD6() < 4) return wounds;
		abilityActivations['regeneration'] = (abilityActivations['regeneration'] || 0) + 1;
		return wounds + 1;
	}

	private createResult(abilityActivations: Record<string, number>): CombatResult {
		const aAlive = this.state.charAWounds > 0;
		const bAlive = this.state.charBWounds > 0;

		let winner: Winner;
		if (aAlive && bAlive) {
			winner = 'draw';
		} else if (!aAlive && !bAlive) {
			winner = 'mutual';
		} else if (aAlive) {
			winner = 'A';
		} else {
			winner = 'B';
		}

		return {
			winner,
			rounds: this.state.roundNumber,
			// Damage dealt BY each side is the wounds the opponent lost.
			damageDealtA: this.charB.wounds - this.state.charBWounds,
			damageDealtB: this.charA.wounds - this.state.charAWounds,
			remainingWoundsA: this.state.charAWounds,
			remainingWoundsB: this.state.charBWounds,
			abilityActivations
		};
	}
}
