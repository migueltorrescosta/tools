/**
 * One island of PySR-style regularised evolution: tournament selection,
 * mutation and crossover, the oldest member replaced by each child, adaptive
 * parsimony from complexity frequencies, mini-batch fitness, occasional
 * constant optimisation, and a hall of fame of the best expression per
 * complexity (by full-train MSE). All randomness comes from one seeded Prng.
 */
import { fitConstants } from './constants';
import {
	binary,
	compile,
	complexity,
	constant,
	getConstants,
	programMse,
	setConstants,
	unary,
	variable
} from './expr';
import { Prng } from './prng';
import { simplify } from './simplify';
import type { BinaryOp, Dataset, Expr, PreparedData, SearchSettings, UnaryOp } from './types';
import { BINARY_OPS, UNARY_OPS } from './types';

/** Tuning knobs; defaults follow PySR where it makes sense for one island. */
export interface IslandOptions {
	tournamentSize: number;
	/** Probability of taking the best of a tournament (then the next best, …). */
	tournamentP: number;
	/** PySR's adaptive_parsimony_scaling: score × exp(scaling × frequency of the complexity). */
	parsimonyScaling: number;
	crossoverProbability: number;
	/** Fraction of members whose constants are optimised (on the batch) per step. */
	optimizeProbability: number;
	optimizeIterations: number;
	/** Mutation events per step, as a multiple of the population size. */
	eventsPerMember: number;
	/** Largest initial random tree. */
	initialMaxSize: number;
	weights: MutationWeights;
}

export interface MutationWeights {
	mutateConstant: number;
	mutateOperator: number;
	swapOperands: number;
	rotateTree: number;
	addNode: number;
	insertNode: number;
	deleteNode: number;
	simplify: number;
	randomize: number;
	doNothing: number;
}

export const DEFAULT_ISLAND_OPTIONS: IslandOptions = {
	tournamentSize: 12,
	tournamentP: 0.9,
	parsimonyScaling: 20,
	crossoverProbability: 0.05,
	optimizeProbability: 0.05,
	optimizeIterations: 8,
	eventsPerMember: 1,
	initialMaxSize: 5,
	weights: {
		mutateConstant: 0.5,
		mutateOperator: 1,
		swapOperands: 0.3,
		rotateTree: 0.5,
		addNode: 1,
		insertNode: 1,
		deleteNode: 0.8,
		simplify: 0.05,
		randomize: 0.02,
		doNothing: 0.2
	}
};

interface Member {
	expr: Expr;
	complexity: number;
	/** MSE on the batch it was last evaluated on; Infinity if infeasible. */
	loss: number;
}

export interface HallOfFameEntry {
	complexity: number;
	expr: Expr;
	/** MSE on the full train set, constants as evolved (not refitted). */
	loss: number;
}

const MAX_ATTEMPTS = 10;

/** Preorder index → node. */
function nodeAt(e: Expr, index: number): Expr {
	let i = index;
	const walk = (n: Expr): Expr | null => {
		if (i === 0) return n;
		i--;
		if (n.kind === 'unary') return walk(n.child);
		if (n.kind === 'binary') return walk(n.left) ?? walk(n.right);
		return null;
	};
	return walk(e) ?? e;
}

/** Copy of `e` with the preorder node `index` replaced by `f(node)` (path copying). */
function replaceAt(e: Expr, index: number, f: (n: Expr) => Expr): Expr {
	let i = index;
	const walk = (n: Expr): Expr => {
		if (i < 0) return n;
		if (i === 0) {
			i = -1;
			return f(n);
		}
		i--;
		if (n.kind === 'unary') {
			const c = walk(n.child);
			return c === n.child ? n : unary(n.op, c);
		}
		if (n.kind === 'binary') {
			const l = walk(n.left);
			const r = walk(n.right);
			return l === n.left && r === n.right ? n : binary(n.op, l, r);
		}
		return n;
	};
	return walk(e);
}

