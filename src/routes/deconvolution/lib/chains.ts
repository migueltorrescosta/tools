/**
 * Runs several Markov chains through the estimator pool in chunks, chains in
 * parallel and each chain's chunks in turn, so the page can show progress and
 * the pool's `stop` ends them. Shared by the Bayesian fit and the NPMLE
 * posterior, in 1D and 2D.
 */
import type { EstimatePool } from '$lib/deconvolution/engine';
import type { Task, TaskResult } from '$lib/deconvolution/estimate';

export interface ChainRun<State, Draw> {
	chains: number;
	/** Chunks per chain. */
	chunks: number;
	/** The task for chunk `k` of chain `c`, from that chain's state (null at the start). */
	task(c: number, k: number, state: State | null): Task;
	/** The chain's next state and chunk `k`'s draws. */
	read(r: TaskResult, k: number): { state: State; draws: Draw[] };
	/** Called after every chunk with the chunks done so far, out of chains × chunks. */
	progress(done: number): void;
}

/** Each chain's draws, in order. */
export async function runChains<State, Draw>(
	pool: EstimatePool,
	run: ChainRun<State, Draw>
): Promise<Draw[][]> {
	let done = 0;
	return Promise.all(
		Array.from({ length: run.chains }, async (_, c) => {
			let state: State | null = null;
			const draws: Draw[] = [];
			for (let k = 0; k < run.chunks; k++) {
				const r = run.read(await pool.run(run.task(c, k, state)), k);
				state = r.state;
				draws.push(...r.draws);
				run.progress(++done);
			}
			return draws;
		})
	);
}
