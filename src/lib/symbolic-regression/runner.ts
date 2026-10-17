/** Single-thread, deterministic search for tests and benchmarks. */
import { Island, type IslandOptions } from './island';
import { buildFront } from './rescore';
import type { FrontEntry, PreparedData, SearchSettings } from './types';

export interface RunOptions {
	iterations: number;
	islandOptions?: Partial<IslandOptions>;
}

/** Runs one island for a fixed number of iterations and returns the rescored front. */
export function runSearch(
	data: PreparedData,
	settings: SearchSettings,
	{ iterations, islandOptions }: RunOptions
): FrontEntry[] {
	const island = new Island(data, settings, settings.seed, islandOptions);
	for (let i = 0; i < iterations; i++) island.step();
	return buildFront(
		island.hallOfFame().map((h) => h.expr),
		data
	);
}
