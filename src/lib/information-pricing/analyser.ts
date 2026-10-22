/**
 * Main-thread client of the two analysis workers. `analyse` copies the inputs,
 * rewards and optimal rewards to the tree worker, then lends the scenario
 * columns to the analysis worker (they are detached until the promise
 * settles), reports each part as it arrives, and resolves with the full
 * analysis and the returned scenarios. `retree` regrows only the tree, on the
 * copy the tree worker kept.
 */
import type { WorkerLike } from '$lib/worker-pool';
import {
	mergeParts,
	type Analysis,
	type AnalysisOptions,
	type MainPart,
	type PartialAnalysis,
	type TreeResult,
	type VoiPart
} from './analysis';
import {
	scenarioBuffers,
	treeData,
	type FromAnalysis,
	type FromTree,
	type ToAnalysis,
	type ToTree
} from './analysis-host';
import type { Scenarios } from './types';

export interface AnalysisResult {
	scenarios: Scenarios;
	analysis: Analysis;
}

/** The parts of an analysis, in the order the main thread usually gets them. */
export type AnalysisStep = 'main' | 'voi' | 'tree';

export interface AnalysisListener {
	/** The analysis so far: after the main part, then after each later part. */
	partial?(analysis: PartialAnalysis): void;
	/** Fraction (0–1) of a step done; 1 once its part is in. */
	progress?(step: AnalysisStep, fraction: number): void;
}

export interface Analyser {
	/** Analyse `scenarios` (lent to the analysis worker until the promise settles). */
	analyse(
		scenarios: Scenarios,
		options: AnalysisOptions,
		listener?: AnalysisListener
	): Promise<AnalysisResult>;
	/**
	 * Regrow only the policy tree. The tree worker keeps a copy of the set the
	 * last `analyse` returned; any other set is copied to it first.
	 */
	retree(
		scenarios: Scenarios,
		options: AnalysisOptions,
		listener?: AnalysisListener
	): Promise<TreeResult>;
	/** Abandon the jobs in flight: both workers are terminated and their promises never settle. */
	cancel(): void;
	dispose(): void;
}

/** A worker that accepts a transfer list, as `Worker` does. */
export interface AnalysisWorker extends WorkerLike<ToAnalysis, FromAnalysis> {
	postMessage(msg: ToAnalysis, options?: StructuredSerializeOptions): void;
}

export type TreeWorker = WorkerLike<ToTree, FromTree>;

interface Job {
	listener: AnalysisListener;
	reject: (e: Error) => void;
	/** Set for `analyse` jobs. */
	resolve?: (r: AnalysisResult) => void;
	/** Set for `retree` jobs. */
	resolveTree?: (t: TreeResult) => void;
	main: MainPart | null;
	voi: VoiPart | null;
	tree: TreeResult | null;
	scenarios: Scenarios | null;
}

export function createAnalyser(
	createWorker: () => AnalysisWorker,
	createTreeWorker: () => TreeWorker
): Analyser {
	let worker: AnalysisWorker | null = null;
	let treeWorker: TreeWorker | null = null;
	/** The set the tree worker holds a copy of. */
	let kept: Scenarios | null = null;
	let nextId = 0;
	const jobs = new Map<number, Job>();

	const failAll = (message: string) => {
		for (const job of jobs.values()) job.reject(new Error(message));
		jobs.clear();
	};

	const fail = (id: number, message: string) => {
		jobs.get(id)?.reject(new Error(message));
		jobs.delete(id);
	};

	/** Report the analysis so far, and settle the job once every part is in. */
	const advance = (id: number, job: Job) => {
		const partial = mergeParts(job.main, job.voi, job.tree);
		if (partial) job.listener.partial?.(partial);
		if (!job.main || !job.voi || !job.tree || !job.scenarios) return;
		jobs.delete(id);
		kept = job.scenarios;
		job.resolve?.({ scenarios: job.scenarios, analysis: partial as Analysis });
	};

	const ensureWorker = () => {
		if (worker) return worker;
		const w = createWorker();
		w.onmessage = ({ data }) => {
			const job = jobs.get(data.id);
			if (!job) return;
			switch (data.type) {
				case 'main':
					job.main = data.part;
					job.listener.progress?.('main', 1);
					return advance(data.id, job);
				case 'progress':
					return job.listener.progress?.('voi', data.done / data.total);
				case 'voi':
					job.voi = data.part;
					job.scenarios = data.scenarios;
					job.listener.progress?.('voi', 1);
					return advance(data.id, job);
				case 'error':
					return fail(data.id, data.message);
			}
		};
		w.onerror = (e) => failAll(e.message || 'Analysis worker error');
		return (worker = w);
	};

	const ensureTreeWorker = () => {
		if (treeWorker) return treeWorker;
		const w = createTreeWorker();
		w.onmessage = ({ data }) => {
			const job = jobs.get(data.id);
			if (!job) return;
			switch (data.type) {
				case 'progress':
					return job.listener.progress?.('tree', data.fraction);
				case 'tree':
					job.tree = data.tree;
					job.listener.progress?.('tree', 1);
					if (job.resolveTree) {
						jobs.delete(data.id);
						return job.resolveTree(data.tree);
					}
					return advance(data.id, job);
				case 'error':
					return fail(data.id, data.message);
			}
		};
		w.onerror = (e) => {
			kept = null;
			failAll(e.message || 'Tree worker error');
		};
		return (treeWorker = w);
	};

	const terminate = () => {
		for (const w of [worker, treeWorker]) {
			if (!w) continue;
			w.onmessage = null;
			w.onerror = null;
			w.terminate();
		}
		worker = treeWorker = null;
		kept = null;
		jobs.clear();
	};

	return {
		analyse(scenarios, options, listener = {}) {
			const w = ensureWorker();
			const t = ensureTreeWorker();
			const id = nextId++;
			return new Promise((resolve, reject) => {
				jobs.set(id, {
					listener,
					resolve,
					reject,
					main: null,
					voi: null,
					tree: null,
					scenarios: null
				});
				kept = null;
				// Copy to the tree worker first: the transfer below detaches the columns.
				t.postMessage({ type: 'tree', id, data: treeData(scenarios), options });
				w.postMessage(
					{ type: 'analyse', id, scenarios, options },
					{ transfer: scenarioBuffers(scenarios) }
				);
			});
		},
		retree(scenarios, options, listener = {}) {
			const t = ensureTreeWorker();
			const id = nextId++;
			return new Promise((resolveTree, reject) => {
				jobs.set(id, {
					listener,
					resolveTree,
					reject,
					main: null,
					voi: null,
					tree: null,
					scenarios: null
				});
				const data = kept === scenarios ? undefined : treeData(scenarios);
				kept = scenarios;
				t.postMessage({ type: 'tree', id, data, options });
			});
		},
		cancel: terminate,
		dispose: terminate
	};
}
