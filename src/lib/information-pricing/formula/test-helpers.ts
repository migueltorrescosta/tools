/** Test helpers: random syntax trees and span-free comparison. */
import type { Prng } from '$lib/prng';
import type { Model, RandomInput } from '../types';
import { FUNCTIONS, type BinaryOp, type FnName, type Node } from './ast';

const BINARY: BinaryOp[] = ['+', '-', '*', '/', '^', '<', '<=', '>', '>=', '==', '!=', 'and', 'or'];
const FNS = [...FUNCTIONS.keys()] as FnName[];
const NUMBERS = [0, 1, 2, 0.5, 3.25, 10, 1e-3, 2.5e6, 7];

const pick = <T>(prng: Prng, xs: readonly T[]): T => xs[prng.int(xs.length)];
const at = { start: 0, end: 0 };

/** A random valid tree over `symbols`, at most `depth` levels deep. */
export function randomTree(prng: Prng, symbols: readonly string[], depth: number): Node {
	const r = prng.next();
	if (depth <= 0 || r < 0.2)
		return prng.next() < 0.5
			? { kind: 'num', value: pick(prng, NUMBERS), ...at }
			: { kind: 'sym', name: pick(prng, symbols), ...at };
	const sub = () => randomTree(prng, symbols, depth - 1);
	if (r < 0.3) return { kind: 'unary', op: prng.next() < 0.7 ? '-' : 'not', arg: sub(), ...at };
	if (r < 0.75) return { kind: 'binary', op: pick(prng, BINARY), left: sub(), right: sub(), ...at };
	if (r < 0.82) return { kind: 'ternary', cond: sub(), then: sub(), else: sub(), ...at };
	const fn = pick(prng, FNS);
	const [lo, hi] = FUNCTIONS.get(fn)!;
	const n = hi === Infinity ? lo + prng.int(3) : lo;
	return { kind: 'call', fn, args: Array.from({ length: n }, sub), ...at };
}

/** `node` without spans, for structural comparison. */
export function strip(node: Node): unknown {
	const { start: _s, end: _e, ...rest } = node;
	void _s;
	void _e;
	const out: Record<string, unknown> = { ...rest };
	for (const [k, v] of Object.entries(rest))
		if (Array.isArray(v)) out[k] = v.map(strip);
		else if (v && typeof v === 'object') out[k] = strip(v as Node);
	return out;
}

/** Equal to 1e-12 relative, or both NaN, or the same infinity. */
export function agrees(a: number, b: number): boolean {
	if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
	if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
	return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
}

const input = (symbol: string, family: RandomInput['family'], params: number[]): RandomInput => ({
	symbol,
	name: '',
	family,
	params
});

/** The two presets from tools#41's Instructions. */
export const distributionCentre: Model = {
	inputs: [
		input('N', 'binomial', [1e7, 0.001]),
		input('P', 'exponential', [3]),
		input('C', 'uniform', [50, 500])
	],
	constants: [{ symbol: 'T', value: 1000, name: '' }],
	intermediates: [],
	decisions: {
		symbol: 't',
		values: [8, 9, 10, 11, 12],
		label: '{t} trucks',
		reward: 'min(N, t*T)*P - t*C',
		unit: '€'
	},
	seed: 2026,
	samples: 100_000
};

export const airline: Model = {
	inputs: [
		input('R', 'lognormal', [1.4, 0.35]),
		input('K', 'lognormal', [3.5e8, 0.2]),
		input('F', 'uniform', [1.5, 2.5]),
		input('Lr', 'uniform', [0.08, 0.16]),
		input('p', 'uniform', [1.5, 3]),
		input('i', 'uniform', [0.01, 0.03])
	],
	constants: [{ symbol: 'C0', value: 950, name: '' }],
	// Deliberately out of dependency order.
	intermediates: [
		{ symbol: 'L', name: '', formula: 'C0 - b + Delta/1e6' },
		{ symbol: 'Delta', name: '', formula: 'Rev - Fuel' },
		{ symbol: 'Rev', name: '', formula: 'K*p' },
		{ symbol: 'Fuel', name: '', formula: 'K*F' }
	],
	decisions: {
		symbol: 'b',
		values: [0, 250, 500, 750, 1000],
		label: '{b} M€',
		reward: 'b*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)',
		unit: 'M€'
	},
	seed: 2026,
	samples: 100_000
};
