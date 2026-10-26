/**
 * `SearchEngine` over N island workers. Elites migrate around a ring of islands
 * through this (main) thread; each worker refits and scores its own hall of
 * fame, so the main thread only merges fronts.
 */
import { clampWorkers, type WorkerLike as PoolWorker } from '$lib/worker-pool';
import type { FromWorker, ToWorker } from './host';
import { mergeFront, type Candidate } from './rescore';
import type { FrontEntry, PreparedData, SearchEngine, SearchEvent, SearchSettings } from './types';

type WorkerLike = PoolWorker<ToWorker, FromWorker>;

/** Seed of island `i`; island 0 uses the search seed itself. */
export function islandSeed(seed: number, i: number): number {
	let h = (seed + Math.imul(i, 0x9e3779b9)) >>> 0;
	if (i > 0) {
		h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
		h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
		h = (h ^ (h >>> 16)) >>> 0;
	}
	return h;
}

export interface WorkerEngineOptions {
	/** Interval between progress events. */
	progressMs?: number;
	/** Extra time a worker gets to report after its budget, or after Stop, before the run is ended without it. */
	graceMs?: number;
}

const now = () => performance.now();

export class WorkerSearchEngine implements SearchEngine {
	private workers: WorkerLike[] = [];
	private latest: Candidate[][] = [];
	private iterations: number[] = [];
	private idle: boolean[] = [];
	private listeners = new Set<(event: SearchEvent) => void>();
	private settings: SearchSettings | null = null;
	private progressTimer: ReturnType<typeof setInterval> | null = null;
	private graceTimer: ReturnType<typeof setTimeout> | null = null;
	private stopReason: 'budget' | 'user' | null = null;
	private startedAt = 0;
	private front: FrontEntry[] = [];
	private dirty = false;
	private progressMs: number;
	private graceMs: number;
	running = false;

	constructor(
		private createWorker: () => WorkerLike,
		{ progressMs = 250, graceMs = 5000 }: WorkerEngineOptions = {}
	) {
		this.progressMs = progressMs;
		this.graceMs = graceMs;
	}

	start(data: PreparedData, settings: SearchSettings): void {
		this.terminate();
		this.settings = settings;
		const n = clampWorkers(settings.workers);
		this.latest = Array.from({ length: n }, () => []);
		this.iterations = new Array(n).fill(0);
		this.front = [];
		for (let i = 0; i < n; i++) {
			const w = this.createWorker();
			w.onmessage = (e) => this.onMessage(w, i, e.data);
			w.onerror = (e) => this.fail(e.message || 'Worker error');
			w.postMessage({ type: 'init', data, settings, seed: islandSeed(settings.seed, i) });
			this.workers.push(w);
		}
		this.run();
	}

	stop(): void {
		if (!this.running || this.stopReason) return;
		this.stopReason = 'user';
		for (const w of this.workers) w.postMessage({ type: 'stop' });
		this.armGrace(this.graceMs);
	}

	continue(): void {
		if (this.running || this.workers.length === 0) return;
		this.run();
	}

	subscribe(listener: (event: SearchEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispose(): void {
		this.terminate();
		this.settings = null;
		this.latest = [];
		this.iterations = [];
		this.front = [];
	}

	private run(): void {
		const budgetMs = Math.max(0, (this.settings?.timeBudgetSec ?? 0) * 1000);
		this.running = true;
		this.stopReason = null;
		this.idle = this.workers.map(() => false);
		this.startedAt = now();
		for (const w of this.workers) w.postMessage({ type: 'run', budgetMs });
		this.progressTimer = setInterval(() => this.emitProgress(), this.progressMs);
		this.armGrace(budgetMs + this.graceMs);
	}

	private armGrace(ms: number): void {
		if (this.graceTimer !== null) clearTimeout(this.graceTimer);
		this.graceTimer = setTimeout(() => this.finish(), ms);
	}

	private onMessage(w: WorkerLike, i: number, msg: FromWorker): void {
		if (this.workers[i] !== w) return;
		if (msg.type === 'error') return this.fail(msg.message);
		this.latest[i] = msg.candidates;
		this.iterations[i] = msg.iterations;
		this.dirty = true;
		const n = this.workers.length;
		if (n > 1 && msg.emigrants.length > 0 && this.running && !this.stopReason) {
			this.workers[(i + 1) % n].postMessage({ type: 'immigrants', exprs: msg.emigrants });
		}
		if (msg.idle && this.running) {
			this.idle[i] = true;
			if (this.idle.every(Boolean)) this.finish();
		}
	}

	private mergedFront(): FrontEntry[] {
		if (this.dirty) {
			this.front = mergeFront(this.latest.flat());
			this.dirty = false;
		}
		return this.front;
	}

	private emitProgress(): void {
		if (!this.running) return;
		this.emit({
			type: 'progress',
			front: this.mergedFront(),
			iterations: this.iterations.reduce((a, b) => a + b, 0),
			elapsedMs: now() - this.startedAt
		});
	}

	private finish(): void {
		if (!this.running) return;
		this.clearTimers();
		this.running = false;
		const reason = this.stopReason ?? 'budget';
		this.stopReason = null;
		this.emit({ type: 'stopped', reason, front: this.mergedFront() });
	}

	/** Ends the search on a worker error; `start` is needed to search again. */
	private fail(message: string): void {
		this.terminate();
		this.emit({ type: 'error', message });
	}

	private clearTimers(): void {
		if (this.progressTimer !== null) clearInterval(this.progressTimer);
		if (this.graceTimer !== null) clearTimeout(this.graceTimer);
		this.progressTimer = null;
		this.graceTimer = null;
	}

	private terminate(): void {
		this.clearTimers();
		for (const w of this.workers) {
			w.onmessage = null;
			w.onerror = null;
			w.terminate();
		}
		this.workers = [];
		this.running = false;
		this.stopReason = null;
	}

	private emit(event: SearchEvent): void {
		for (const l of [...this.listeners]) l(event);
	}
}
