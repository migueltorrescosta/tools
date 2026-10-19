/**
 * The worker side of the Ancilla vs MZI engine, free of worker globals so
 * specs run it in-process; `run.worker.ts` wires it to `self`. A worker
 * holds the built problems of one setup and runs one task per message: the
 * MZI baseline, one seed, or the finalisation of a best seed.
 */
import { Prng } from '$lib/symbolic-regression/prng';
import type { BestResult, Budget, MziResult, Role, SeedResult, Setup, TracePoint } from './types';
import { type AncillaProblem, buildAncilla } from './build';
import { computeMzi } from './mzi';
import { finaliseBest, optimiseSeed, seedParams, toSeedResult } from './optimise';

export type ToWorker =
	| { type: 'init'; setup: Setup; budget: Budget }
	| { type: 'mzi' }
	| { type: 'seed'; role: Role; seed: number }
	| { type: 'finalise'; result: SeedResult };

export type FromWorker =
	| { type: 'mzi'; result: MziResult }
	/** Best QFI of a running seed against its evaluations; `done` on its last batch. */
	| { type: 'trace'; role: Role; seed: number; points: TracePoint[]; done: boolean }
	| { type: 'seed'; result: SeedResult }
	| { type: 'finalised'; result: BestResult }
	| { type: 'error'; message: string };

export interface HostOptions {
	/** Minimum time between trace batches. */
	traceMs?: number;
}

const ROLE_SALT: Record<Role | 'mzi', number> = { setup: 0x51ed, companion: 0xc0ba, mzi: 0x3a71 };

/** PRNG seed of one task, from the run seed, the role and the seed index (stage 0 seeds, 1 finalises). */
export function taskSeed(runSeed: number, role: Role | 'mzi', index: number, stage = 0): number {
	let h = (runSeed >>> 0) ^ Math.imul(ROLE_SALT[role], 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) + Math.imul(index + 1, 0xc2b2ae35) + stage;
	h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
	return (h ^ (h >>> 16)) >>> 0;
}

const now = () => performance.now();

/** Returns the message handler of one worker; `post` sends messages back. */
export function createAncillaHost(
	post: (msg: FromWorker) => void,
	{ traceMs = 200 }: HostOptions = {}
): (msg: ToWorker) => void {
	let setup: Setup | null = null;
	let budget: Budget | null = null;
	const problems = new Map<Role, AncillaProblem>();

	const problem = (role: Role): AncillaProblem => {
		if (!setup || !budget) throw new Error('task before init');
		let p = problems.get(role);
		if (!p) {
			p = buildAncilla(setup, budget.steps, role);
			problems.set(role, p);
		}
		return p;
	};

	const runSeed = (role: Role, seed: number) => {
		const b = budget as Budget;
		const p = problem(role);
		const prng = new Prng(taskSeed(b.seed, role, seed));
		let pending: TracePoint[] = [];
		let last: TracePoint | null = null;
		let flushed = now();
		const record = (evaluations: number, qfi: number) => {
			if (last && qfi <= last.qfi && evaluations - last.evaluations < 25) return;
			last = { evaluations, qfi };
			pending.push(last);
			if (now() - flushed >= traceMs) {
				post({ type: 'trace', role, seed, points: pending, done: false });
				pending = [];
				flushed = now();
			}
		};
		const out = optimiseSeed(p, seedParams(p, seed, prng), prng, b, record);
		record(out.evaluations, out.qfi);
		post({ type: 'trace', role, seed, points: pending, done: true });
		post({ type: 'seed', result: toSeedResult(role, seed, out) });
	};

	return (msg) => {
		try {
			switch (msg.type) {
				case 'init':
					setup = msg.setup;
					budget = msg.budget;
					problems.clear();
					return;
				case 'mzi': {
					if (!setup || !budget) throw new Error('task before init');
					const prng = new Prng(taskSeed(budget.seed, 'mzi', 0));
					post({ type: 'mzi', result: computeMzi(setup, budget, prng).result });
					return;
				}
				case 'seed':
					runSeed(msg.role, msg.seed);
					return;
				case 'finalise': {
					const { role, seed } = msg.result;
					const prng = new Prng(taskSeed((budget as Budget).seed, role, seed, 1));
					post({ type: 'finalised', result: finaliseBest(problem(role), msg.result, prng) });
					return;
				}
			}
		} catch (err) {
			post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
		}
	};
}
