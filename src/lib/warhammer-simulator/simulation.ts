import type { Character, CombatResult, SimulationResults, Winner } from './types';
import { SeededRNG } from './rng';
import { CombatEngine } from './combat';

/**
 * MonteCarloController runs N simulations of the same matchup
 * and aggregates the results into statistical summaries.
 */
export class MonteCarloController {
	private charA: Character;
	private charB: Character;
	private baseSeed: number;
	private chargePersists: boolean;
	private chargeBonus: number;

	constructor(
		charA: Character,
		charB: Character,
		baseSeed: number,
		chargePersists = false,
		chargeBonus = 3
	) {
		this.charA = charA;
		this.charB = charB;
		this.baseSeed = baseSeed;
		this.chargePersists = chargePersists;
		this.chargeBonus = chargeBonus;
	}

	/**
	 * Run N simulations and return aggregated results.
	 */
	run(n: number): SimulationResults {
		const results: CombatResult[] = [];

		for (let i = 0; i < n; i++) {
			const rng = new SeededRNG(this.baseSeed + i);
			const engine = new CombatEngine(
				this.charA,
				this.charB,
				rng,
				this.chargePersists,
				this.chargeBonus
			);
			results.push(engine.run());
		}

		return this.aggregate(results, n);
	}

	/**
	 * Run simulations in batches (useful for worker progress reporting).
	 * Returns the results for this batch only.
	 */
	runBatch(startIndex: number, batchSize: number): CombatResult[] {
		const results: CombatResult[] = [];
		for (let i = 0; i < batchSize; i++) {
			const rng = new SeededRNG(this.baseSeed + startIndex + i);
			const engine = new CombatEngine(
				this.charA,
				this.charB,
				rng,
				this.chargePersists,
				this.chargeBonus
			);
			results.push(engine.run());
		}
		return results;
	}

	/**
	 * Aggregate combat results into summary statistics.
	 */
	private aggregate(results: CombatResult[], totalRuns: number): SimulationResults {
		let winsA = 0;
		let winsB = 0;
		let mutualKills = 0;
		let draws = 0;
		let totalRounds = 0;
		let totalDamageA = 0;
		let totalDamageB = 0;
		const totalWoundsA = this.charA.wounds;
		const totalWoundsB = this.charB.wounds;

		// For histograms
		const maxRounds = results.reduce((max, r) => Math.max(max, r.rounds), 1);
		const roundDist = new Array(maxRounds).fill(0);
		const damageDistA: number[] = [];
		const damageDistB: number[] = [];
		const remWoundsA: number[] = [];
		const remWoundsB: number[] = [];
		const survivalCountA: number[] = new Array(maxRounds + 1).fill(0);
		const survivalCountB: number[] = new Array(maxRounds + 1).fill(0);
		// Everyone starts alive at round 0
		survivalCountA[0] = totalRuns;
		survivalCountB[0] = totalRuns;
		const abilityFreq: Record<string, number> = {};

		for (const result of results) {
			switch (result.winner) {
				case 'A':
					winsA++;
					break;
				case 'B':
					winsB++;
					break;
				case 'mutual':
					mutualKills++;
					break;
				case 'draw':
					draws++;
					break;
			}

			totalRounds += result.rounds;
			totalDamageA += result.damageDealtA;
			totalDamageB += result.damageDealtB;

			// Round distribution (1-indexed to 0-indexed)
			const idx = Math.min(result.rounds - 1, maxRounds - 1);
			roundDist[idx] = (roundDist[idx] || 0) + 1;

			damageDistA.push(result.damageDealtA);
			damageDistB.push(result.damageDealtB);
			remWoundsA.push(result.remainingWoundsA);
			remWoundsB.push(result.remainingWoundsB);

			// Survival curves: track how many survived through each round
			// (r=0 is already set to totalRuns — everyone starts alive)
			for (let r = 1; r <= result.rounds && r <= maxRounds; r++) {
				if (result.remainingWoundsA > 0 || result.winner === 'A') {
					survivalCountA[r]++;
				}
				if (result.remainingWoundsB > 0 || result.winner === 'B') {
					survivalCountB[r]++;
				}
			}

			// Ability activation frequencies
			for (const [ability, count] of Object.entries(result.abilityActivations)) {
				abilityFreq[ability] = (abilityFreq[ability] || 0) + (count > 0 ? 1 : 0);
			}
		}

		// Convert survival counts to fractions
		const survivalA = survivalCountA.map((c) => c / totalRuns);
		const survivalB = survivalCountB.map((c) => c / totalRuns);

		return {
			totalRuns,
			winRateA: winsA / totalRuns,
			winRateB: winsB / totalRuns,
			mutualKillRate: mutualKills / totalRuns,
			drawRate: draws / totalRuns,
			avgRounds: totalRounds / totalRuns,
			roundDistribution: roundDist,
			maxRounds,
			avgDamageA: totalDamageA / totalRuns,
			avgDamageB: totalDamageB / totalRuns,
			damageDistributionA: damageDistA,
			damageDistributionB: damageDistB,
			remainingWoundsA: remWoundsA,
			remainingWoundsB: remWoundsB,
			survivalA,
			survivalB,
			abilityFrequencies: abilityFreq,
			seedUsed: this.baseSeed
		};
	}
}