/** Preorder indices of the nodes matching `pred`. */
function indicesWhere(e: Expr, pred: (n: Expr) => boolean): number[] {
	const out: number[] = [];
	let i = 0;
	const walk = (n: Expr): void => {
		if (pred(n)) out.push(i);
		i++;
		if (n.kind === 'unary') walk(n.child);
		else if (n.kind === 'binary') {
			walk(n.left);
			walk(n.right);
		}
	};
	walk(e);
	return out;
}

export class Island {
	readonly options: IslandOptions;
	private prng: Prng;
	private binOps: BinaryOp[];
	private unOps: UnaryOp[];
	private nvars: number;
	private maxSize: number;
	private pop: Member[] = [];
	/** Ring pointer at the oldest member. */
	private oldest = 0;
	/** Complexity frequencies (index = complexity), PySR's running statistics. */
	private freq: Float64Array;
	private freqTotal = 0;
	private hof: (HallOfFameEntry | null)[];
	/** Best new expression per complexity seen during the current step. */
	private stepBest: (Member | null)[];
	private batch: Dataset;
	private batchIsFull: boolean;
	private batchRows: Uint32Array | null = null;
	iterations = 0;

	constructor(
		private data: PreparedData,
		private settings: SearchSettings,
		seed: number,
		options: Partial<IslandOptions> = {}
	) {
		this.options = { ...DEFAULT_ISLAND_OPTIONS, ...options };
		this.prng = new Prng(seed);
		const ops = new Set(settings.operators);
		this.binOps = BINARY_OPS.filter((o) => ops.has(o));
		this.unOps = UNARY_OPS.filter((o) => ops.has(o));
		this.nvars = data.train.x.length;
		this.maxSize = Math.max(1, settings.maxComplexity);
		this.freq = new Float64Array(this.maxSize + 2).fill(1);
		this.freqTotal = this.freq.length;
		this.hof = new Array(this.maxSize + 1).fill(null);
		this.stepBest = new Array(this.maxSize + 1).fill(null);

		const n = data.train.y.length;
		this.batchIsFull = n <= settings.batchSize;
		if (this.batchIsFull) this.batch = data.train;
		else {
			const b = settings.batchSize;
			this.batch = { x: data.train.x.map(() => new Float64Array(b)), y: new Float64Array(b) };
			this.batchRows = new Uint32Array(b);
			this.resample();
		}

		const size = Math.max(2, settings.populationSize);
		for (let i = 0; i < size; i++) {
			const e = this.randomTree(
				1 + this.prng.int(Math.min(this.options.initialMaxSize, this.maxSize))
			);
			this.pop.push(this.member(e));
		}
		for (const m of this.pop) this.consider(m);
		this.updateHallOfFame();
	}

	// --- data -----------------------------------------------------------------

	private resample(): void {
		const rows = this.batchRows!;
		const n = this.data.train.y.length;
		for (let i = 0; i < rows.length; i++) rows[i] = this.prng.int(n);
		const { x, y } = this.data.train;
		for (let j = 0; j < x.length; j++) {
			const src = x[j];
			const dst = this.batch.x[j];
			for (let i = 0; i < rows.length; i++) dst[i] = src[rows[i]];
		}
		for (let i = 0; i < rows.length; i++) this.batch.y[i] = y[rows[i]];
	}

	private batchLoss(e: Expr): number {
		return programMse(compile(e), this.batch.x, this.batch.y);
	}

	private member(e: Expr): Member {
		return { expr: e, complexity: complexity(e), loss: this.batchLoss(e) };
	}

	// --- random trees -----------------------------------------------------------

	private randomLeaf(): Expr {
		if (this.nvars > 0 && this.prng.next() < 0.5) return variable(this.prng.int(this.nvars));
		return constant(this.prng.normal());
	}

	private randomTree(size: number): Expr {
		if (size <= 1) return this.randomLeaf();
		const canUnary = this.unOps.length > 0;
		const canBinary = this.binOps.length > 0 && size >= 3;
		if (!canUnary && !canBinary) return this.randomLeaf();
		if (canUnary && (!canBinary || this.prng.next() < 0.25)) {
			return unary(this.unOps[this.prng.int(this.unOps.length)], this.randomTree(size - 1));
		}
		const left = 1 + this.prng.int(size - 2);
		return binary(
			this.binOps[this.prng.int(this.binOps.length)],
			this.randomTree(left),
			this.randomTree(size - 1 - left)
		);
	}

