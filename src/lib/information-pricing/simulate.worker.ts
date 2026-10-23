/**
 * Web Worker of the Information Pricing simulation. The protocol and its
 * handler live in `host.ts`; this file only wires them to `self`.
 */
import { createSimulationHost, type FromWorker, type ToWorker } from './host';

const handle = createSimulationHost((msg: FromWorker, transfer) =>
	self.postMessage(msg, { transfer })
);

self.onmessage = (e: MessageEvent<ToWorker>) => handle(e.data);
