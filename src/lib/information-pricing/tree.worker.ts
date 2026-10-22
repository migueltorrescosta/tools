/**
 * Web Worker of the Information Pricing policy tree. The protocol and its
 * handler live in `analysis-host.ts`; this file only wires them to `self`.
 */
import { createTreeHost, type FromTree, type ToTree } from './analysis-host';

const handle = createTreeHost((msg: FromTree) => self.postMessage(msg));

self.onmessage = (e: MessageEvent<ToTree>) => handle(e.data);
