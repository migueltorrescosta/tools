/**
 * Runs several Markov chains through the estimator pool in chunks, chains in
 * parallel and each chain's chunks in turn, so the page can show progress and
 * the pool's `stop` ends them. Shared by the Bayesian fit and the NPMLE
 * posterior, in 1D and 2D; and the parameter table's Bayesian columns.
 */
import type { EstimatePool } from '$lib/deconvolution/engine';
import type { Column } from '$lib/ui';
import type { ParamPosterior } from '$lib/deconvolution/bayes';
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

const fmt = (v: number | undefined, digits = 3) =>
	v === undefined || !Number.isFinite(v) ? '–' : Number(v.toPrecision(digits)).toLocaleString('en');

/** A parameter table row's Bayesian cells. */
export type PosteriorCells = {
	median?: number;
	cri?: string;
	rhat?: number;
	ess?: number;
};

/** The Bayesian cells of parameter `p`, empty when there is no Bayesian fit. */
export function posteriorCells(
	bayes: readonly ParamPosterior[] | null,
	p: { role: string; component: number | null; key: string }
): PosteriorCells {
	const b = bayes?.find((q) => q.role === p.role && q.component === p.component && q.key === p.key);
	if (!b) return {};
	return { median: b.median, cri: `${fmt(b.lower)} – ${fmt(b.upper)}`, rhat: b.rhat, ess: b.ess };
}

/** The parameter table's extra columns once a Bayesian fit has run. */
export function posteriorColumns<R extends PosteriorCells>(): Column<R>[] {
	return [
		{
			key: 'median',
			label: 'Posterior median',
			align: 'right',
			format: (v) => fmt(v as number | undefined, 4)
		},
		{ key: 'cri', label: '95% credible', align: 'right', format: (v) => (v as string) ?? '–' },
		{ key: 'rhat', label: 'R̂', align: 'right', format: (v) => fmt(v as number | undefined, 4) },
		{ key: 'ess', label: 'ESS', align: 'right', format: (v) => fmt(v as number | undefined, 2) }
	];
}
