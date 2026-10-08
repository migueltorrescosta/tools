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
	private charger: Charger;
	private deathRoundA: number | null = null;
	private deathRoundB: number | null = null;

	constructor(charA: Character, charB: Character, rng: SeededRNG, charger: Charger = 'none') {
		this.charA = charA;
		this.charB = charB;
		this.rng = rng;
		this.charger = charger;
		this.state = {
			charAWounds: charA.wounds,
			charBWounds: charB.wounds,
			roundNumber: 0
		};
	}

	/** True while `side` is charging: only the charger, and only in round 1 (TOW). */
	private isCharging(side: 'A' | 'B'): boolean {
		return this.charger === side && this.state.roundNumber === 1;
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

			if (this.deathRoundA === null && this.state.charAWounds <= 0) {
				this.deathRoundA = this.state.roundNumber;
			}
			if (this.deathRoundB === null && this.state.charBWounds <= 0) {
				this.deathRoundB = this.state.roundNumber;
			}
		}

		return this.createResult(abilityActivations);
	}

	private resolveRound(abilityActivations: Record<string, number>): void {
		const aAlive = this.state.charAWounds > 0;
		const bAlive = this.state.charBWounds > 0;
		if (!aAlive || !bAlive) return;

		// Compute effective stats for this round
		const round = this.state.roundNumber;
		const statsA = computeEffectiveStats(this.charA, this.isCharging('A'), round, this.charB);
		const statsB = computeEffectiveStats(this.charB, this.isCharging('B'), round, this.charA);

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

	/**
	 * Determine who strikes first. Returns 'simultaneous' or [first, second].
	 * Strike order, highest priority first:
	 *   1. the charger, in round 1 only, regardless of Initiative;
	 *   2. models without Strikes Last;
	 *   3. models with Strikes Last (great weapon).
	 * Within the same priority, higher Initiative strikes first; equal
	 * Initiative strikes simultaneously.
	 * Rules note: Strikes Last overrides the charge, so a charging great-weapon
	 * wielder still strikes after its opponent.
	 */
	private determineInitiative(
		statsA: EffectiveStats,
		statsB: EffectiveStats
	): 'simultaneous' | ['A', 'B'] | ['B', 'A'] {
		const priority = (side: 'A' | 'B', stats: EffectiveStats) =>
			stats.strikesLast ? 0 : this.isCharging(side) ? 2 : 1;
		const pA = priority('A', statsA);
		const pB = priority('B', statsB);
		if (pA !== pB) return pA > pB ? ['A', 'B'] : ['B', 'A'];

		if (statsA.initiative > statsB.initiative) return ['A', 'B'];
		if (statsB.initiative > statsA.initiative) return ['B', 'A'];
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
			deathRoundA: this.deathRoundA,
			deathRoundB: this.deathRoundB,
			abilityActivations
		};
	}
}
