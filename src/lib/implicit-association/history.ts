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

/** A dumbbell: two names on an axis, the first placed `lean / 2` towards the axis's first end. */
export interface Dumbbell {
	names: [string, string];
	lean: number;
	association: Association;
}

/** One axis: its two ends, and the comparisons drawn on it. */
export interface Section {
	ends: [string, string];
	dumbbells: Dumbbell[];
}

/**
 * The fewest axes that show every comparison once. A comparison links a pair of groups with
 * a pair of attributes, and can be drawn on either: on the attribute axis (Good … Bad) as a
 * dumbbell between its groups, or on the group axis (Male … Female) as a dumbbell between
 * its attributes. Choosing axes is a minimum vertex cover of that bipartite graph, found
 * exactly with König's theorem; attribute axes win ties.
 */
export function sections(items: readonly Association[]): Section[] {
	const key = (pair: readonly string[]) => JSON.stringify(pair);
	const attrs = [...new Set(items.map((a) => key(a.labels.attributes)))];
	const edges = new Map(attrs.map((k) => [k, [] as string[]]));
	for (const a of items) edges.get(key(a.labels.attributes))!.push(key(a.labels.targets));

	// Maximum matching (Kuhn's augmenting paths), attribute pairs on the left.
	const matchOfTarget = new Map<string, string>();
	const augment = (attr: string, seen: Set<string>): boolean => {
		for (const t of edges.get(attr)!) {
			if (seen.has(t)) continue;
			seen.add(t);
			const owner = matchOfTarget.get(t);
			if (owner === undefined || augment(owner, seen)) {
				matchOfTarget.set(t, attr);
				return true;
			}
		}
		return false;
	};
	const matched = new Set<string>();
	for (const a of attrs) if (augment(a, new Set())) matched.add(a);

	// König: from unmatched attribute pairs, follow alternating paths; the cover is the
	// attribute pairs not reached plus the group pairs reached.
	const reachedAttrs = new Set(attrs.filter((a) => !matched.has(a)));
	const reachedTargets = new Set<string>();
	const queue = [...reachedAttrs];
	while (queue.length) {
		const a = queue.pop()!;
		for (const t of edges.get(a)!) {
			if (reachedTargets.has(t)) continue;
			reachedTargets.add(t);
			const next = matchOfTarget.get(t);
			if (next !== undefined && !reachedAttrs.has(next)) {
				reachedAttrs.add(next);
				queue.push(next);
			}
		}
	}
	const attrAxes = new Set(attrs.filter((a) => !reachedAttrs.has(a)));

	const byAxis = new Map<string, Section>();
	for (const a of items) {
		const { targets: t, attributes: at } = a.labels;
		const onAttr = attrAxes.has(key(at));
		const ends = onAttr ? at : t;
		const axis = byAxis.get(key(ends)) ?? { ends, dumbbells: [] };
		axis.dumbbells.push({ names: onAttr ? t : at, lean: a.mean, association: a });
		byAxis.set(key(ends), axis);
	}
	return [...byAxis.values()]
		.map((s) => ({
			...s,
			dumbbells: s.dumbbells.sort((x, y) => Math.abs(y.lean) - Math.abs(x.lean))
		}))
		.sort((x, y) => y.dumbbells.length - x.dumbbells.length);
}
