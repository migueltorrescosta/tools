/**
 * Policy tree: a shallow tree over the random inputs that assigns a decision
 * to every scenario, minimising the mean opportunity loss. It fits on the
 * first 80 % of rows and is scored on the last 20 % (port of the reference
 * implementation's `build_policy_tree`, including its merge-up of children
 * that split on their parent's input into one multi-way split).
 */

import { argsortStable, pairwiseSum } from './numeric';

export interface TreeOptions {
	/** Maximum depth; the root is depth 0. Default 3. */
	maxDepth?: number;
	/**
	 * Minimum risk reduction a split must beat. An integer ≥ 1 is absolute;
	 * a value in [0, 1) is a fraction of the training root risk. Default 0.001.
	 */
	minImpurityDecrease?: number;
	/**
	 * Minimum rows per leaf. An integer ≥ 1 is absolute; a value in [0, 1) is
	 * a fraction of all rows, rounded up. Default 0.01.
	 */
	minSamplesLeaf?: number;
}

export const DEFAULT_TREE_OPTIONS: Required<TreeOptions> = {
	maxDepth: 3,
	minImpurityDecrease: 0.001,
	minSamplesLeaf: 0.01
};

interface NodeBase {
	/** Position in the final node list; the root is 0 and children follow their parent. */
	id: number;
	depth: number;
	/** Training rows routed to the node. */
	samples: number;
	/** Smallest mean training loss over decisions in the node. */
	risk: number;
	/** Decision index the node's policy assigns (best on its training rows). */
	decision: number;
	/** Mean held-out loss of following the tree from this node; NaN without held-out rows. */
	outOfSampleLoss: number;
	/** Mean held-out loss of the status-quo decision on the node's held-out rows. */
	statusQuoLoss: number;
	/** `statusQuoLoss` minus the held-out loss of the node's own decision. */
	savings: number;
}

export interface InternalNode extends NodeBase {
	kind: 'internal';
	/** Input index the node splits on. */
	splitInput: number;
	/** Ascending thresholds: value ≤ t0 → children[0], t(i-1) < value ≤ t(i) → children[i], else the last child. */
	thresholds: number[];
	children: number[];
}

export interface LeafNode extends NodeBase {
	kind: 'leaf';
	/** Mean training loss of the leaf's decision. */
	inSampleLoss: number;
}

export type PolicyNode = InternalNode | LeafNode;

export interface PolicyTree {
	/** Nodes by id, root first. */
	nodes: PolicyNode[];
	/** Held-out mean loss of the single best training decision. */
	rootExpectedLoss: number;
	/** Held-out mean loss of following the tree. */
	expectedLoss: number;
	/** `rootExpectedLoss - expectedLoss`. */
	valueOfInformation: number;
	/** The status-quo decision: best on the whole training set. */
	statusQuo: number;
	trainCount: number;
	testCount: number;
}

export class PolicyTreeError extends Error {}

interface Split {
	input: number;
	threshold: number;
	reduction: number;
	k: number;
	/** Stable order of the node's rows by the split input. */
	order: Uint32Array;
}

type Draft =
	| (Omit<InternalNode, 'outOfSampleLoss' | 'statusQuoLoss' | 'savings'> & { kind: 'internal' })
	| (Omit<LeafNode, 'outOfSampleLoss' | 'statusQuoLoss' | 'savings'> & { kind: 'leaf' });

function resolveCount(value: number, name: string, reference: number, round: boolean): number {
	if (!Number.isFinite(value) || value < 0)
		throw new RangeError(`${name} must be ≥ 0, got ${value}`);
	if (Number.isInteger(value) && value >= 1) return value;
	if (value > 1)
		throw new RangeError(`${name} must be an integer or a fraction in [0, 1], got ${value}`);
	return round ? Math.ceil(reference * value) : reference * value;
}

