/**
 * Web Worker hosting one search island. The protocol (`ToWorker`/`FromWorker`)
 * and its handler live in `host.ts`; this file only wires them to `self`.
 */
import { createIslandHost, type FromWorker, type ToWorker } from './host';

const handle = createIslandHost((msg: FromWorker) => self.postMessage(msg));

self.onmessage = (e: MessageEvent<ToWorker>) => handle(e.data);
