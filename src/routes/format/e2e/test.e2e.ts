import { expect, test, type Page } from '@playwright/test';

function ui(page: Page) {
	return {
		content: page.getByRole('textbox', { name: /content/i }),
		format: (label: string) => page.getByRole('radio', { name: label, exact: true }),
		status: page.getByRole('status', { name: 'Validation result' }),
		result: page.getByTestId('result-message'),
		placeholder: page.getByTestId('result-placeholder')
	};
}

/** Load the checker and wait until it has hydrated, so clicks and fills are not lost. */
async function open(page: Page) {
	await page.goto('/format');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Format Checker');
}

test.beforeEach(async ({ page }) => {
	await open(page);
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

test('whitespace-only content shows the placeholder, not an error', async ({ page }) => {
	const u = ui(page);
	await u.content.fill('  \n\t ');
	await expect(u.placeholder).toHaveText('Enter content above to validate');
	await expect(u.result).toHaveCount(0);
});

test('the format picker is a radio group and results are announced', async ({ page }) => {
	const u = ui(page);
	await expect(page.getByRole('group', { name: 'Format' })).toBeVisible();
	await expect(u.format('JSON')).toBeChecked();
	await u.format('YAML').click();
	await expect(u.format('YAML')).toBeChecked();
	await expect(u.format('JSON')).not.toBeChecked();
	await expect(u.status).toHaveAttribute('aria-live', 'polite');
	await expect(u.status).toContainText('Valid YAML');
});

test('JSON errors carry a single line and column', async ({ page }) => {
	const u = ui(page);
	await u.content.fill('{\n  "a": 1,\n  "b": x\n}');
	await expect(u.result).toHaveText("Invalid JSON at line 3, column 8: Unexpected token 'x'");
});
