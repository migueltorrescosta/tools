/**
 * `AncillaEngine` over a pool of workers. One task computes the MZI baseline
 * while the other workers start seeds; seeds of the setup and of its
 * companion (coupling off) interleave with indices counting up until Stop.
 * A worker that finds a new best finalises it next (2M re-evaluation,
 * saturation flags, readouts). Stop terminates the workers at once, so it
 * takes effect immediately even in the middle of a seed; interrupted seeds
 * are re-run first on Continue, so the seed set stays the same as in an
 * uninterrupted run.
 */
import { defaultWorkerCount, type WorkerLike as PoolWorker } from '$lib/worker-pool';
import type { FromWorker, ToWorker } from './host';
import { hasCompanion } from './build';
import { validateBudget, validateSetup } from './limits';
import { computeMetrics } from './metrics';
import type {
	AncillaEngine,
	BestResult,
	Budget,
	Metrics,
	MziResult,
	Role,
	RunEvent,
	RunSnapshot,
	SeedResult,
	SeedTrace,
	Setup
} from './types';

type WorkerLike = PoolWorker<ToWorker, FromWorker>;

interface AncillaEngineOptions {
	/** Interval between progress events. */
	progressMs?: number;
}

type Task =
	| { type: 'mzi' }
	| { type: 'seed'; role: Role; seed: number }
	| { type: 'finalise'; role: Role; seed: number };

interface Slot {
	worker: WorkerLike;
	task: Task | null;
}

const now = () => performance.now();
const traceKey = (role: Role, seed: number) => `${role}:${seed}`;

class WorkerAncillaEngine implements AncillaEngine {
	private slots: Slot[] = [];
	private listeners = new Set<(event: RunEvent) => void>();
	private setup: Setup | null = null;
	private budget: Budget | null = null;
	private companion = false;
	private running = false;
	private dirty = false;
	private timer: ReturnType<typeof setInterval> | null = null;
	private elapsed = 0;
	private startedAt = 0;
	/** Tasks issued so far; task g is seed g/2 of the setup (even) or companion (odd), or seed g without a companion. */
	private issued = 0;
	private requeue: { role: Role; seed: number }[] = [];
	private mzi: MziResult | null = null;
	private mziBusy = false;
	private best: Record<Role, BestResult | null> = { setup: null, companion: null };
	private finalised: Record<Role, boolean> = { setup: false, companion: false };
	private finalising: Record<Role, number | null> = { setup: null, companion: null };
	private optima: Record<Role, number[]> = { setup: [], companion: [] };
	private traces = new Map<string, SeedTrace>();
	private metrics: Metrics | null = null;
	private progressMs: number;
	/** Stopped, but a finisher worker is completing the MZI or finalisations. */
	private finishing = false;

	constructor(
		private createWorker: () => WorkerLike,
		{ progressMs = 250 }: AncillaEngineOptions = {}
	) {
		this.progressMs = progressMs;
	}

	start(setup: Setup, budget: Budget): void {
		this.halt();
		const errors = [...validateSetup(setup), ...validateBudget(budget)];
		if (errors.length) {
			this.emit({ type: 'error', message: errors[0].message });
			return;
		}
		this.setup = structuredClone(setup);
		this.budget = { ...budget };
		this.companion = hasCompanion(setup);
		this.elapsed = 0;
		this.issued = 0;
		this.requeue = [];
		this.mzi = null;
		this.mziBusy = false;
		this.best = { setup: null, companion: null };
		this.finalised = { setup: false, companion: false };
		this.finalising = { setup: null, companion: null };
		this.optima = { setup: [], companion: [] };
		this.traces = new Map();
		this.metrics = null;
		this.launch();
	}

	stop(): void {
		if (!this.running) return;
		this.halt();
		this.emit({ type: 'stopped', reason: 'user', snapshot: this.snapshot() });
		if (this.pendingFinish()) this.finish();
	}

