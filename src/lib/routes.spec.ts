import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { routes } from './routes';

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

	it('lists volt-ga', () => {
		expect(routes.some((r) => r.path === '/volt-ga')).toBe(true);
	});

	it('gives every route a name and description', () => {
		for (const r of routes) {
			expect(r.name.trim()).not.toBe('');
			expect(r.description.trim()).not.toBe('');
		}
	});
});
