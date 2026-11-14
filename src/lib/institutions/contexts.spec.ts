import { describe, expect, it } from 'vitest';
import { CONTEXTS, partOf, relationId } from './index';

const unique = (xs: string[]) => new Set(xs).size === xs.length;
const isUrl = (s: string) => /^https:\/\/[^\s]+$/.test(s);

describe('contexts', () => {
	it('have unique ids', () => {
		expect(unique(CONTEXTS.map((c) => c.id))).toBe(true);
	});

	it('name and classify a shared institution the same way everywhere', () => {
		const seen = new Map<string, string>();
		for (const c of CONTEXTS)
			for (const i of c.institutions) {
				const key = `${i.name} (${i.kind})`;
				expect(seen.get(i.id) ?? key, i.id).toBe(key);
				seen.set(i.id, key);
			}
	});

	for (const context of CONTEXTS) {
		describe(context.title, () => {
			const ids = context.institutions.map((i) => i.id);
			const known = new Set(ids);

			it('has a valid as-of date', () => {
				expect(context.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			});

			it('has unique institution and relation ids', () => {
				expect(unique(ids)).toBe(true);
				expect(unique(context.relations.map(relationId))).toBe(true);
			});

			it('sources every institution and relation with https links', () => {
				for (const i of context.institutions) {
					expect(i.sources.length, i.id).toBeGreaterThan(0);
					for (const s of [...i.sources, ...(i.url ? [i.url] : [])]) expect(isUrl(s), s).toBe(true);
				}
				for (const r of context.relations) {
					expect(r.sources.length, relationId(r)).toBeGreaterThan(0);
					for (const s of r.sources) expect(isUrl(s), s).toBe(true);
				}
			});

			it('only links known institutions, never to itself', () => {
				for (const r of context.relations) {
					expect(known.has(r.from), r.from).toBe(true);
					expect(known.has(r.to), r.to).toBe(true);
					expect(r.from).not.toBe(r.to);
				}
			});

			it('connects every institution', () => {
				const touched = new Set(context.relations.flatMap((r) => [r.from, r.to]));
				for (const id of ids) expect(touched.has(id), id).toBe(true);
			});

			it('names overlaps with known institutions', () => {
				for (const i of context.institutions)
					for (const o of i.overlaps) {
						expect(known.has(o.with), `${i.id} overlaps ${o.with}`).toBe(true);
						expect(o.with).not.toBe(i.id);
					}
			});

			it('splits into parts that cover every institution, each small enough to read', () => {
				expect(unique(context.parts.map((p) => p.id))).toBe(true);
				for (const part of context.parts) {
					expect(unique(part.ids), part.id).toBe(true);
					expect(part.ids.length, part.id).toBeLessThanOrEqual(26);
					for (const id of part.ids) expect(known.has(id), `${part.id}: ${id}`).toBe(true);
				}
				const covered = new Set(context.parts.flatMap((p) => p.ids));
				for (const id of ids) expect(covered.has(id), id).toBe(true);
			});

			it('fits every route inside one part', () => {
				for (const route of context.routes)
					expect(
						partOf(
							context,
							route.steps.map((s) => s.id)
						),
						route.id
					).toBeDefined();
			});

			it('walks routes through known institutions', () => {
				expect(unique(context.routes.map((r) => r.id))).toBe(true);
				for (const route of context.routes) {
					expect(route.steps.length, route.id).toBeGreaterThan(1);
					for (const s of route.steps) expect(known.has(s.id), `${route.id}: ${s.id}`).toBe(true);
				}
			});
		});
	}
});
