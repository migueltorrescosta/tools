import { describe, expect, it } from 'vitest';
import type { Scenarios } from '../types';
import { lossDistributions } from './distributions';
import { lossSummary } from './losses';
import { lossMatrix } from './numeric';
import { buildPolicyTree, PolicyTreeError, type InternalNode } from './tree';
import { policyTreeView } from './tree-view';
import { crossValidatedLoss, valueOfInformation } from './voi';

function scenarios(inputs: Record<string, Float64Array>, rewards: Float64Array[]): Scenarios {
	const n = rewards[0].length;
	const optimal = Float64Array.from({ length: n }, (_, i) => Math.max(...rewards.map((r) => r[i])));
	return {
		n,
		inputs: Object.entries(inputs).map(([symbol, column]) => ({ symbol, column })),
		intermediates: [],
		decisions: rewards.map((_, d) => 'ABC'[d]),
		rewards,
		optimal
	};
}

/**
 * Three regimes along x (A below 60, B up to 140, C above), y nearly noise.
 * Expected values come from the reference implementation on the same data.
 */
function regimes(): Scenarios {
	const n = 200;
	const x = Float64Array.from({ length: n }, (_, i) => (i * 37) % 200);
	const y = Float64Array.from({ length: n }, (_, i) => (i * 91) % 200);
	return scenarios({ x, y }, [
		x.map((v, i) => (v < 60 ? 10 : 0) + y[i] / 1000),
		x.map((v) => (v >= 60 && v < 140 ? 10 : 1)),
		x.map((v, i) => (v >= 140 ? 10 : 0) + (y[i] > 100 ? 0.5 : 0))
	]);
}

describe('buildPolicyTree', () => {
	it('merges a repeated split on x into one three-way split', () => {
		const s = regimes();
		const tree = buildPolicyTree(
			s.inputs.map((i) => i.column),
			lossMatrix(s),
			3,
			{ minSamplesLeaf: 5 }
		);
		expect(tree.nodes.length).toBe(4);
		const root = tree.nodes[0] as InternalNode;
		expect(root.kind).toBe('internal');
		expect(root.splitInput).toBe(0);
		expect(root.thresholds).toEqual([60, 139.5]);
		expect(root.children).toEqual([1, 2, 3]);
		expect(root.samples).toBe(160);
		expect(root.decision).toBe(1);
		expect(tree.nodes.slice(1).map((n) => [n.kind, n.decision, n.samples, n.depth])).toEqual([
			['leaf', 0, 49, 1],
			['leaf', 1, 64, 1],
			['leaf', 2, 47, 1]
		]);
		expect(tree.statusQuo).toBe(1);
		expect(tree.rootExpectedLoss).toBeCloseTo(5.5379, 12);
		expect(tree.expectedLoss).toBeCloseTo(0.2455, 12);
		expect(tree.nodes[1].outOfSampleLoss).toBeCloseTo(0.8183333333333334, 12);
		expect(tree.nodes[1].savings).toBeCloseTo(7.516333333333332, 12);
		expect(tree.nodes[3].savings).toBeCloseTo(9.346153846153847, 12);
		expect(tree.nodes[2].savings).toBe(0);
		expect(tree.nodes[0].savings).toBe(0);
	});

	it('never grows past maxDepth, merge-up included', () => {
		const s = regimes();
		const grow = (maxDepth: number) =>
			buildPolicyTree(
				s.inputs.map((i) => i.column),
				lossMatrix(s),
				3,
				{ minSamplesLeaf: 5, maxDepth }
			);
		// At depth 1 the children are leaves, so the repeated split on x cannot merge up.
		const shallow = grow(1);
		expect((shallow.nodes[0] as InternalNode).thresholds).toHaveLength(1);
		for (const maxDepth of [1, 2, 3]) {
			expect(Math.max(...grow(maxDepth).nodes.map((n) => n.depth))).toBeLessThanOrEqual(maxDepth);
		}
	});

	it('describes the nodes for the diagram', () => {
		const s = regimes();
		const tree = buildPolicyTree(
			s.inputs.map((i) => i.column),
			lossMatrix(s),
			3,
			{ minSamplesLeaf: 5 }
		);
		const view = policyTreeView(tree, { decisions: s.decisions, inputs: ['x', 'y'], unit: '€' });
		expect(view.nodes.map((n) => n.shareLabel)).toEqual(['100.0%', '30.6%', '40.0%', '29.4%']);
		// The largest savings, about 9.3, scales into milli-units as the reference does.
		expect(view.exponent).toBe(-1);
		expect(view.nodes.map((n) => n.savingsLabel)).toEqual(['0 m€', '7516 m€', '0 m€', '9346 m€']);
		expect(view.nodes.map((n) => n.isStatusQuo)).toEqual([true, false, true, false]);
		expect(view.splits).toEqual([
			{
				node: 0,
				input: 0,
				inputLabel: 'x',
				inputColour: 0,
				edges: [
					{ child: 1, label: '≤60' },
					{ child: 2, label: '∈(60,139.5]' },
					{ child: 3, label: '>139.5' }
				]
			}
		]);
		expect(view.nodes[3].fill).toBe(1);
		expect(view.footer).toEqual(['savings versus the status quo: B']);
	});

	it('grows nothing at depth 0 and rejects degenerate data', () => {
		const s = regimes();
		const columns = s.inputs.map((i) => i.column);
		const stump = buildPolicyTree(columns, lossMatrix(s), 3, { maxDepth: 0 });
		expect(stump.nodes.map((n) => n.kind)).toEqual(['leaf']);
		expect(stump.valueOfInformation).toBeCloseTo(0, 12);
		const flat = scenarios({ x: Float64Array.from([1, 2, 3, 4, 5]) }, [
			new Float64Array(5).fill(1),
			new Float64Array(5)
		]);
		expect(() => buildPolicyTree([flat.inputs[0].column], lossMatrix(flat), 2)).toThrow(
			PolicyTreeError
		);
		expect(() => buildPolicyTree(columns, lossMatrix(s), 3, { minSamplesLeaf: 2.5 })).toThrow(
			RangeError
		);
	});
});

