/**
 * Main-thread client of the analysis worker. `analyse` lends the scenario
 * columns to the worker (they are detached until the promise settles) and
 * resolves with the analysis and the returned scenarios.
 */
import type { WorkerLike } from '$lib/worker-pool';
import type { Analysis, AnalysisOptions } from './analysis';
import { scenarioBuffers, type FromAnalysis, type ToAnalysis } from './analysis-host';
import type { Scenarios } from './types';

export interface AnalysisResult {
	scenarios: Scenarios;
	analysis: Analysis;
}

export interface Analyser {
	/** Rejects with the error message; the scenarios come back on the error too (`error.scenarios`). */
	analyse(scenarios: Scenarios, options: AnalysisOptions): Promise<AnalysisResult>;
	dispose(): void;
}

export class AnalysisError extends Error {
	constructor(
		message: string,
		readonly scenarios: Scenarios
	) {
		super(message);
	}
}

/** A worker that accepts a transfer list, as `Worker` does. */
export interface AnalysisWorker extends WorkerLike<ToAnalysis, FromAnalysis> {
	postMessage(msg: ToAnalysis, options?: StructuredSerializeOptions): void;
}

export function createAnalyser(createWorker: () => AnalysisWorker): Analyser {
	let worker: AnalysisWorker | null = null;
	let nextId = 0;
	const pending = new Map<
		number,
		{ resolve: (r: AnalysisResult) => void; reject: (e: Error) => void }
	>();

	const ensure = () => {
		if (worker) return worker;
		const w = createWorker();
		w.onmessage = ({ data }) => {
			const p = pending.get(data.id);
			if (!p) return;
			pending.delete(data.id);
			if (data.type === 'error') p.reject(new AnalysisError(data.message, data.scenarios));
			else p.resolve({ scenarios: data.scenarios, analysis: data.analysis });
		};
		w.onerror = (e) => {
			for (const p of pending.values()) p.reject(new Error(e.message || 'Analysis worker error'));
			pending.clear();
		};
		return (worker = w);
	};

	return {
		analyse(scenarios, options) {
			const w = ensure();
			const id = nextId++;
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				w.postMessage(
					{ type: 'analyse', id, scenarios, options },
					{ transfer: scenarioBuffers(scenarios) }
				);
			});
		},
		dispose() {
			worker?.terminate();
			worker = null;
			pending.clear();
		}
	};
}
