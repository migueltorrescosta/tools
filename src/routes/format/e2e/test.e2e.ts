import { expect, test, type Page } from '@playwright/test';

function ui(page: Page) {
	return {
		content: page.getByRole('textbox'),
		format: (label: string) => page.getByRole('button', { name: label, exact: true }),
		result: page.locator('.result-message'),
		placeholder: page.locator('.result-placeholder')
	};
}

test.beforeEach(async ({ page }) => {
	await page.goto('/format');
	await expect(page.locator('h1')).toHaveText('FORMAT CHECKER');
});

test('validates the JSON example loaded on mount', async ({ page }) => {
	const u = ui(page);
	await expect(u.content).toHaveValue(/"name": "example"/);
	await expect(u.result).toHaveText('Valid JSON');
});

test('switching format re-validates the same content', async ({ page }) => {
	const u = ui(page);
	await expect(u.result).toHaveText('Valid JSON');
	await u.format('XML').click();
	await expect(u.result).toHaveText(/^Invalid XML at line \d+, column \d+: \S/);
	await expect(u.result).not.toContainText('This page contains');
	await u.format('JSON').click();
	await expect(u.result).toHaveText('Valid JSON');
});

test('uses the browser XML parser for well-formedness', async ({ page }) => {
	const u = ui(page);
	await u.format('XML').click();
	await u.content.fill('<a>\n<b></a>');
	await expect(u.result).toHaveText(/^Invalid XML at line 2/);
	await u.content.fill('<root><parsererror/></root>');
	await expect(u.result).toHaveText('Valid XML');
});

test('rejects malformed YAML with its line', async ({ page }) => {
	const u = ui(page);
	await u.format('YAML').click();
	await u.content.fill('key: [unclosed');
	await expect(u.result).toHaveText(/^Invalid YAML at line 1, column \d+: \S/);
	await u.content.fill('key: value');
	await expect(u.result).toHaveText('Valid YAML');
});

test('clearing the content shows the placeholder', async ({ page }) => {
	const u = ui(page);
	await expect(u.result).toHaveText('Valid JSON');
	await u.content.fill('');
	await expect(u.placeholder).toHaveText('Enter content above to validate');
	await expect(u.result).toHaveCount(0);
});