	/** A random operator node over the given children (unary uses only `a`). */
	private randomOp(a: Expr, b: () => Expr): Expr {
		const nb = this.binOps.length;
		const nu = this.unOps.length;
		if (nb + nu === 0) return a;
		const i = this.prng.int(nb + nu);
		if (i < nb) {
			const other = b();
			return this.prng.next() < 0.5
				? binary(this.binOps[i], a, other)
				: binary(this.binOps[i], other, a);
		}
		return unary(this.unOps[i - nb], a);
	}

	// --- mutations --------------------------------------------------------------

	private mutate(e: Expr, size: number): Expr | null {
		const w = this.options.weights;
		const nConst = getConstants(e).length;
		const full = size >= this.maxSize;
		const weights = [
			nConst > 0 ? w.mutateConstant : 0,
			size > 1 ? w.mutateOperator : 0,
			size > 1 ? w.swapOperands : 0,
			size > 2 ? w.rotateTree : 0,
			full ? 0 : w.addNode,
			full ? 0 : w.insertNode,
			size > 1 ? w.deleteNode : 0,
			w.simplify,
			w.randomize,
			w.doNothing
		];
		let total = 0;
		for (const v of weights) total += v;
		let r = this.prng.next() * total;
		let kind = 0;
		while (kind < weights.length - 1 && r >= weights[kind]) r -= weights[kind++];
		switch (kind) {
			case 0:
				return this.mutateConstant(e);
			case 1:
				return this.mutateOperator(e);
			case 2:
				return this.swapOperands(e);
			case 3:
				return this.rotate(e);
			case 4:
				return this.addNode(e);
			case 5:
				return this.insertNode(e);
			case 6:
				return this.deleteNode(e);
			case 7:
				return simplify(e);
			case 8:
				return this.randomTree(
					1 + this.prng.int(Math.min(this.maxSize, 2 * this.options.initialMaxSize))
				);
			default:
				return e;
		}
	}

	private mutateConstant(e: Expr): Expr | null {
		const cs = getConstants(e);
		if (cs.length === 0) return null;
		const j = this.prng.int(cs.length);
		const p = this.prng.next();
		if (p < 0.1) cs[j] = -cs[j];
		else if (p < 0.2) cs[j] = cs[j] + this.prng.normal();
		else {
			const factor = Math.pow(2, this.prng.next());
			cs[j] = this.prng.next() < 0.5 ? cs[j] * factor : cs[j] / factor;
		}
		return setConstants(e, cs);
	}

	private mutateOperator(e: Expr): Expr | null {
		const idx = indicesWhere(e, (n) => n.kind === 'unary' || n.kind === 'binary');
		if (idx.length === 0) return null;
		return replaceAt(e, idx[this.prng.int(idx.length)], (n) => {
			if (n.kind === 'binary' && this.binOps.length > 0)
				return binary(this.binOps[this.prng.int(this.binOps.length)], n.left, n.right);
			if (n.kind === 'unary' && this.unOps.length > 0)
				return unary(this.unOps[this.prng.int(this.unOps.length)], n.child);
			return n;
		});
	}

	private swapOperands(e: Expr): Expr | null {
		const idx = indicesWhere(e, (n) => n.kind === 'binary');
		if (idx.length === 0) return null;
		return replaceAt(e, idx[this.prng.int(idx.length)], (n) =>
			n.kind === 'binary' ? binary(n.op, n.right, n.left) : n
		);
	}

	/** Tree rotation: op1(op2(a, b), c) → op2(a, op1(b, c)), or the mirror. */
	private rotate(e: Expr): Expr | null {
		const idx = indicesWhere(
			e,
			(n) => n.kind === 'binary' && (n.left.kind === 'binary' || n.right.kind === 'binary')
		);
		if (idx.length === 0) return null;
		return replaceAt(e, idx[this.prng.int(idx.length)], (n) => {
			if (n.kind !== 'binary') return n;
			const leftFirst =
				n.left.kind === 'binary' && (n.right.kind !== 'binary' || this.prng.next() < 0.5);
			if (leftFirst && n.left.kind === 'binary') {
				const p = n.left;
				return binary(p.op, p.left, binary(n.op, p.right, n.right));
			}
			if (n.right.kind === 'binary') {
				const p = n.right;
				return binary(p.op, binary(n.op, n.left, p.left), p.right);
			}
			return n;
		});
	}

