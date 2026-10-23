/**
 * Web Worker of the Information Pricing analysis. The protocol and its handler
 * live in `analysis-host.ts`; this file only wires them to `self`.
 */
import { createAnalysisHost, type FromAnalysis, type ToAnalysis } from './analysis-host';

const handle = createAnalysisHost((msg: FromAnalysis, transfer) =>
	self.postMessage(msg, { transfer })
);

self.onmessage = (e: MessageEvent<ToAnalysis>) => handle(e.data);
