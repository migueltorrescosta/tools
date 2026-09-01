/**
 * Web Worker entry point for running Monte Carlo simulations
 * off the main thread, keeping the UI responsive.
 *
 * Messages:
 *   - Receive: SimulationJob { charA, charB, totalSimulations, seed, chargePersists, chargeBonus }
 *   - Send:    SimulationProgress { type: 'progress', progress, elapsedMs }
 *   - Send:    SimulationComplete { type: 'complete', results }
 */

import { MonteCarloController } from './simulation';
import type { SimulationJob, SimulationResults, CombatResult } from './types';

const PROGRESS_INTERVAL = 0.01; // report every 1%

self.onmessage = (e: MessageEvent<SimulationJob>) => {
	const { charA, charB, totalSimulations, seed, chargePersists, chargeBonus } = e.data;

	const controller = new MonteCarloController(charA, charB, seed, chargePersists, chargeBonus);
	const batchSize = Math.max(1, Math.floor(totalSimulations * PROGRESS_INTERVAL));

	const allResults: CombatResult[] = [];
	let lastProgressReport = 0;
	const startTime = performance.now();

	for (let i = 0; i < totalSimulations; i += batchSize) {
		const actualBatch = Math.min(batchSize, totalSimulations - i);
		const batchResults = controller.runBatch(i, actualBatch);
		allResults.push(...batchResults);

		const progress = (i + actualBatch) / totalSimulations;

		if (progress - lastProgressReport >= PROGRESS_INTERVAL || i + actualBatch >= totalSimulations) {
			lastProgressReport = progress;
			self.postMessage({
				type: 'progress',
				progress,
				elapsedMs: performance.now() - startTime
			});
		}
	}

	const aggregated = aggregateResults(allResults, totalSimulations, seed);

	self.postMessage({
		type: 'complete',
		results: aggregated
	});
};

function aggregateResults(
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

	const maxRounds = Math.max(...results.map((r) => r.rounds), 1);
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

		const idx = Math.min(result.rounds - 1, maxRounds - 1);
		roundDist[idx] = (roundDist[idx] || 0) + 1;

		damageDistA.push(result.damageDealtA);
		damageDistB.push(result.damageDealtB);
		remWoundsA.push(result.remainingWoundsA);
		remWoundsB.push(result.remainingWoundsB);

		// r=0 is already set to totalRuns – everyone starts alive
		for (let r = 1; r <= result.rounds && r <= maxRounds; r++) {
			if (result.remainingWoundsA > 0 || result.winner === 'A') {
				survivalCountA[r]++;
			}
			if (result.remainingWoundsB > 0 || result.winner === 'B') {
				survivalCountB[r]++;
			}
		}

		for (const [ability, count] of Object.entries(result.abilityActivations)) {
			abilityFreq[ability] = (abilityFreq[ability] || 0) + (count > 0 ? 1 : 0);
		}
	}

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
		survivalA: survivalCountA.map((c) => c / totalRuns),
		survivalB: survivalCountB.map((c) => c / totalRuns),
		abilityFrequencies: abilityFreq,
		seedUsed: seed
	};
}
