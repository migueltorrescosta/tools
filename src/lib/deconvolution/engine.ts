/**
 * A small pool of estimator workers: tasks queue and go to the next idle
 * worker; `stop` terminates every worker at once and rejects what is
 * pending, so a long bootstrap stops immediately. No DOM or Svelte imports.
 */
import { defaultWorkerCount, type WorkerLike } from '$lib/worker-pool';
import type { Task, TaskResult } from './estimate';

export interface ToWorker {
	id: number;
	task: Task;
}

export type FromWorker =
	{ id: number; ok: true; result: TaskResult } | { id: number; ok: false; error: string };

/** The error a pending task rejects with when the pool is stopped. */
export class StoppedError extends Error {
	constructor() {
		super('Stopped');
		this.name = 'StoppedError';
	}
}

interface Job {
	id: number;
	task: Task;
	resolve: (r: TaskResult) => void;
	reject: (e: Error) => void;
}

export class EstimatePool {
	private workers: { worker: WorkerLike<ToWorker, FromWorker>; job: Job | null }[] = [];
	private queue: Job[] = [];
	private nextId = 1;

	constructor(
		private createWorker: () => WorkerLike<ToWorker, FromWorker>,
		readonly size = defaultWorkerCount()
	) {}

	run(task: Task): Promise<TaskResult> {
		return new Promise((resolve, reject) => {
			this.queue.push({ id: this.nextId++, task, resolve, reject });
			this.pump();
		});
	}

	/** Terminates the workers and rejects every pending task with `StoppedError`. */
	stop(): void {
		const pending = [...this.workers.flatMap((w) => (w.job ? [w.job] : [])), ...this.queue];
		for (const w of this.workers) w.worker.terminate();
		this.workers = [];
		this.queue = [];
		for (const job of pending) job.reject(new StoppedError());
	}

	private pump(): void {
		while (this.workers.length < this.size && this.queue.length > this.workers.length) this.spawn();
		for (const slot of this.workers) {
			if (slot.job || this.queue.length === 0) continue;
			const job = this.queue.shift()!;
			slot.job = job;
			slot.worker.postMessage({ id: job.id, task: job.task });
		}
	}

	private spawn(): void {
		const worker = this.createWorker();
		const slot = { worker, job: null as Job | null };
		worker.onmessage = (e) => {
			const job = slot.job;
			if (!job || e.data.id !== job.id) return;
			slot.job = null;
			if (e.data.ok) job.resolve(e.data.result);
			else job.reject(new Error(e.data.error));
			this.pump();
		};
		worker.onerror = (e) => {
			const job = slot.job;
			slot.job = null;
			job?.reject(new Error(e.message || 'The estimator stopped unexpectedly.'));
			this.pump();
		};
		this.workers.push(slot);
	}
}
