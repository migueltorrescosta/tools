/**
 * Scenario generation in fixed-size chunks. Chunk k draws from its own PRNG
 * stream, seeded from (seed, k), so results depend on the seed and the
 * sequence of Run/Add sizes, never on the worker count. No DOM imports.
 */
import { Prng } from '$lib/prng';
import { fill } from './distributions';
import type { Kernel } from './formula/codegen';
import type { Family, Scenarios } from './types';

/** Rows per chunk: the unit of work handed to a worker. */
export const CHUNK_ROWS = 25_000;

/** The parts of a random input a worker needs to sample it. */
export interface InputSpec {
	family: Family;
	params: number[];
}

/** One chunk's columns: `cols` follows the kernel's slot layout. */
export interface Chunk {
	cols: Float64Array[];
	rewards: Float64Array[];
}

/** Seed of chunk `k` (a murmur3-style mix of the run seed and the index). */
export function chunkSeed(seed: number, k: number): number {
	let h = (seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Draw `rows` scenarios of chunk `k`: every input fills its column in model
 * order, then the kernel computes the shared intermediates and the rewards.
 * Throws when a reward is not a finite number.
 */
export function simulateChunk(
	inputs: InputSpec[],
	slotCount: number,
	decisions: number,
	kernel: Kernel,
	seed: number,
	k: number,
	rows: number
): Chunk {
	const prng = new Prng(chunkSeed(seed, k));
	const cols = Array.from({ length: slotCount }, () => new Float64Array(rows));
	inputs.forEach((input, j) => fill(input.family, input.params, prng, cols[j]));
	const rewards = Array.from({ length: decisions }, () => new Float64Array(rows));
	kernel(cols, rewards, 0, rows);
	for (let d = 0; d < decisions; d++) {
		const r = rewards[d];
		for (let i = 0; i < rows; i++) {
			if (!Number.isFinite(r[i])) {
				throw new Error(
					`A reward is ${r[i]} (decision ${d + 1}); check the formulas for division by zero or overflow.`
				);
			}
		}
	}
	return { cols, rewards };
}

/** Sizes of the chunks for `n` new rows, starting at chunk `firstChunk`. */
export function chunkPlan(n: number, firstChunk: number): { k: number; rows: number }[] {
	const plan: { k: number; rows: number }[] = [];
	for (let done = 0, k = firstChunk; done < n; k++) {
		const rows = Math.min(CHUNK_ROWS, n - done);
		plan.push({ k, rows });
		done += rows;
	}
	return plan;
}

/** Column names the scenarios carry, from the kernel's slot layout. */
export interface ScenarioShape {
	inputs: string[];
	shared: string[];
	decisions: string[];
}

/**
 * Append chunks (in chunk order) to `previous` (or start fresh) and recompute
 * the optimal reward. Returns a new `Scenarios`; `previous` is left unchanged.
 */
export function assemble(
	shape: ScenarioShape,
	chunks: Chunk[],
	previous: Scenarios | null
): Scenarios {
	const added = chunks.reduce(
		(sum, c) => sum + (c.rewards[0]?.length ?? c.cols[0]?.length ?? 0),
		0
	);
	const base = previous?.n ?? 0;
	const n = base + added;
	const join = (old: Float64Array | undefined, pick: (c: Chunk) => Float64Array) => {
		const out = new Float64Array(n);
		if (old) out.set(old);
		let at = base;
		for (const c of chunks) {
			const part = pick(c);
			out.set(part, at);
			at += part.length;
		}
		return out;
	};
	const ni = shape.inputs.length;
	const inputs = shape.inputs.map((symbol, j) => ({
		symbol,
		column: join(previous?.inputs[j]?.column, (c) => c.cols[j])
	}));
	const intermediates = shape.shared.map((symbol, j) => ({
		symbol,
		column: join(previous?.intermediates[j]?.column, (c) => c.cols[ni + j])
	}));
	const rewards = shape.decisions.map((_, d) => join(previous?.rewards[d], (c) => c.rewards[d]));
	const optimal = new Float64Array(n);
	optimal.fill(-Infinity);
	for (const r of rewards) for (let i = 0; i < n; i++) if (r[i] > optimal[i]) optimal[i] = r[i];
	return { n, inputs, intermediates, decisions: [...shape.decisions], rewards, optimal };
}
