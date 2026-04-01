import { expect, test } from '@playwright/test';

test('Asset Splitting - full algorithm flow', async ({ page }) => {
	page.on('console', (msg) => {
		const t = msg.type();
		if (t === 'error') {
			console.log('CONSOLE error:', msg.text());
		}
	});

	await page.goto('/split');
	await page.waitForLoadState('networkidle');

	await expect(page.locator('h1')).toHaveText('ASSET SPLITTING');

	// Add people
	await page.fill('input[placeholder="Name"]', 'Alice');
	await page.click('input[value="Add"]');
	await page.fill('input[placeholder="Name"]', 'Bob');
	await page.click('input[value="Add"]');

	await expect(page.locator('.split-person-item:has-text("Alice")')).toBeVisible();
	await expect(page.locator('.split-person-item:has-text("Bob")')).toBeVisible();

	// Add items
	await page.fill('input[placeholder="Description"]', 'Car');
	await page.fill('input[placeholder="Price"]', '10000');
	await page.click('button:has-text("Add Item")');
	await page.fill('input[placeholder="Description"]', 'House');
	await page.fill('input[placeholder="Price"]', '50000');
	await page.click('button:has-text("Add Item")');

	await expect(page.locator('.split-table td:has-text("Car")')).toBeVisible();
	await expect(page.locator('.split-table td:has-text("House")')).toBeVisible();

	// Start algorithm
	await page.click('#start-algorithm');

	// Wait for the round panel
	await page.waitForSelector('.panel-title:has-text("ROUND")', { timeout: 10000 });

	// Verify selection grid appears
	await expect(page.locator('.selection-grid')).toBeVisible();
	await expect(page.locator('.selection-row')).toHaveCount(2);

	// Make selections
	await page.selectOption('select.algorithm-select >> nth=0', '0');
	await page.selectOption('select.algorithm-select >> nth=1', '1');

	// Complete round
	await page.waitForSelector('button:has-text("COMPLETE ROUND"):not([disabled])', {
		timeout: 5000
	});
	await page.click('button:has-text("COMPLETE ROUND")');

	// Verify round incremented
	await expect(page.locator('.panel-title:has-text("ROUND 1")')).toBeVisible();
});
