/** Helpers shared by the tools that run their engine on a pool of Web Workers. */

/** The part of `Worker` an engine uses, so specs can pass an in-process fake. */
export interface WorkerLike<In, Out> {
	postMessage(msg: In): void;
	onmessage: ((e: MessageEvent<Out>) => void) | null;
	onerror: ((e: ErrorEvent) => void) | null;
	terminate(): void;
}

/** `min(hardwareConcurrency − 1, 4)`, at least 1. */
export function defaultWorkerCount(
	hc: number | undefined = typeof navigator === 'undefined'
		? undefined
		: navigator.hardwareConcurrency
): number {
	if (!hc || !Number.isFinite(hc)) return 1;
	return Math.max(1, Math.min(Math.floor(hc) - 1, 4));
}

/** Most workers any tool starts, whatever a share link or input asks for (the inputs' max). */
export const MAX_WORKERS = 16;

/** `n` floored into `[1, MAX_WORKERS]`; 1 when it isn't a finite number. */
export const clampWorkers = (n: number): number =>
	Number.isFinite(n) ? Math.min(MAX_WORKERS, Math.max(1, Math.floor(n))) : 1;