describe('value of information', () => {
	it('scores tiny folds with the training mean when a group has no training row', () => {
		// Seven rows, seven groups: every row's group is empty in its own training folds.
		const s = scenarios({ x: Float64Array.from([0, 1, 2, 3, 4, 5, 6]) }, [
			Float64Array.from([1, 0, 3, 0, 2, 0, 5]),
			Float64Array.from([0, 2, 0, 1, 0, 4, 1])
		]);
		const loss = lossMatrix(s);
		expect(crossValidatedLoss(loss, 2, Uint8Array.from([0, 1, 2, 3, 4, 5, 6]), 7)).toBe(0.8);
		expect(crossValidatedLoss(loss, 2, Uint8Array.from([0, 0, 0, 0, 1, 1, 1]), 2)).toBe(1.8);
		const summary = lossSummary(s, '');
		expect(summary.expectedLoss[0]).toBe(1);
		const voi = valueOfInformation([s.inputs[0].column], loss, 2, 1, [2, 7]);
		expect(Array.from(voi.savings[0])).toEqual([1 - 1.8, 1 - 0.8]);
	});

	it('matches the reference on the regimes data', () => {
		const s = regimes();
		const loss = lossMatrix(s);
		const summary = lossSummary(s, '€', loss);
		expect(Array.from(summary.expectedLoss)).toEqual(
			[7.01205, 5.51155, 6.86405].map((v) => expect.closeTo(v, 12))
		);
		expect(summary.best).toBe(1);
		expect(summary.worstFirst).toEqual([0, 2, 1]);
		const voi = valueOfInformation(
			s.inputs.map((i) => i.column),
			loss,
			3,
			summary.expectedLoss[summary.best],
			[2, 3, 4]
		);
		expect(Array.from(voi.savings[0])).toEqual(
			[1.5862499999999997, 4.824865, 4.591875].map((v) => expect.closeTo(v, 12))
		);
		voi.savings[1].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-12));
		expect(voi.order).toEqual([0, 1]);
	});
});

describe('lossDistributions', () => {
	it('puts whiskers on data points inside the percentiles', () => {
		const n = 101;
		const r = Float64Array.from({ length: n }, (_, i) => i);
		const s = scenarios({ x: r }, [r, new Float64Array(n)]);
		const [first, second] = lossDistributions(lossMatrix(s), 2, { bins: 10 });
		expect(first.expectedLoss).toBe(0);
		expect(second.box.q1).toBe(25);
		expect(second.box.median).toBe(50);
		expect(second.box.whiskerLow).toBe(5);
		expect(second.box.whiskerHigh).toBe(95);
		expect(second.box.fliersLow + second.box.fliersHigh).toBe(10);
		expect(Array.from(second.histogram.counts)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 11]);
	});
});
