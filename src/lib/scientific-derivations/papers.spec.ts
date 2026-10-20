import { describe, expect, it } from 'vitest';
import { renderTex } from '$lib/tex';
import { PAPERS, edgeId } from './index';
import { renderProse, stackTex } from './prose';

const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('papers', () => {
	it('have unique ids', () => {
		expect(unique(PAPERS.map((p) => p.id))).toBe(true);
	});

	for (const paper of PAPERS) {
		describe(paper.title, () => {
			const ids = paper.derivations.map((d) => d.id);

			it('has derivations with unique ids', () => {
				expect(ids.length).toBeGreaterThan(0);
				expect(unique(ids)).toBe(true);
			});

			for (const derivation of paper.derivations) {
				describe(derivation.title, () => {
					const nodeIds = derivation.nodes.map((n) => n.id);
					const known = new Set(nodeIds);
					const incoming = new Set(derivation.edges.map((e) => e.to));
					const touched = new Set(derivation.edges.flatMap((e) => [e.from, e.to]));

					it('has unique node and edge ids', () => {
						expect(unique(nodeIds)).toBe(true);
						expect(unique(derivation.edges.map(edgeId))).toBe(true);
					});

					it('only links known nodes, never to itself', () => {
						for (const e of derivation.edges) {
							expect(known.has(e.from), e.from).toBe(true);
							expect(known.has(e.to), e.to).toBe(true);
							expect(e.from).not.toBe(e.to);
						}
					});

					it('derives every step and result, and assumes nothing it derives', () => {
						for (const n of derivation.nodes) {
							expect(touched.has(n.id), n.id).toBe(true);
							expect(incoming.has(n.id), n.id).toBe(n.kind !== 'assumption');
						}
					});

					it('has no cycles', () => {
						const indegree = new Map(nodeIds.map((id) => [id, 0]));
						for (const e of derivation.edges) indegree.set(e.to, indegree.get(e.to)! + 1);
						const queue = nodeIds.filter((id) => indegree.get(id) === 0);
						let seen = 0;
						while (queue.length) {
							const id = queue.shift()!;
							seen++;
							for (const e of derivation.edges.filter((e) => e.from === id)) {
								indegree.set(e.to, indegree.get(e.to)! - 1);
								if (indegree.get(e.to) === 0) queue.push(e.to);
							}
						}
						expect(seen).toBe(nodeIds.length);
					});

					it('imports only from other derivations of the paper', () => {
						for (const n of derivation.nodes) {
							const ok = n.from === undefined || (ids.includes(n.from) && n.from !== derivation.id);
							expect(ok, n.id).toBe(true);
						}
					});

					it('renders all TeX and prose without KaTeX errors', () => {
						const prose = [
							derivation.summary,
							...derivation.nodes.flatMap((n) => [n.detail, n.correction]),
							...derivation.edges.flatMap((e) => [e.label, e.detail, e.correction])
						].filter((x): x is string => !!x);
						for (const n of derivation.nodes) {
							expect(renderTex(n.tex, true), n.id).not.toContain('katex-error');
							expect(renderTex(stackTex(n.tex), true), n.id).not.toContain('katex-error');
						}
						for (const text of prose) {
							expect(renderProse(text), text).not.toContain('katex-error');
						}
					});
				});
			}
		});
	}
});
