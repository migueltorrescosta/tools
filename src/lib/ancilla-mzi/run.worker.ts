/**
 * Web Worker of the Ancilla vs MZI engine. The protocol (`ToWorker`/`FromWorker`)
 * and its handler live in `host.ts`; this file only wires them to `self`.
 */
import { createAncillaHost, type FromWorker, type ToWorker } from './host';

const handle = createAncillaHost((msg: FromWorker) => self.postMessage(msg));

self.onmessage = (e: MessageEvent<ToWorker>) => handle(e.data);