/**
 * Learn the policy tree from the inputs and the row-major loss matrix
 * (`n × D`). Throws `PolicyTreeError` with fewer than two rows, non-finite
 * inputs, or a zero held-out root risk (nothing to improve on).
 */
export function buildPolicyTree(
	inputs: Float64Array[],
	loss: Float64Array,
	D: number,
	options: TreeOptions = {}
): PolicyTree {
	const { maxDepth, minImpurityDecrease, minSamplesLeaf } = { ...DEFAULT_TREE_OPTIONS, ...options };
	if (!Number.isInteger(maxDepth) || maxDepth < 0) {
		throw new RangeError(`maxDepth must be a non-negative integer, got ${maxDepth}`);
	}
	const n = loss.length / D;
	if (n < 2) throw new PolicyTreeError(`the policy tree needs at least two scenarios, got ${n}`);
	for (const column of inputs) {
		for (let i = 0; i < n; i++) {
			if (!Number.isFinite(column[i]))
				throw new PolicyTreeError('the policy tree needs finite inputs');
		}
	}
	const trainCount = Math.trunc(n * 0.8);
	const leafMin = resolveCount(minSamplesLeaf, 'minSamplesLeaf', n, true);

	const means = (rows: Uint32Array): Float64Array => {
		const out = new Float64Array(D);
		for (let t = 0; t < rows.length; t++) {
			const row = rows[t] * D;
			for (let d = 0; d < D; d++) out[d] += loss[row + d];
		}
		for (let d = 0; d < D; d++) out[d] /= rows.length;
		return out;
	};
	const minIndex = (a: Float64Array): number => {
		let best = 0;
		for (let d = 1; d < a.length; d++) if (a[d] < a[best]) best = d;
		return best;
	};
	const allTrain = new Uint32Array(trainCount);
	for (let i = 0; i < trainCount; i++) allTrain[i] = i;
	const rootMeans = means(allTrain);
	const rootRisk = rootMeans[minIndex(rootMeans)];
	const improvementMin = resolveCount(minImpurityDecrease, 'minImpurityDecrease', rootRisk, false);

	const gather = (column: Float64Array, rows: Uint32Array): Float64Array => {
		const out = new Float64Array(rows.length);
		for (let t = 0; t < rows.length; t++) out[t] = column[rows[t]];
		return out;
	};
	const take = (rows: Uint32Array, order: Uint32Array, from: number, to: number): Uint32Array => {
		const out = new Uint32Array(to - from);
		for (let t = from; t < to; t++) out[t - from] = rows[order[t]];
		return out;
	};

	// Train rows of each input sorted by (value, row), for large nodes.
	const presorted = inputs.map((column) => {
		const values = column.subarray(0, trainCount);
		const order = argsortStable(values);
		const sorted = new Float64Array(trainCount);
		for (let t = 0; t < trainCount; t++) sorted[t] = values[order[t]];
		return { order, values: sorted };
	});
	const position = new Int32Array(trainCount).fill(-1);
	/**
	 * Positions into `rows` sorted stably by input j, and the sorted values:
	 * `np.argsort(column[rows], kind="stable")`. Large row sets filter the
	 * presorted train rows, then restore the tie order (position in `rows`).
	 */
	const sortRows = (rows: Uint32Array, j: number): { order: Uint32Array; sorted: Float64Array } => {
		const m = rows.length;
		if (m * 8 < trainCount) {
			const values = gather(inputs[j], rows);
			const order = argsortStable(values);
			const sorted = new Float64Array(m);
			for (let t = 0; t < m; t++) sorted[t] = values[order[t]];
			return { order, sorted };
		}
		for (let t = 0; t < m; t++) position[rows[t]] = t;
		const order = new Uint32Array(m);
		const sorted = new Float64Array(m);
		const all = presorted[j];
		for (let k = 0, c = 0; c < m; k++) {
			const p = position[all.order[k]];
			if (p < 0) continue;
			order[c] = p;
			sorted[c++] = all.values[k];
		}
		for (let t = 0; t < m; t++) position[rows[t]] = -1;
		for (let a = 0; a < m;) {
			let b = a + 1;
			while (b < m && sorted[b] === sorted[a]) b++;
			if (b - a > 1) order.subarray(a, b).sort();
			a = b;
		}
		return { order, sorted };
	};

	const totals = new Float64Array(D);
	const prefix = new Float64Array(D);
	let sortedLoss = new Float64Array(0);
	let nodeLoss = new Float64Array(0);
	// The search is deterministic in the rows, and merge-up asks again for the
	// same row sets the reference re-evaluates, so results are cached.
	const cache = new WeakMap<Uint32Array, Split | null>();
	const findBestSplit = (rows: Uint32Array): Split | null => {
		const cached = cache.get(rows);
		if (cached !== undefined) return cached;
		const nr = rows.length;
		let best: Split | null = null;
		let bestReduction = 0;
		if (sortedLoss.length < nr * D) {
			sortedLoss = new Float64Array(nr * D);
			nodeLoss = new Float64Array(nr * D);
		}
		// The node's loss rows, contiguous: the per-input gathers below stay
		// within the node's own rows.
		for (let t = 0, out = 0; t < nr; t++) {
			const row = rows[t] * D;
			for (let d = 0; d < D; d++, out++) nodeLoss[out] = loss[row + d];
		}
		const m = new Float64Array(D);
		for (let out = 0; out < nr * D; out += D) for (let d = 0; d < D; d++) m[d] += nodeLoss[out + d];
		for (let d = 0; d < D; d++) m[d] /= nr;
		const riskR = m[minIndex(m)];
		for (let j = 0; j < inputs.length; j++) {
			const { order, sorted } = sortRows(rows, j);
			// Loss rows in sorted order, contiguous; totals sum them in that order.
			totals.fill(0);
			for (let t = 0, out = 0; t < nr; t++) {
				const row = order[t] * D;
				for (let d = 0; d < D; d++, out++) {
					const v = nodeLoss[row + d];
					sortedLoss[out] = v;
					totals[d] += v;
				}
			}
			prefix.fill(0);
			let inputBest = -Infinity;
			let inputK = -1;
			for (let t = 0; t < nr - 1; t++) {
				const base = t * D;
				for (let d = 0; d < D; d++) prefix[d] += sortedLoss[base + d];
				const k = t + 1;
				if (k < leafMin || k > nr - leafMin || sorted[t] === sorted[k]) continue;
				// Division by a positive count is monotone, so dividing the smallest
				// sum gives exactly the smallest of the per-decision means.
				let leftSum = prefix[0];
				let rightSum = totals[0] - prefix[0];
				for (let d = 1; d < D; d++) {
					const r = totals[d] - prefix[d];
					if (prefix[d] < leftSum) leftSum = prefix[d];
					if (r < rightSum) rightSum = r;
				}
				const left = leftSum / k;
				const right = rightSum / (nr - k);
				const reduction = riskR - (k / nr) * left - ((nr - k) / nr) * right;
				if (reduction > inputBest) {
					inputBest = reduction;
					inputK = k;
				}
			}
			if (inputK < 0) continue;
			if (inputBest > bestReduction) {
				bestReduction = inputBest;
				const threshold = (sorted[inputK - 1] + sorted[inputK]) / 2;
				best = { input: j, threshold, reduction: inputBest, k: inputK, order };
			}
		}
		const result = best === null || bestReduction <= improvementMin ? null : best;
		cache.set(rows, result);
		return result;
	};

	const records = new Map<number, Draft>();
	const absorbed = new Set<number>();
	const nodeRows = new Map<number, Uint32Array>();
	const pending: { id: number; rows: Uint32Array; depth: number }[] = [
		{ id: 0, rows: allTrain, depth: 0 }
	];
	let head = 0;
	let nextId = 1;
	nodeRows.set(0, allTrain);

	const leafDraft = (id: number, depth: number, rows: Uint32Array): Draft => {
		const m = means(rows);
		const decision = minIndex(m);
		return {
			kind: 'leaf',
			id,
			depth,
			samples: rows.length,
			risk: m[decision],
			decision,
			inSampleLoss: m[decision]
		};
	};

	const mergeUp = (nodeId: number, splitInput: number, depth: number): void => {
		for (;;) {
			const parent = records.get(nodeId);
			if (parent?.kind !== 'internal') return;
			const toAbsorb: { child: number; rows: Uint32Array; split: Split }[] = [];
			for (const child of parent.children) {
				if (absorbed.has(child)) continue;
				const rows = nodeRows.get(child);
				// A child at maxDepth cannot split, so there is nothing to absorb.
				if (depth + 1 >= maxDepth || rows === undefined || rows.length < 2 * leafMin) continue;
				const split = findBestSplit(rows);
				if (split !== null && split.input === splitInput) toAbsorb.push({ child, rows, split });
			}
			if (toAbsorb.length === 0) return;
			const thresholds = [...parent.thresholds];
			const intervals: Uint32Array[] = parent.children.map((child) =>
				absorbed.has(child) ? new Uint32Array(0) : (nodeRows.get(child) ?? new Uint32Array(0))
			);
			toAbsorb.sort((a, b) => parent.children.indexOf(b.child) - parent.children.indexOf(a.child));
			for (const { child, rows, split } of toAbsorb) {
				absorbed.add(child);
				const index = parent.children.indexOf(child);
				thresholds.push(split.threshold);
				const values = gather(inputs[splitInput], rows);
				const order = argsortStable(values);
				let cut = 0;
				while (cut < rows.length && values[order[cut]] <= split.threshold) cut++;
				intervals.splice(index, 1, take(rows, order, 0, cut), take(rows, order, cut, rows.length));
			}
			thresholds.sort((a, b) => a - b);
			const children: number[] = [];
			const created: Draft[] = [];
			const internals: { id: number; input: number }[] = [];
			for (const rows of intervals) {
				const split =
					depth + 1 < maxDepth && rows.length >= 2 * leafMin ? findBestSplit(rows) : null;
				const id = nextId++;
				children.push(id);
				if (split !== null && split.input !== splitInput) {
					const m = means(rows);
					const decision = minIndex(m);
					const left = nextId;
					const right = nextId + 1;
					nextId += 2;
					created.push({
						kind: 'internal',
						id,
						depth: depth + 1,
						samples: rows.length,
						risk: m[decision],
						splitInput: split.input,
						thresholds: [split.threshold],
						children: [left, right],
						decision
					});
					const leftRows = take(rows, split.order, 0, split.k);
					const rightRows = take(rows, split.order, split.k, rows.length);
					pending.push({ id: left, rows: leftRows, depth: depth + 2 });
					nodeRows.set(left, leftRows);
					pending.push({ id: right, rows: rightRows, depth: depth + 2 });
					nodeRows.set(right, rightRows);
					internals.push({ id, input: split.input });
				} else {
					created.push(leafDraft(id, depth + 1, rows));
				}
			}
			records.set(nodeId, { ...parent, thresholds, children });
			for (const old of parent.children) absorbed.add(old);
			for (const record of created) records.set(record.id, record);
			for (const { id, input } of internals) mergeUp(id, input, depth + 1);
		}
	};

	while (head < pending.length) {
		const { id, rows, depth } = pending[head++];
		if (absorbed.has(id)) continue;
		const best = depth >= maxDepth || rows.length < 2 * leafMin ? null : findBestSplit(rows);
		if (best === null) {
			records.set(id, leafDraft(id, depth, rows));
			continue;
		}
		const m = means(rows);
		const decision = minIndex(m);
		records.set(id, {
			kind: 'internal',
			id,
			depth,
			samples: rows.length,
			risk: m[decision],
			splitInput: best.input,
			thresholds: [best.threshold],
			children: [nextId, nextId + 1],
			decision
		});
		const leftRows = take(rows, best.order, 0, best.k);
		const rightRows = take(rows, best.order, best.k, rows.length);
		pending.push({ id: nextId, rows: leftRows, depth: depth + 1 });
		nodeRows.set(nextId, leftRows);
		pending.push({ id: nextId + 1, rows: rightRows, depth: depth + 1 });
		nodeRows.set(nextId + 1, rightRows);
		nextId += 2;
		mergeUp(id, best.input, depth);
	}

	return evaluate(records, absorbed, inputs, loss, D, n, trainCount, rootMeans);
}

