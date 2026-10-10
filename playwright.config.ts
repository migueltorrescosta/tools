import { defineConfig } from '@playwright/test';

export default defineConfig({
	retries: 1,
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	},
	testMatch: '**/*.e2e.{ts,js}'
});
