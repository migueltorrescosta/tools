import type { Character, Charger, CombatResult, SimulationResults } from './types';
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
	private charger: Charger;

	constructor(charA: Character, charB: Character, baseSeed: number, charger: Charger = 'none') {
		this.charA = charA;
		this.charB = charB;
		this.baseSeed = baseSeed;
		this.charger = charger;
	}

	/**
	 * Run N simulations and return aggregated results.
	 */
	run(n: number): SimulationResults {
		const results: CombatResult[] = [];

		for (let i = 0; i < n; i++) {
			const rng = new SeededRNG(this.baseSeed + i);
			const engine = new CombatEngine(this.charA, this.charB, rng, this.charger);
			results.push(engine.run());
		}

		return aggregateResults(results, n, this.baseSeed);
	}

	/**
	 * Run simulations in batches (useful for worker progress reporting).
	 * Returns the results for this batch only.
	 */
	runBatch(startIndex: number, batchSize: number): CombatResult[] {
		const results: CombatResult[] = [];
		for (let i = 0; i < batchSize; i++) {
			const rng = new SeededRNG(this.baseSeed + startIndex + i);
			const engine = new CombatEngine(this.charA, this.charB, rng, this.charger);
			results.push(engine.run());
		}
		return results;
	}
}

/**
 * Increment the count for `value` in a histogram indexed by value, growing it
 * as needed. O(1) per call, so histograms stay safe for any number of runs.
 */
export function addToHistogram(histogram: number[], value: number): void {
	while (histogram.length <= value) histogram.push(0);
	histogram[value]++;
}

/**
 * Aggregate combat results into summary statistics. Shared by
 * MonteCarloController and the Web Worker so both report identical numbers.
 */
export function aggregateResults(
	results: CombatResult[],
	totalRuns: number,
	seed: number
): SimulationResults {
	let winsA = 0;
	let winsB = 0;
	let mutualKills = 0;
	let draws = 0;
	let totalRounds = 0;
	let totalDamageA = 0;
	let totalDamageB = 0;

	// For histograms
	const maxRounds = results.reduce((max, r) => Math.max(max, r.rounds), 1);
	const roundDist = new Array(maxRounds).fill(0);
	const damageHistA: number[] = [];
	const damageHistB: number[] = [];
	const remWoundsA: number[] = [];
	const remWoundsB: number[] = [];
	// deathsA[r] = combats in which A was slain in round r (r = 1..maxRounds).
	const deathsA: number[] = new Array(maxRounds + 1).fill(0);
	const deathsB: number[] = new Array(maxRounds + 1).fill(0);
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

		addToHistogram(damageHistA, result.damageDealtA);
		addToHistogram(damageHistB, result.damageDealtB);
		remWoundsA.push(result.remainingWoundsA);
		remWoundsB.push(result.remainingWoundsB);

		if (result.deathRoundA !== null) deathsA[result.deathRoundA]++;
		if (result.deathRoundB !== null) deathsB[result.deathRoundB]++;

		// Ability activation frequencies
		for (const [ability, count] of Object.entries(result.abilityActivations)) {
			abilityFreq[ability] = (abilityFreq[ability] || 0) + (count > 0 ? 1 : 0);
		}
	}

	// Rates over zero runs are 0, never NaN.
	const rate = (count: number) => (totalRuns > 0 ? count / totalRuns : 0);

	// survival[r] = P(death round > r): alive after round r.
	const survivalCurve = (deaths: number[]) => {
		let alive = totalRuns;
		return deaths.map((d) => rate((alive -= d)));
	};

	return {
		totalRuns,
		winRateA: rate(winsA),
		winRateB: rate(winsB),
		mutualKillRate: rate(mutualKills),
		drawRate: rate(draws),
		avgRounds: rate(totalRounds),
		roundDistribution: roundDist,
		maxRounds,
		avgDamageA: rate(totalDamageA),
		avgDamageB: rate(totalDamageB),
		damageHistogramA: damageHistA,
		damageHistogramB: damageHistB,
		remainingWoundsA: remWoundsA,
		remainingWoundsB: remWoundsB,
		survivalA: survivalCurve(deathsA),
		survivalB: survivalCurve(deathsB),
		abilityFrequencies: abilityFreq,
		seedUsed: seed
	};
}

export const MIN_SIMULATIONS = 100;
export const MAX_SIMULATIONS = 100_000;

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Validate the simulation count input. Accepts only an integer in
 * [MIN_SIMULATIONS, MAX_SIMULATIONS]; an empty field (null/undefined/NaN) is rejected.
 */
export function parseSimCount(value: unknown): ParseResult {
	const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	if (typeof n !== 'number' || !Number.isInteger(n) || n < MIN_SIMULATIONS || n > MAX_SIMULATIONS) {
		return {
			ok: false,
			error: `Simulations must be a whole number from ${MIN_SIMULATIONS} to ${MAX_SIMULATIONS.toLocaleString('en-US')}`
		};
	}
	return { ok: true, value: n };
}

/** Largest seed accepted, so baseSeed + run index stays a safe integer. */
export const MAX_SEED = 2 ** 31 - 1;

/**
 * Validate an optional seed input. An empty value means "pick a random seed"
 * and returns ok with `random()`'s pick; otherwise an integer in [0, MAX_SEED].
 */
export function parseSeed(raw: string, random: () => number = Math.random): ParseResult {
	const trimmed = raw.trim();
	if (trimmed === '') return { ok: true, value: Math.floor(random() * MAX_SEED) };
	const n = Number(trimmed);
	if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(n) || n > MAX_SEED) {
		return { ok: false, error: `Seed must be a whole number from 0 to ${MAX_SEED}` };
	}
	return { ok: true, value: n };
}
