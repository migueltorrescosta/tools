import { describe, it, expect } from 'vitest';
import config from '../../playwright.config';

describe('Playwright config', () => {
	it('starts the dev server with pnpm, the only package manager this repo tracks', () => {
		const webServer = config.webServer;
		const servers = Array.isArray(webServer) ? webServer : webServer ? [webServer] : [];
		expect(servers.length).toBeGreaterThan(0);
		for (const server of servers) {
			expect(server.command).toMatch(/^pnpm\b/);
			expect(server.command).not.toMatch(/\b(npm|npx|yarn)\b/);
		}
	});
});
