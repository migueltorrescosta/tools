import Elk from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';
import { buildPolicyTree, policyTreeView } from '#lib/information-pricing/analysis/index.js';
import { thresholdLabels } from './format';
import { useElk } from '#lib/graph-layout.js';
import { layoutTree, nodeLines } from './tree-layout';

useElk(new Elk());

describe('layoutTree', () => {
	it('places every node and split inside the drawing, splits between their node and children', async () => {
		// One input decides: decision 0 is best below 0.5, decision 1 above.
		const n = 2000;
		const x = Float64Array.from({ length: n }, (_, i) => ((i * 7919) % n) / n);
		const loss = new Float64Array(n * 2);
		for (let i = 0; i < n; i++) loss[i * 2 + (x[i] < 0.5 ? 1 : 0)] = 1;
		const tree = buildPolicyTree([x], loss, 2);
		const view = policyTreeView(tree, { decisions: ['a', 'b'], unit: '€' });
		const layout = await layoutTree(view, ['x']);
		expect(layout.nodes).toHaveLength(view.nodes.length);
		expect(layout.splits).toHaveLength(view.splits.length);
		expect(view.splits.length).toBeGreaterThan(0);
		for (const b of [...layout.nodes, ...layout.splits]) {
			expect(b.x - b.width / 2).toBeGreaterThanOrEqual(0);
			expect(b.x + b.width / 2).toBeLessThanOrEqual(layout.width);
			expect(b.y + b.height / 2).toBeLessThanOrEqual(layout.height);
		}
		const split = layout.splits[0];
		const parent = layout.nodes.find((b) => b.id === split.node)!;
		expect(split.y).toBeGreaterThan(parent.y);
		for (const e of view.splits[0].edges) {
			const child = layout.nodes.find((b) => b.id === e.child)!;
			expect(child.y).toBeGreaterThan(split.y);
		}
		// Edge labels use the axes' compact numbers, not the reference's raw thresholds
		expect(layout.edges.filter((e) => e.label).map((e) => e.label!.text)).toEqual(
			view.splits.flatMap((s) => thresholdLabels(s.thresholds))
		);
	});

	it('draws every split’s children left to right in ascending order of the split input', async () => {
		const n = 4000;
		const x = Float64Array.from({ length: n }, (_, i) => ((i * 7919) % n) / n);
		const y = Float64Array.from({ length: n }, (_, i) => ((i * 104729 + 13) % 3989) / 3989);
		// Best decision per scenario: a two-way split on x, a three-way split on x, and a split on
		// y under a split on x.
		const policies = [
			(u: number) => (u < 0.5 ? 1 : 0),
			(u: number) => (u < 0.3 ? 1 : u < 0.7 ? 0 : 2),
			(u: number, v: number) => (u < 0.5 ? (v < 0.4 ? 0 : 1) : v < 0.6 ? 2 : 1)
		];
		const widths = new Set<number>();
		for (const best of policies) {
			const loss = new Float64Array(n * 3).fill(1);
			for (let i = 0; i < n; i++) loss[i * 3 + best(x[i], y[i])] = 0;
			const view = policyTreeView(buildPolicyTree([x, y], loss, 3), {
				decisions: ['a', 'b', 'c'],
				unit: '€'
			});
			const layout = await layoutTree(view, ['x', 'y']);
			for (const s of view.splits) {
				widths.add(s.edges.length);
				const xs = s.edges.map((e) => layout.nodes.find((b) => b.id === e.child)!.x);
				expect(xs).toEqual([...xs].sort((a, b) => a - b));
				const labelXs = s.edges.map(
					(e) => layout.edges.find((l) => l.id === `s${s.node}-n${e.child}`)!.label!.x
				);
				expect(labelXs).toEqual([...labelXs].sort((a, b) => a - b));
			}
		}
		// The fixtures cover two- and three-way splits.
		expect([...widths].sort()).toEqual([2, 3]);
	});

	it('shows each box as two lines, savings then share, never the decision', () => {
		const n = 2000;
		const x = Float64Array.from({ length: n }, (_, i) => ((i * 7919) % n) / n);
		const loss = new Float64Array(n * 2);
		for (let i = 0; i < n; i++) loss[i * 2 + (x[i] < 0.5 ? 1 : 0)] = 1;
		const view = policyTreeView(buildPolicyTree([x], loss, 2), {
			decisions: ['first', 'second'],
			unit: '€'
		});
		for (const node of view.nodes) {
			const lines = nodeLines(node);
			expect(lines).toEqual([node.savingsLabel, node.shareLabel]);
			expect(lines.join(' ')).not.toMatch(/first|second|saves|scenarios/);
		}
		const leaf = view.nodes.find(
			(v) => !view.splits.some((s) => s.node === v.id) && !v.isStatusQuo
		)!;
		expect(leaf.savingsLabel).toMatch(/^[\d.]+ \S*€$/);
		expect(leaf.shareLabel).toMatch(/^\d+(\.\d)?%$/);
	});
});
