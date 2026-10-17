/**
 * The island side of the worker protocol, free of worker globals so it can run
 * in-process in specs. `search.worker.ts` wires it to `self`.
 */
import { Island } from './island';
import { Rescorer, type Candidate } from './rescore';
import type { Expr, PreparedData, SearchSettings } from './types';

export type ToWorker =
	| { type: 'init'; data: PreparedData; settings: SearchSettings; seed: number }
	/** Run until `budgetMs` has passed or a `stop` arrives. */
	| { type: 'run'; budgetMs: number }
	| { type: 'stop' }
	| { type: 'immigrants'; exprs: Expr[] };

export type FromWorker =
	| {
			type: 'report';
			/** The island's hall of fame, refitted and scored on the full train and validation sets. */
			candidates: Candidate[];
			/** Iterations since init. */
			iterations: number;
			/** Elites for the next island. */
			emigrants: Expr[];
			/** True on the last report of a run. */
			idle: boolean;
	  }
	| { type: 'error'; message: string };

export interface HostOptions {
	/** Time spent stepping before yielding to the message loop. */
	sliceMs?: number;
	/** Minimum time between reports. */
	reportMs?: number;
	/** Emigrants per report, as a fraction of the population. */
	migrationFraction?: number;
}

const now = () => performance.now();

/** Returns the message handler of one island worker; `post` sends messages back. */
export function createIslandHost(
	post: (msg: FromWorker) => void,
	{ sliceMs = 50, reportMs = 300, migrationFraction = 0.02 }: HostOptions = {}
): (msg: ToWorker) => void {
	let island: Island | null = null;
	let rescorer: Rescorer | null = null;
	let emigrantCount = 1;
	let running = false;
	let deadline = 0;
	let lastReport = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const report = (idle: boolean) => {
		if (!island || !rescorer) return;
		const candidates = rescorer.rescoreAll(island.hallOfFame().map((h) => h.expr));
		post({
			type: 'report',
			candidates,
			iterations: island.iterations,
			emigrants: idle ? [] : island.emigrants(emigrantCount),
			idle
		});
		lastReport = now();
	};

	const finish = () => {
		running = false;
		if (timer !== null) clearTimeout(timer);
		timer = null;
		report(true);
	};

	const tick = () => {
		timer = null;
		if (!running || !island) return;
		try {
			const sliceEnd = Math.min(now() + sliceMs, deadline);
			do island.step();
			while (now() < sliceEnd);
			if (now() >= deadline) return finish();
			if (now() - lastReport >= reportMs) report(false);
			timer = setTimeout(tick, 0);
		} catch (err) {
			running = false;
			post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
		}
	};

	return (msg) => {
		try {
			switch (msg.type) {
				case 'init':
					if (timer !== null) clearTimeout(timer);
					timer = null;
					running = false;
					island = new Island(msg.data, msg.settings, msg.seed);
					rescorer = new Rescorer(msg.data);
					emigrantCount = Math.max(1, Math.round(msg.settings.populationSize * migrationFraction));
					return;
				case 'run':
					if (!island) throw new Error('run before init');
					deadline = now() + msg.budgetMs;
					lastReport = now();
					if (!running) {
						running = true;
						timer = setTimeout(tick, 0);
					}
					return;
				case 'stop':
					if (running) finish();
					else report(true);
					return;
				case 'immigrants':
					island?.immigrate(msg.exprs);
					return;
			}
		} catch (err) {
			post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
		}
	};
}