	/** The MZI or a best result still lacks its baseline or finalisation. */
	private pendingFinish(): boolean {
		return (
			!this.mzi || (['setup', 'companion'] as const).some((r) => this.best[r] && !this.finalised[r])
		);
	}

	/** After stop: one worker completes the MZI and finalisations only, then reports a new stopped snapshot. */
	private finish(): void {
		const worker = this.createWorker();
		const slot: Slot = { worker, task: null };
		worker.onmessage = (e) => this.onMessage(slot, e.data);
		worker.onerror = (e) => this.fail(e.message || 'Worker error');
		worker.postMessage({ type: 'init', setup: this.setup as Setup, budget: this.budget as Budget });
		this.slots.push(slot);
		this.finishing = true;
		this.assign(slot);
	}

	continue(): void {
		if (this.running || !this.setup) return;
		if (this.finishing) this.halt();
		this.launch();
	}

	subscribe(listener: (event: RunEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispose(): void {
		this.halt();
		this.setup = null;
		this.budget = null;
		this.traces = new Map();
	}

	private launch(): void {
		const setup = this.setup as Setup;
		const budget = this.budget as Budget;
		// start() refused budgets outside BUDGET_LIMITS, so this is at most MAX_WORKERS.
		const n = budget.workers > 0 ? budget.workers : defaultWorkerCount();
		this.running = true;
		this.startedAt = now();
		for (let i = 0; i < n; i++) {
			const worker = this.createWorker();
			const slot: Slot = { worker, task: null };
			worker.onmessage = (e) => this.onMessage(slot, e.data);
			worker.onerror = (e) => this.fail(e.message || 'Worker error');
			worker.postMessage({ type: 'init', setup, budget });
			this.slots.push(slot);
		}
		for (const slot of this.slots) this.assign(slot);
		this.timer = setInterval(() => this.tick(), this.progressMs);
	}

	/** Terminate the workers and put their unfinished tasks back. */
	private halt(): void {
		if (this.timer !== null) clearInterval(this.timer);
		this.timer = null;
		if (this.running) this.elapsed += now() - this.startedAt;
		this.running = false;
		this.finishing = false;
		const interrupted: { role: Role; seed: number }[] = [];
		for (const { worker, task } of this.slots) {
			worker.onmessage = null;
			worker.onerror = null;
			worker.terminate();
			if (task?.type === 'mzi') this.mziBusy = false;
			if (task?.type === 'finalise') this.finalising[task.role] = null;
			if (task?.type === 'seed') {
				interrupted.push({ role: task.role, seed: task.seed });
				this.traces.delete(traceKey(task.role, task.seed));
			}
		}
		this.slots = [];
		this.requeue = [...interrupted, ...this.requeue].sort(
			(a, b) => this.order(a.role, a.seed) - this.order(b.role, b.seed)
		);
	}

	/** Position of a seed in the interleaved schedule. */
	private order(role: Role, seed: number): number {
		return this.companion ? 2 * seed + (role === 'companion' ? 1 : 0) : seed;
	}

	private nextTask(): Task {
		if (!this.mzi && !this.mziBusy) {
			this.mziBusy = true;
			return { type: 'mzi' };
		}
		for (const role of ['setup', 'companion'] as const) {
			const b = this.best[role];
			if (b && !this.finalised[role] && this.finalising[role] === null) {
				this.finalising[role] = b.seed;
				return { type: 'finalise', role, seed: b.seed };
			}
		}
		const again = this.requeue.shift();
		if (again) return { type: 'seed', ...again };
		const g = this.issued++;
		if (!this.companion) return { type: 'seed', role: 'setup', seed: g };
		return { type: 'seed', role: g % 2 ? 'companion' : 'setup', seed: Math.floor(g / 2) };
	}

	private assign(slot: Slot): void {
		if (!this.running && !this.finishing) return;
		if (this.finishing && !this.pendingFinish()) {
			this.halt();
			this.emit({ type: 'stopped', reason: 'user', snapshot: this.snapshot() });
			return;
		}
		const task = this.nextTask();
		slot.task = task;
		if (task.type === 'mzi') slot.worker.postMessage({ type: 'mzi' });
		else if (task.type === 'seed') {
			this.traces.set(traceKey(task.role, task.seed), {
				role: task.role,
				seed: task.seed,
				points: [],
				done: false
			});
			this.dirty = true;
			slot.worker.postMessage({ type: 'seed', role: task.role, seed: task.seed });
		} else {
			const b = this.best[task.role] as BestResult;
			const result: SeedResult = {
				role: b.role,
				seed: b.seed,
				qfi: b.qfi,
				params: b.params,
				psiRe: b.psiRe,
				psiIm: b.psiIm,
				evaluations: b.evaluations
			};
			slot.worker.postMessage({ type: 'finalise', result });
		}
	}

	private onMessage(slot: Slot, msg: FromWorker): void {
		if (!this.slots.includes(slot)) return;
		switch (msg.type) {
			case 'error':
				return this.fail(msg.message);
			case 'trace': {
				const t = this.traces.get(traceKey(msg.role, msg.seed));
				if (t) {
					t.points.push(...msg.points);
					t.done = msg.done;
				}
				this.dirty = true;
				return;
			}
			case 'mzi':
				this.mzi = msg.result;
				this.mziBusy = false;
				break;
			case 'seed': {
				const r = msg.result;
				this.optima[r.role].push(r.qfi);
				const b = this.best[r.role];
				if (!b || r.qfi > b.qfi) {
					this.best[r.role] = {
						...r,
						qfiFine: null,
						saturated: r.params.map(() => false),
						readouts: null
					};
					this.finalised[r.role] = false;
				}
				break;
			}
			case 'finalised': {
				const r = msg.result;
				this.finalising[r.role] = null;
				const b = this.best[r.role];
				if (b && b.seed === r.seed) {
					this.best[r.role] = r;
					this.finalised[r.role] = true;
				}
				break;
			}
		}
		this.updateMetrics();
		this.dirty = true;
		slot.task = null;
		this.assign(slot);
	}

	private updateMetrics(): void {
		const setup = this.setup;
		const best = this.best.setup;
		this.metrics =
			setup && this.mzi && best
				? computeMetrics({
						setup,
						mzi: this.mzi,
						best,
						optima: this.optima.setup,
						companion: this.companion ? this.best.companion : null
					})
				: null;
	}

	private snapshot(): RunSnapshot {
		return {
			elapsedMs: this.elapsed + (this.running ? now() - this.startedAt : 0),
			seedsDone: { setup: this.optima.setup.length, companion: this.optima.companion.length },
			mzi: this.mzi,
			best: { setup: this.best.setup, companion: this.best.companion },
			traces: [...this.traces.values()].map((t) => ({ ...t, points: t.points.slice() })),
			metrics: this.metrics
		};
	}

	private tick(): void {
		if (!this.running || !this.dirty) return;
		this.dirty = false;
		this.emit({ type: 'progress', snapshot: this.snapshot() });
	}

	/** Ends the run on a worker error; `start` is needed to run again. */
	private fail(message: string): void {
		this.halt();
		this.requeue = [];
		this.setup = null;
		this.emit({ type: 'error', message });
	}

	private emit(event: RunEvent): void {
		for (const l of [...this.listeners]) l(event);
	}
}

/** The engine on Web Workers running `run.worker.ts`; `factory` replaces them (specs). */
export function createAncillaEngine(
	factory?: () => WorkerLike,
	options?: AncillaEngineOptions
): AncillaEngine {
	return new WorkerAncillaEngine(
		factory ??
			(() =>
				new Worker(new URL('./run.worker.ts', import.meta.url), {
					type: 'module'
				}) as unknown as WorkerLike),
		options
	);
}
