import { expect, test, type Page } from '@playwright/test';

function ui(page: Page) {
	return {
		content: page.getByRole('textbox', { name: /content/i }),
		format: (label: string) => page.getByRole('radio', { name: label, exact: true }),
		status: page.getByRole('status', { name: 'Validation result' }),
		result: page.getByTestId('result-message'),
		placeholder: page.getByTestId('result-placeholder'),
		example: page.getByRole('button', { name: 'Try an example' })
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

test('opens empty, then fills and validates the JSON example on request', async ({ page }) => {
	const u = ui(page);
	await expect(u.content).toHaveValue('');
	await expect(u.placeholder).toHaveText('Enter content above to validate');
	await expect(u.result).toHaveCount(0);
	await u.example.click();
	await expect(u.content).toHaveValue(/"name": "example"/);
	await expect(u.result).toHaveText('Valid JSON');
	await expect(u.example).toHaveCount(0);
});

test('the verdict sits directly under the text box', async ({ page }) => {
	const u = ui(page);
	await u.example.click();
	const box = await u.content.boundingBox();
	const verdict = await u.result.boundingBox();
	expect(box && verdict).toBeTruthy();
	expect(verdict!.y).toBeGreaterThan(box!.y + box!.height);
	expect(verdict!.y - (box!.y + box!.height)).toBeLessThan(40);
	await expect(page.getByRole('heading', { name: 'Validation result' })).toHaveCount(0);
});

test('the five formats fit on one row on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const tops = await page
		.getByRole('group', { name: 'Format' })
		.getByRole('radio')
		.evaluateAll((els) =>
			els.map((el) => Math.round((el.closest('label') ?? el).getBoundingClientRect().top))
		);
	expect(tops).toHaveLength(5);
	expect(new Set(tops).size).toBe(1);
});

test('switching format re-validates the same content', async ({ page }) => {
	const u = ui(page);
	await u.example.click();
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
	await u.example.click();
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
	await u.content.fill('key: value');
	await expect(u.status).toHaveAttribute('aria-live', 'polite');
	await expect(u.status).toContainText('Valid YAML');
});

test('JSON errors carry a single line and column', async ({ page }) => {
	const u = ui(page);
	await u.content.fill('{\n  "a": 1,\n  "b": x\n}');
	await expect(u.result).toHaveText("Invalid JSON at line 3, column 8: Unexpected token 'x'");
});

test('the picker, the result and How it works sit in the one Content box', async ({ page }) => {
	const box = page.locator('.ui-panel');
	await expect(box).toHaveCount(1);
	await expect(box.getByRole('group', { name: 'Format' })).toBeVisible();
	await expect(box.getByRole('status', { name: 'Validation result' })).toBeVisible();
	const how = box.getByText('How it works', { exact: true });
	await how.click();
	await expect(box.getByRole('link', { name: 'docs' })).toBeVisible();
});
