/** Web Worker of the Chaos Game: a `ChaosRunner` fed by messages (see `worker-engine.ts`). */
import { ChaosRunner, type FromWorker, type ToWorker } from './worker-engine';

// setTimeout yields to incoming messages between chunks
const runner = new ChaosRunner(
	(msg: FromWorker, transfer?: Transferable[]) => self.postMessage(msg, { transfer }),
	(fn) => setTimeout(fn)
);

self.onmessage = (e: MessageEvent<ToWorker>) => runner.handle(e.data);
