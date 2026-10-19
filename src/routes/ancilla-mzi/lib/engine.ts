import { createAncillaEngine } from '$lib/ancilla-mzi/worker-engine';
import type { AncillaEngine } from '$lib/ancilla-mzi/types';

/** The engine the page drives: the worker pool. */
export function createEngine(): AncillaEngine {
	return createAncillaEngine();
}
