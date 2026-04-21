import { expect, test } from '@playwright/test';

test('Volt Representatives - page loads correctly', async ({ page }) => {
	await page.goto('/volt');

	await expect(page.locator('h1')).toHaveText('VOLT REPRESENTATIVES');

	// Check Gantt container is visible
	const ganttContainer = page.locator('.gantt-container');
	await expect(ganttContainer).toBeVisible();
});

test('Volt - all existing filters have at least one candidate', async ({ page }) => {
	await page.goto('/volt');

	// Get unique country names to test
	const countriesToTest = [
		'France',
		'Germany',
		'Greece',
		'Italy',
		'Netherlands',
		'Portugal',
		'Romania',
		'MEPs'
	];

	// Test each filter
	for (const countryName of countriesToTest) {
		// Click the filter button
		await page.locator('.bar-chart .bar-row').filter({ hasText: countryName }).click();

		// Wait for UI to update
		await page.waitForTimeout(300);

		// Check gantt container has at least one country row
		const countryRows = page.locator('.gantt-country');
		const rowCount = await countryRows.count();

		expect(rowCount, `Filter "${countryName}" should show at least one country`).toBeGreaterThan(0);
	}
});

test('Volt - gantt bars have links', async ({ page }) => {
	await page.goto('/volt');

	// Get all bar links
	const barLinks = page.locator('.gantt-container .bar-link');
	await expect(barLinks.first()).toBeVisible();

	// Get count and verify there are links
	const linkCount = await barLinks.count();
	expect(linkCount).toBeGreaterThan(0);

	// Check first link has correct attributes for external opening
	const firstLink = barLinks.first();
	await expect(firstLink).toHaveAttribute('target', '_blank');
	await expect(firstLink).toHaveAttribute('rel', /noopener noreferrer/);

	// Check href is valid URL
	const href = await firstLink.getAttribute('href');
	expect(href).toMatch(/^https?:\/\//);
});

test('Volt - filtered stats update', async ({ page }) => {
	await page.goto('/volt');

	// Get the Germany bar row and its count
	const germanyBar = page.locator('.bar-row').filter({ hasText: 'Germany' });
	const germanyCountText = await germanyBar.locator('.bar-value').textContent();
	const germanyCount = parseInt(germanyCountText || '0');

	// Germany count should be greater than 0
	expect(germanyCount).toBeGreaterThan(0);

	// Get all gantt country rows before filtering
	const countryRowsBefore = page.locator('.gantt-country');
	const rowCountBefore = await countryRowsBefore.count();

	// Click the Germany bar in summary panel to filter
	await germanyBar.click();
	await page.waitForTimeout(300);

	// Row count should be less than before (filtered)
	const countryRowsAfter = page.locator('.gantt-country');
	const rowCountAfter = await countryRowsAfter.count();

	// Verify row count changed (filtering worked)
	expect(rowCountAfter).toBeLessThan(rowCountBefore);

	// Click "All" to clear filter - should restore original row count
	const allBar = page.locator('.bar-row').filter({ hasText: 'All' });
	await allBar.click();
	await page.waitForTimeout(300);

	// Row count should be back to original
	const rowCountAfterAll = await countryRowsBefore.count();
	expect(rowCountAfterAll).toBe(rowCountBefore);
});
