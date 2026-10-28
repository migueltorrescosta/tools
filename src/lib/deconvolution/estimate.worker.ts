/** Web Worker of the Deconvolution estimators: runs one `Task` per message (see `engine.ts`). */
import { runTask } from './estimate';
import type { FromWorker, ToWorker } from './engine';

self.onmessage = (e: MessageEvent<ToWorker>) => {
	const { id, task } = e.data;
	let msg: FromWorker;
	try {
		msg = { id, ok: true, result: runTask(task) };
	} catch (err) {
		msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
	}
	self.postMessage(msg);
};
