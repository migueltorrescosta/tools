import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { routes, TOOL_GROUPS } from './routes';

const routesDir = resolve('src/routes');
const toolDirs = readdirSync(routesDir, { withFileTypes: true })
	.filter((d) => d.isDirectory() && existsSync(resolve(routesDir, d.name, '+page.svelte')))
	.map((d) => `/${d.name}`)
	.sort();

describe('index page routes', () => {
	it('lists every tool route exactly once', () => {
		const listed = routes.map((r) => r.path);
		expect(new Set(listed).size).toBe(listed.length);
		expect([...listed].sort()).toEqual(toolDirs);
	});

	it('gives every route a name and description', () => {
		for (const r of routes) {
			expect(r.name.trim()).not.toBe('');
			expect(r.description.trim()).not.toBe('');
		}
	});

	it('puts every route in a known group and leaves no group empty', () => {
		for (const r of routes) expect(TOOL_GROUPS).toContain(r.group);
		for (const g of TOOL_GROUPS) expect(routes.some((r) => r.group === g)).toBe(true);
	});

	it('keeps descriptions to one short sentence', () => {
		for (const r of routes) {
			expect(r.description.length, r.path).toBeLessThanOrEqual(60);
			expect(r.description.endsWith('.'), r.path).toBe(true);
		}
	});
});
