/**
 * The worker side of the analysis protocol, free of worker globals so specs
 * run it in-process. `analysis.worker.ts` wires it to `self`. The scenario
 * columns are transferred in and back out, so they are never copied.
 */
import { analyse, type Analysis, type AnalysisOptions } from './analysis';
import type { Scenarios } from './types';

export type ToAnalysis = {
	type: 'analyse';
	id: number;
	scenarios: Scenarios;
	options: AnalysisOptions;
};

export type FromAnalysis =
	| { type: 'analysis'; id: number; scenarios: Scenarios; analysis: Analysis }
	| { type: 'error'; id: number; scenarios: Scenarios; message: string };

/** Every buffer of a scenario set, for a transfer list. */
export function scenarioBuffers(s: Scenarios): ArrayBuffer[] {
	return [
		...s.inputs.map((x) => x.column.buffer),
		...s.intermediates.map((x) => x.column.buffer),
		...s.rewards.map((r) => r.buffer),
		s.optimal.buffer
	] as ArrayBuffer[];
}

export function createAnalysisHost(
	post: (msg: FromAnalysis, transfer: Transferable[]) => void
): (msg: ToAnalysis) => void {
	return ({ id, scenarios, options }) => {
		const transfer = scenarioBuffers(scenarios);
		try {
			post({ type: 'analysis', id, scenarios, analysis: analyse(scenarios, options) }, transfer);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			post({ type: 'error', id, scenarios, message }, transfer);
		}
	};
}
