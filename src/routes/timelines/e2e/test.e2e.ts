import { expect, test } from '@playwright/test';

test('Timelines - loads with dynamic imports', async ({ page }) => {
	await page.goto('/timelines');

	// Check page title
	await expect(page.locator('h1')).toHaveText('TIMELINES');

	// Wait for timeline selector to be visible
	await expect(page.locator('.timeline-select')).toBeVisible();

	// Wait for events to load (the initial pick may be rich or non-rich)
	await expect(page.locator('.event-card, .rich-event-card').first()).toBeVisible({
		timeout: 15000
	});
});

test('Timelines - switch between timelines', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	const firstTitle = page.locator('.event-card .event-title').first();
	await expect(firstTitle).toBeVisible({ timeout: 10000 });
	// Titles can repeat across years (e.g. two Finland presidential elections), so count
	// every card with that title instead of requiring a unique match.
	const electionTitles = page.locator('.event-card .event-title').filter({
		hasText: new RegExp(
			`^${((await firstTitle.textContent()) ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
		)
	});
	expect(await electionTitles.count()).toBeGreaterThan(0);

	await page.selectOption('.timeline-select', 'eu-key-events');

	// The URL follows the selection, the new timeline renders and the old one is gone.
	await expect(page).toHaveURL(/[?&]t=eu-key-events(&|$)/);
	await expect(page.getByText('Treaty of Rome', { exact: true })).toBeVisible({ timeout: 10000 });
	await expect(electionTitles).toHaveCount(0);

	// Year separators run in ascending order.
	const years = (await page.locator('.year-label').allTextContents()).map(Number);
	expect(years.length).toBeGreaterThan(1);
	expect(years).toEqual([...years].sort((x, y) => x - y));
});

test('Timelines - invalid ?t falls back to a timeline and writes it to the URL', async ({
	page
}) => {
	await page.goto('/timelines?t=bogus');
	await expect(page.locator('.event-card, .rich-event-card').first()).toBeVisible({
		timeout: 15000
	});
	const selected = await page.locator('.timeline-select').inputValue();
	expect(selected).not.toBe('bogus');
	await expect(page).toHaveURL(new RegExp(`[?&]t=${selected}(&|$)`));
});

test('Timelines - focusing a card shows its description', async ({ page }) => {
	await page.goto('/timelines?t=eu-elections');
	const info = page.locator('.event-card .event-info').first();
	await expect(info).toBeVisible({ timeout: 10000 });

	await info.focus();
	const tooltip = page.getByRole('tooltip');
	await expect(tooltip).toBeVisible();
	await expect(tooltip).not.toHaveText('');
	await expect(info).toHaveAttribute('aria-describedby', 'timeline-event-tooltip');
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
	// Start on a known non-rich timeline for deterministic behavior
	await page.goto('/timelines?t=eu-elections');

	// Wait for initial event cards to load
	await expect(page.locator('.event-card').first()).toBeVisible({ timeout: 10000 });

	// Switch to LLM breakthroughs
	await page.selectOption('.timeline-select', 'llm-breakthroughs');

	// Should now show rich cards instead of standard event cards
	await expect(page.locator('.rich-event-card').first()).toBeVisible({ timeout: 15000 });
});