function evaluate(
	records: Map<number, Draft>,
	absorbed: Set<number>,
	inputs: Float64Array[],
	loss: Float64Array,
	D: number,
	n: number,
	trainCount: number,
	trainMeans: Float64Array
): PolicyTree {
	const drafts = [...records.keys()]
		.sort((a, b) => a - b)
		.filter((id) => !absorbed.has(id))
		.map((id) => records.get(id) as Draft);
	const count = drafts.length;
	const position = new Map(drafts.map((node, p) => [node.id, p]));
	const children = drafts.map((node) =>
		node.kind === 'internal' ? node.children.map((c) => position.get(c) as number) : []
	);
	const testCount = n - trainCount;
	const leafOf = new Uint32Array(testCount);
	for (let t = 0; t < testCount; t++) {
		const row = trainCount + t;
		let p = 0;
		for (;;) {
			const node = drafts[p];
			if (node.kind === 'leaf') break;
			const value = inputs[node.splitInput][row];
			let c = 0;
			for (const threshold of node.thresholds) {
				if (value > threshold) c++;
				else break;
			}
			p = children[p][c];
		}
		leafOf[t] = p;
	}
	const oosSum = new Float64Array(count);
	const oosCount = new Float64Array(count);
	const decisionSums = new Float64Array(D * count);
	for (let t = 0; t < testCount; t++) {
		const p = leafOf[t];
		const row = (trainCount + t) * D;
		oosSum[p] += loss[row + drafts[p].decision];
		oosCount[p]++;
		for (let d = 0; d < D; d++) decisionSums[d * count + p] += loss[row + d];
	}
	for (let p = count - 1; p >= 0; p--) {
		for (const c of children[p]) {
			oosSum[p] += oosSum[c];
			oosCount[p] += oosCount[c];
		}
	}
	for (let d = 0; d < D; d++) {
		for (let p = count - 1; p >= 0; p--) {
			for (const c of children[p]) decisionSums[d * count + p] += decisionSums[d * count + c];
		}
	}
	let statusQuo = 0;
	for (let d = 1; d < D; d++) if (trainMeans[d] < trainMeans[statusQuo]) statusQuo = d;
	const rootExpectedLoss = pairwiseSum(loss, trainCount * D + statusQuo, testCount, D) / testCount;
	if (rootExpectedLoss === 0) {
		throw new PolicyTreeError(
			'the held-out root risk is zero: the best decision loses nothing, so a tree cannot improve on it'
		);
	}
	const nodes: PolicyNode[] = drafts.map((draft, p) => {
		const c = oosCount[p];
		const statusQuoLoss = c === 0 ? NaN : decisionSums[statusQuo * count + p] / c;
		const savings = c === 0 ? NaN : statusQuoLoss - decisionSums[draft.decision * count + p] / c;
		const metrics = { id: p, outOfSampleLoss: oosSum[p] / c, statusQuoLoss, savings };
		return draft.kind === 'internal'
			? { ...draft, ...metrics, thresholds: [...draft.thresholds], children: children[p] }
			: { ...draft, ...metrics };
	});
	const expectedLoss = nodes[0].outOfSampleLoss;
	return {
		nodes,
		rootExpectedLoss,
		expectedLoss,
		valueOfInformation: rootExpectedLoss - expectedLoss,
		statusQuo,
		trainCount,
		testCount
	};
}
