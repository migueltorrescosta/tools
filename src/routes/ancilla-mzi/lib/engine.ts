import { FakeAncillaEngine } from '$lib/ancilla-mzi/fake-engine';
import type { AncillaEngine } from '$lib/ancilla-mzi/types';

/** The engine the page drives. Swap in the worker engine here once it exists. */
export function createEngine(): AncillaEngine {
	return new FakeAncillaEngine();
}
