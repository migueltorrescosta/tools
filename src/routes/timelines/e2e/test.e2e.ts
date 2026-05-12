import { expect, test } from '@playwright/test';

test('Timelines - loads with dynamic imports', async ({ page }) => {
	await page.goto('/timelines');

	// Check page title
	await expect(page.locator('h1')).toHaveText('TIMELINES');

	// Wait for timeline selector to be visible
	await expect(page.locator('.timeline-select')).toBeVisible();

	// Check that loading state appears briefly then disappears
	await page.waitForSelector('.events-container .loading-state', { state: 'visible', timeout: 5000 });
	await page.waitForSelector('.events-container .loading-state', { state: 'hidden', timeout: 10000 });

	// Check that events are displayed
	await expect(page.locator('.event-card').first()).toBeVisible({ timeout: 10000 });
});

test('Timelines - switch between timelines', async ({ page }) => {
	await page.goto('/timelines');

	// Wait for initial load
	await page.waitForSelector('.event-card', { state: 'visible', timeout: 10000 });

	// Count initial events
	const initialEventCount = await page.locator('.event-card').count();

	// Select a different timeline
	await page.selectOption('.timeline-select', 'eu-key-events');

	// Wait for loading and new content
	await page.waitForSelector('.loading-state', { state: 'visible', timeout: 2000 });
	await page.waitForSelector('.loading-state', { state: 'hidden', timeout: 10000 });

	// Check that events changed
	const newEventCount = await page.locator('.event-card').count();
	expect(newEventCount).toBeGreaterThan(0);
});

test('Timelines - verify URL parameter', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');

	// Wait for content to load
	await page.waitForSelector('.event-card', { state: 'visible', timeout: 10000 });

	// Check that the correct timeline is selected
	const selectedValue = await page.locator('.timeline-select').inputValue();
	expect(selectedValue).toBe('eu-elections');
});

test('Timelines - LLM breakthroughs shows rich card layout', async ({ page }) => {
	await page.goto('/timelines?t=llm-breakthroughs');

	// Wait for rich event cards to load
	await page.waitForSelector('.rich-event-card', { state: 'visible', timeout: 10000 });

	// Verify rich card elements are present
	const firstCard = page.locator('.rich-event-card').first();

	// Should have an emoji
	await expect(firstCard.locator('.rich-card-emoji')).toBeVisible();

	// Should have a clickable title link
	const titleLink = firstCard.locator('.rich-card-title');
	await expect(titleLink).toBeVisible();
	await expect(titleLink).toHaveAttribute('target', '_blank');

	// Should have a description
	await expect(firstCard.locator('.rich-card-description')).toBeVisible();

	// Should have a value-add with ✦ prefix
	const valueAdd = firstCard.locator('.rich-card-value-add');
	await expect(valueAdd).toBeVisible();
	await expect(valueAdd).toContainText('✦');

	// Verify year separators are present
	await expect(page.locator('.year-separator').first()).toBeVisible();
});

test('Timelines - switching to LLM breakthroughs shows rich cards', async ({ page }) => {
	await page.goto('/timelines');

	// Wait for initial load
	await page.waitForSelector('.event-card', { state: 'visible', timeout: 10000 });

	// Switch to LLM breakthroughs
	await page.selectOption('.timeline-select', 'llm-breakthroughs');

	// Wait for loading and new content
	await page.waitForSelector('.loading-state', { state: 'visible', timeout: 2000 });
	await page.waitForSelector('.loading-state', { state: 'hidden', timeout: 10000 });

	// Should now show rich cards
	await expect(page.locator('.rich-event-card').first()).toBeVisible({ timeout: 10000 });
});