	/** Replace a leaf by an operator over it (or a fresh leaf) and a new leaf. */
	private addNode(e: Expr): Expr | null {
		const idx = indicesWhere(e, (n) => n.kind === 'const' || n.kind === 'var');
		return replaceAt(e, idx[this.prng.int(idx.length)], (leaf) =>
			this.randomOp(this.prng.next() < 0.5 ? leaf : this.randomLeaf(), () => this.randomLeaf())
		);
	}

	/** Wrap a random node in a new operator. */
	private insertNode(e: Expr): Expr | null {
		const size = complexity(e);
		return replaceAt(e, this.prng.int(size), (n) => this.randomOp(n, () => this.randomLeaf()));
	}

	/** Replace an operator node by one of its children. */
	private deleteNode(e: Expr): Expr | null {
		const idx = indicesWhere(e, (n) => n.kind === 'unary' || n.kind === 'binary');
		if (idx.length === 0) return null;
		return replaceAt(e, idx[this.prng.int(idx.length)], (n) => {
			if (n.kind === 'unary') return n.child;
			if (n.kind === 'binary') return this.prng.next() < 0.5 ? n.left : n.right;
			return n;
		});
	}

	private crossover(a: Expr, b: Expr): [Expr, Expr] {
		const ia = this.prng.int(complexity(a));
		const ib = this.prng.int(complexity(b));
		const sa = nodeAt(a, ia);
		const sb = nodeAt(b, ib);
		return [replaceAt(a, ia, () => sb), replaceAt(b, ib, () => sa)];
	}

	// --- selection ----------------------------------------------------------------

	private adjustedScore(m: Member): number {
		const f = m.complexity <= this.maxSize ? this.freq[m.complexity] / this.freqTotal : 0;
		return m.loss * Math.exp(this.options.parsimonyScaling * f);
	}

	private tournament(): Member {
		const { tournamentSize, tournamentP } = this.options;
		const picks: Member[] = [];
		for (let i = 0; i < tournamentSize; i++) picks.push(this.pop[this.prng.int(this.pop.length)]);
		const scored = picks.map((m) => ({ m, s: this.adjustedScore(m) }));
		scored.sort((a, b) => a.s - b.s);
		for (const { m } of scored) if (this.prng.next() < tournamentP) return m;
		return scored[0].m;
	}

	private recordFrequency(c: number): void {
		if (c > this.maxSize) return;
		this.freq[c] += 1;
		this.freqTotal += 1;
		// A moving window, as in PySR's running search statistics.
		if (this.freqTotal > 100_000) {
			let t = 0;
			for (let i = 0; i < this.freq.length; i++) t += this.freq[i] = this.freq[i] * 0.5 + 0.5;
			this.freqTotal = t;
		}
	}

	private replaceOldest(m: Member): void {
		this.pop[this.oldest] = m;
		this.oldest = (this.oldest + 1) % this.pop.length;
		this.recordFrequency(m.complexity);
		this.consider(m);
	}

	private consider(m: Member): void {
		if (!Number.isFinite(m.loss) || m.complexity > this.maxSize) return;
		const b = this.stepBest[m.complexity];
		if (!b || m.loss < b.loss) this.stepBest[m.complexity] = m;
	}

	/** Accept per PySR's frequency rule: favour under-represented complexities. */
	private accept(parent: Member, child: Member): boolean {
		const ratio = this.freq[parent.complexity] / this.freq[child.complexity];
		return ratio >= 1 || this.prng.next() < ratio;
	}

