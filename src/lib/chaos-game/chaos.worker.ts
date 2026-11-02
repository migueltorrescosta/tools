/** Web Worker of the Chaos Game: a `ChaosRunner` fed by messages (see `worker-engine.ts`). */
import { ChaosRunner, type FromWorker, type ToWorker } from './worker-engine';

// A MessageChannel macrotask yields to incoming messages between chunks without setTimeout's clamping
const channel = new MessageChannel();
const queue: (() => void)[] = [];
channel.port1.onmessage = () => queue.shift()?.();

const runner = new ChaosRunner(
	(msg: FromWorker, transfer?: Transferable[]) => self.postMessage(msg, { transfer }),
	(fn) => {
		queue.push(fn);
		channel.port2.postMessage(null);
	}
);

self.onmessage = (e: MessageEvent<ToWorker>) => runner.handle(e.data);
