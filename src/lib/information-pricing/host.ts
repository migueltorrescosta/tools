/**
 * The worker side of the simulation protocol, free of worker globals so specs
 * run it in-process. `simulate.worker.ts` wires it to `self`.
 */
import { buildKernel, type Kernel } from './formula/codegen';
import { simulateChunk, type Chunk, type InputSpec } from './simulate';

export type ToWorker =
	| {
			type: 'init';
			inputs: InputSpec[];
			slotCount: number;
			decisions: number;
			/** Kernel source from `kernelSource`; checked again before `new Function`. */
			source: string;
	  }
	| { type: 'chunk'; seed: number; k: number; rows: number };

export type FromWorker =
	{ type: 'chunk'; k: number; chunk: Chunk } | { type: 'error'; message: string };

/** Returns the message handler of one simulation worker; `post` sends replies (with transfers). */
export function createSimulationHost(
	post: (msg: FromWorker, transfer: Transferable[]) => void
): (msg: ToWorker) => void {
	let setup: Extract<ToWorker, { type: 'init' }> | null = null;
	let kernel: Kernel | null = null;
	return (msg) => {
		try {
			if (msg.type === 'init') {
				setup = msg;
				kernel = buildKernel(msg.source);
				return;
			}
			if (!setup || !kernel) throw new Error('chunk before init');
			const chunk = simulateChunk(
				setup.inputs,
				setup.slotCount,
				setup.decisions,
				kernel,
				msg.seed,
				msg.k,
				msg.rows
			);
			post({ type: 'chunk', k: msg.k, chunk }, [
				...chunk.cols.map((c) => c.buffer),
				...chunk.rewards.map((c) => c.buffer)
			]);
		} catch (err) {
			post({ type: 'error', message: err instanceof Error ? err.message : String(err) }, []);
		}
	};
}
