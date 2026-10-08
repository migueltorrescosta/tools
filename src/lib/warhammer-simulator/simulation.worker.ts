/**
 * Web Worker entry point for running Monte Carlo simulations
 * off the main thread, keeping the UI responsive.
 *
 * Messages:
 *   - Receive: SimulationJob { charA, charB, totalSimulations, seed, charger }
 *   - Send:    SimulationProgress { type: 'progress', progress, elapsedMs }
 *   - Send:    SimulationComplete { type: 'complete', results }
 */

import { MonteCarloController, aggregateResults } from './simulation';
import type { SimulationJob, CombatResult } from './types';

const PROGRESS_INTERVAL = 0.01; // report every 1%

self.onmessage = (e: MessageEvent<SimulationJob>) => {
	const { charA, charB, totalSimulations, seed, charger } = e.data;

	const controller = new MonteCarloController(charA, charB, seed, charger);
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
