import type { Character, CombatResult, CombatState, Winner } from './types';
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
		chargeBonus = 3
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
			chargeA: true,
			chargeB: true,
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
	}

	/** Determine who strikes first. Returns 'simultaneous' or [first, second]. */
	private determineInitiative(
		statsA: EffectiveStats,
		statsB: EffectiveStats
	): 'simultaneous' | ['A', 'B'] | ['B', 'A'] {
		// Apply charge bonus to initiative
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

		for (let i = 0; i < attackCount; i++) {
			const dmg = resolveSingleAttack(
				this.rng,
				attacker,
				defender,
				attackerStats,
				defenderStats,
				this.state.chargeA // simplified: assumes attacker is A for charge check
			);
			totalDamage += dmg;

			if (dmg > 0) {
				// Track ability activations (simplified)
				if (attackerStats.hasKillingBlow) {
					abilityActivations['killing-blow'] = (abilityActivations['killing-blow'] || 0) + 1;
				}
				if (attackerStats.hasPoison) {
					abilityActivations['poisoned-attacks'] =
						(abilityActivations['poisoned-attacks'] || 0) + 1;
				}
			}
		}

		return totalDamage;
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