	private mutationEvent(): void {
		const parent = this.tournament();
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const e = this.mutate(parent.expr, parent.complexity);
			if (!e) continue;
			const c = complexity(e);
			if (c > this.maxSize) continue;
			const child: Member =
				e === parent.expr ? { ...parent } : { expr: e, complexity: c, loss: this.batchLoss(e) };
			if (!Number.isFinite(child.loss)) continue;
			this.replaceOldest(this.accept(parent, child) ? child : { ...parent });
			return;
		}
		this.replaceOldest({ ...parent });
	}

	private crossoverEvent(): void {
		const p1 = this.tournament();
		const p2 = this.tournament();
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const [a, b] = this.crossover(p1.expr, p2.expr);
			const ca = complexity(a);
			const cb = complexity(b);
			if (ca > this.maxSize || cb > this.maxSize) continue;
			const ma: Member = { expr: a, complexity: ca, loss: this.batchLoss(a) };
			const mb: Member = { expr: b, complexity: cb, loss: this.batchLoss(b) };
			if (!Number.isFinite(ma.loss) || !Number.isFinite(mb.loss)) continue;
			this.replaceOldest(ma);
			this.replaceOldest(mb);
			return;
		}
		this.replaceOldest({ ...p1 });
		this.replaceOldest({ ...p2 });
	}

	private optimizeSome(): void {
		const { optimizeProbability, optimizeIterations } = this.options;
		for (let i = 0; i < this.pop.length; i++) {
			if (this.prng.next() >= optimizeProbability) continue;
			const m = this.pop[i];
			const fit = fitConstants(m.expr, this.batch, optimizeIterations);
			if (fit.improved && fit.mse < m.loss) {
				const nm: Member = { expr: fit.expr, complexity: m.complexity, loss: fit.mse };
				this.pop[i] = nm;
				this.consider(nm);
			}
		}
	}

	private updateHallOfFame(): void {
		const train = this.data.train;
		for (let c = 1; c <= this.maxSize; c++) {
			const m = this.stepBest[c];
			if (!m) continue;
			this.stepBest[c] = null;
			const loss = this.batchIsFull ? m.loss : programMse(compile(m.expr), train.x, train.y);
			if (!Number.isFinite(loss)) continue;
			const h = this.hof[c];
			if (!h || loss < h.loss) this.hof[c] = { complexity: c, expr: m.expr, loss };
		}
	}

	// --- public API ---------------------------------------------------------------

	/** One iteration: a fresh batch, one generation of events, constant optimisation, hall of fame. */
	step(): void {
		if (!this.batchIsFull) {
			this.resample();
			// Stale batch losses would make the members incomparable with the children.
			for (const m of this.pop) m.loss = this.batchLoss(m.expr);
		}
		const events = Math.max(1, Math.round(this.pop.length * this.options.eventsPerMember));
		for (let i = 0; i < events; i++) {
			if (this.prng.next() < this.options.crossoverProbability) this.crossoverEvent();
			else this.mutationEvent();
		}
		this.optimizeSome();
		this.updateHallOfFame();
		this.iterations++;
	}

	/** The best expression per complexity, ascending. */
	hallOfFame(): HallOfFameEntry[] {
		return this.hof.filter((h): h is HallOfFameEntry => h !== null);
	}

	/** Copies of up to `k` good expressions to send to another island. */
	emigrants(k: number): Expr[] {
		const out: Expr[] = [];
		const hof = this.hallOfFame();
		const ranked = [...this.pop]
			.filter((m) => Number.isFinite(m.loss))
			.sort((a, b) => this.adjustedScore(a) - this.adjustedScore(b));
		for (let i = 0; i < k; i++) {
			if (i % 2 === 0 && hof.length > 0) out.push(hof[this.prng.int(hof.length)].expr);
			else if (ranked.length > 0) out.push(ranked[Math.min(i >> 1, ranked.length - 1)].expr);
		}
		return out;
	}

	/** Replace the oldest members with incoming expressions. */
	immigrate(exprs: Expr[]): void {
		for (const e of exprs) {
			const m = this.member(e);
			if (m.complexity > this.maxSize || !Number.isFinite(m.loss)) continue;
			this.replaceOldest(m);
		}
		this.updateHallOfFame();
	}
}
