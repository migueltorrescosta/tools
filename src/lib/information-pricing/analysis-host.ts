/**
 * The worker side of the analysis protocols, free of worker globals so specs
 * run them in-process. Two workers share the work of one scenario set:
 *
 * - the analysis worker (`analysis.worker.ts`) is lent the scenario columns
 *   (transferred, never copied) and posts the main part, then the value of
 *   information with the scenarios back;
 * - the tree worker (`tree.worker.ts`) gets a copy of the inputs, rewards and
 *   optimal rewards, keeps it, and grows the policy tree; a later `tree`
 *   message without data regrows it on the kept copy (Update tree).
 */
import {
	analyseMain,
	analyseTree,
	analyseVoi,
	analysisContext,
	lossMatrix,
	type AnalysisOptions,
	type MainPart,
	type TreeResult,
	type VoiPart
} from './analysis';
import type { Scenarios } from './types';

export type ToAnalysis = {
	type: 'analyse';
	id: number;
	scenarios: Scenarios;
	options: AnalysisOptions;
};

export type FromAnalysis =
	| { type: 'main'; id: number; part: MainPart }
	/** Value-of-information columns done (inputs then intermediates). */
	| { type: 'progress'; id: number; done: number; total: number }
	/** The last message of a job: the scenarios come back with it. */
	| { type: 'voi'; id: number; part: VoiPart; scenarios: Scenarios }
	| { type: 'error'; id: number; scenarios: Scenarios; message: string };

/** What the tree worker keeps: copies of the columns the tree needs. */
export interface TreeData {
	n: number;
	inputs: Float64Array[];
	rewards: Float64Array[];
	optimal: Float64Array;
	decisions: string[];
}

export type ToTree = {
	type: 'tree';
	id: number;
	/** New data to keep (a copy, never transferred); omitted to regrow on the kept data. */
	data?: TreeData;
	options: AnalysisOptions;
};

export type FromTree =
	| { type: 'progress'; id: number; fraction: number }
	| { type: 'tree'; id: number; tree: TreeResult }
	| { type: 'error'; id: number; message: string };

/** Every buffer of a scenario set, for a transfer list. */
export function scenarioBuffers(s: Scenarios): ArrayBuffer[] {
	return [
		...s.inputs.map((x) => x.column.buffer),
		...s.intermediates.map((x) => x.column.buffer),
		...s.rewards.map((r) => r.buffer),
		s.optimal.buffer
	] as ArrayBuffer[];
}

/** The tree worker's data for a scenario set; the columns are shared until posted (cloned). */
export function treeData(s: Scenarios): TreeData {
	return {
		n: s.n,
		inputs: s.inputs.map((x) => x.column),
		rewards: s.rewards,
		optimal: s.optimal,
		decisions: s.decisions
	};
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createAnalysisHost(
	post: (msg: FromAnalysis, transfer: Transferable[]) => void
): (msg: ToAnalysis) => void {
	return ({ id, scenarios, options }) => {
		const transfer = scenarioBuffers(scenarios);
		try {
			const ctx = analysisContext(scenarios);
			const main = analyseMain(scenarios, options.unit, ctx);
			post({ type: 'main', id, part: main }, []);
			const voi = analyseVoi(ctx, main.summary, (done, total) =>
				post({ type: 'progress', id, done, total }, [])
			);
			post({ type: 'voi', id, part: voi, scenarios }, transfer);
		} catch (err) {
			post({ type: 'error', id, scenarios, message: message(err) }, transfer);
		}
	};
}

/** Progress messages at most this often (ms), so a deep tree does not flood the main thread. */
const TREE_PROGRESS_MS = 50;

export function createTreeHost(post: (msg: FromTree) => void): (msg: ToTree) => void {
	let kept: { inputs: Float64Array[]; loss: Float64Array; decisions: string[] } | null = null;
	return ({ id, data, options }) => {
		try {
			if (data) {
				kept = { inputs: data.inputs, loss: lossMatrix(data), decisions: data.decisions };
			}
			if (!kept) throw new Error('no scenarios to grow the tree on');
			let last = performance.now();
			const tree = analyseTree(kept.inputs, kept.loss, kept.decisions, options, (fraction) => {
				const t = performance.now();
				if (t - last < TREE_PROGRESS_MS) return;
				last = t;
				post({ type: 'progress', id, fraction });
			});
			post({ type: 'tree', id, tree });
		} catch (err) {
			post({ type: 'error', id, message: message(err) });
		}
	};
}
