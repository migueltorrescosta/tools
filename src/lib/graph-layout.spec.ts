import { describe, expect, it } from 'vitest';
import { dataflow } from './information-pricing/dataflow';
import { presetModel } from './information-pricing/presets';
import { edgePath, layoutGraph, type GraphLayout, type Point } from './graph-layout';

const box = { width: 120, height: 40 };
const label = { width: 60, height: 20 };

describe('layoutGraph', async () => {
	const layout = await layoutGraph({ a: box, b: box, c: box }, [
		{ id: 'a->c', from: 'a', to: 'c', label },
		{ id: 'b->c', from: 'b', to: 'c', label }
	]);

	it('places premises above their conclusion', () => {
		expect(layout.nodes.a.y).toBeLessThan(layout.nodes.c.y);
		expect(layout.nodes.b.y).toBeLessThan(layout.nodes.c.y);
	});

	it('keeps nodes from overlapping and inside the bounds', () => {
		const { a, b } = layout.nodes;
		expect(Math.abs(a.x - b.x) >= box.width || Math.abs(a.y - b.y) >= box.height).toBe(true);
		for (const p of Object.values(layout.nodes)) {
			expect(p.x - box.width / 2).toBeGreaterThanOrEqual(0);
			expect(p.x + box.width / 2).toBeLessThanOrEqual(layout.width);
			expect(p.y + box.height / 2).toBeLessThanOrEqual(layout.height);
		}
	});

	it('routes every edge between its endpoints', () => {
		const { points } = layout.edges['a->c'];
		expect(points.length).toBeGreaterThanOrEqual(2);
		expect(points[0].y).toBeLessThan(points.at(-1)!.y);
	});

	it('gives each label its own space between its endpoints', () => {
		const { label: at, points } = layout.edges['a->c'];
		expect(at.y).toBeGreaterThan(points[0].y);
		expect(at.y).toBeLessThan(points.at(-1)!.y);
		for (const id of ['a', 'b', 'c']) {
			const n = layout.nodes[id];
			const apart =
				Math.abs(n.x - at.x) >= (box.width + label.width) / 2 ||
				Math.abs(n.y - at.y) >= (box.height + label.height) / 2;
			expect(apart).toBe(true);
		}
	});
});

/** Crossings between edges that share no endpoint, segment by segment. */
function crossings(layout: GraphLayout, edges: { id: string; from: string; to: string }[]) {
	const side = (p: Point, q: Point, r: Point) =>
		Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
	const segments = (id: string) => {
		const p = layout.edges[id].points;
		return p.slice(1).map((q, i) => [p[i], q]);
	};
	let count = 0;
	for (const [i, a] of edges.entries())
		for (const b of edges.slice(i + 1)) {
			if (a.from === b.from || a.to === b.to) continue;
			for (const [p, q] of segments(a.id))
				for (const [r, s] of segments(b.id))
					if (side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0) count++;
		}
	return count;
}

describe('the Portuguese IRC dataflow', () => {
	it('crosses far less than the old layout (48 crossings) and keeps inputs near their uses', async () => {
		const graph = dataflow(presetModel('portuguese-irc'), {
			input: (i) => `input-${i}`,
			intermediate: (i) => `intermediate-${i}`
		});
		const layout = await layoutGraph(
			Object.fromEntries(graph.nodes.map((n) => [n.id, { width: 130, height: 46 }])),
			graph.edges
		);
		expect(crossings(layout, graph.edges)).toBeLessThanOrEqual(30);
		// Every node sits on some row above whatever it feeds
		for (const e of graph.edges) expect(layout.nodes[e.from].y).toBeLessThan(layout.nodes[e.to].y);
	});
});

describe('edgePath', () => {
	it('draws a straight segment for two points and curves at bends', () => {
		expect(
			edgePath([
				{ x: 0, y: 0 },
				{ x: 0, y: 10 }
			])
		).toBe('M0,0 L0,10');
		expect(
			edgePath([
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 10 }
			])
		).toBe('M0,0 Q10,10 15,10 L20,10');
	});
});
