import { defineConfig } from '@playwright/test';

export default defineConfig({
	retries: process.env.CI ? 1 : 0,
	forbidOnly: !!process.env.CI,
	reporter: 'list',
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	},
	testMatch: '**/*.e2e.{ts,js}'
});
