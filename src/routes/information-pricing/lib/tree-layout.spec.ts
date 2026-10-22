import { describe, expect, it } from 'vitest';
import { buildPolicyTree, policyTreeView } from '$lib/information-pricing/analysis';
import { layoutTree, nodeLines } from './tree-layout';

describe('layoutTree', () => {
	it('places every node and split inside the drawing, splits between their node and children', () => {
		// One input decides: decision 0 is best below 0.5, decision 1 above.
		const n = 2000;
		const x = Float64Array.from({ length: n }, (_, i) => ((i * 7919) % n) / n);
		const loss = new Float64Array(n * 2);
		for (let i = 0; i < n; i++) loss[i * 2 + (x[i] < 0.5 ? 1 : 0)] = 1;
		const tree = buildPolicyTree([x], loss, 2);
		const view = policyTreeView(tree, { decisions: ['a', 'b'], inputs: ['x'], unit: '€' });
		const layout = layoutTree(view);
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
		expect(layout.edges.filter((e) => e.label).map((e) => e.label!.text)).toEqual(
			view.splits.flatMap((s) => s.edges.map((e) => e.label))
		);
	});

	it('shows each box as two lines, savings then share, never the decision', () => {
		const n = 2000;
		const x = Float64Array.from({ length: n }, (_, i) => ((i * 7919) % n) / n);
		const loss = new Float64Array(n * 2);
		for (let i = 0; i < n; i++) loss[i * 2 + (x[i] < 0.5 ? 1 : 0)] = 1;
		const view = policyTreeView(buildPolicyTree([x], loss, 2), {
			decisions: ['first', 'second'],
			inputs: ['x'],
			unit: '€'
		});
		for (const node of view.nodes) {
			const lines = nodeLines(node);
			expect(lines).toEqual([node.savingsLabel, node.shareLabel]);
			expect(lines.join(' ')).not.toMatch(/first|second|saves|scenarios/);
		}
		const leaf = view.nodes.find((v) => v.kind === 'leaf' && !v.isStatusQuo)!;
		expect(leaf.savingsLabel).toMatch(/^[\d.]+ \S*€$/);
		expect(leaf.shareLabel).toMatch(/^\d+(\.\d)?%$/);
	});
});
