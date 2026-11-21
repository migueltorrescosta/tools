import { score, summarise, type Score } from './score.js';
import type { Run } from './types.js';

export interface ScoredRun {
	run: Run;
	score: Score;
}

/** Score every run once; runs that cannot be scored (aborted) are dropped. */
export function scoreAll(runs: readonly Run[]): ScoredRun[] {
	return runs.flatMap((run) => {
		const s = score(run.responses, run.firstFocal);
		return s ? [{ run, score: s }] : [];
	});
}

export interface Association {
	labels: Run['labels'];
	/** Mean D of the counted runs: positive links the first group with the first attribute. */
	mean: number;
	n: number;
	/** 95% interval of the mean, from 3 counted runs. */
	ci?: [number, number];
}

/**
 * One association per comparison (same labels), over the counted runs of every input,
 * in the order each comparison was first taken. Runs flagged as too fast are left out.
 */
export function associations(scored: readonly ScoredRun[]): Association[] {
	const groups = new Map<string, { labels: Run['labels']; ds: number[] }>();
	for (const { run, score } of scored) {
		if (score.flagged) continue;
		const key = JSON.stringify(run.labels);
		const g = groups.get(key) ?? { labels: run.labels, ds: [] };
		g.ds.push(score.d);
		groups.set(key, g);
	}
	return [...groups.values()].map(({ labels, ds }) => ({ labels, n: ds.length, ...summarise(ds) }));
}
