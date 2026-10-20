import { describe, expect, it } from 'vitest';
import { edgePath, layoutGraph } from './layout';

const box = { width: 120, height: 40 };
const label = { width: 60, height: 20 };

describe('layoutGraph', () => {
	const layout = layoutGraph({ a: box, b: box, c: box }, [
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
});

describe('row cap', () => {
	it('pushes extra inputs up so no row holds more than the cap', () => {
		const ids = ['a', 'b', 'c', 'd', 'e'];
		const layout = layoutGraph(
			Object.fromEntries([...ids, 'z'].map((id) => [id, box])),
			ids.map((id) => ({ id: `${id}->z`, from: id, to: 'z', label })),
			3
		);
		const rows = new Map<number, number>();
		for (const id of ids) {
			const y = Math.round(layout.nodes[id].y);
			rows.set(y, (rows.get(y) ?? 0) + 1);
		}
		expect(Math.max(...rows.values())).toBeLessThanOrEqual(3);
		expect(rows.size).toBeGreaterThan(1);
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
