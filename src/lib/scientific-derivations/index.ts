import { decoherenceCancellation } from './papers/decoherence-cancellation';
import type { Paper } from './types';

export type { Derivation, EquationNode, FactEdge, NodeKind, Paper } from './types';
export { edgeId } from './types';

/** Every paper the tool offers, in dropdown order. */
export const PAPERS: Paper[] = [decoherenceCancellation];
