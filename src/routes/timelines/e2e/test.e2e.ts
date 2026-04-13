import { expect, test } from '@playwright/test';

test('Timelines - loads and displays events', async ({ page }) => {
	await page.goto('/timelines');

	await expect(page.locator('h1')).toHaveText('TIMELINES');

	// Check dropdown exists and has options
	const select = page.locator('select.timeline-select');
	await expect(select).toBeVisible();

	// Get all timeline options
	const options = await select.locator('option').allTextContents();
	expect(options.length).toBeGreaterThan(0);
	expect(options).toContain('🇪🇺 European National Elections');
	expect(options).toContain('🔑 Key Events of the EU');

	// Check events are displayed in cards
	const eventCards = page.locator('.event-card');
	await expect(eventCards.first()).toBeVisible();

	// Check year separators are visible
	const yearSeparators = page.locator('.year-separator');
	await expect(yearSeparators.first()).toBeVisible();

	// Check that events are displayed in a grid with 3 columns (select eu-key-events to ensure we have enough events)
	await select.selectOption('eu-key-events');
	await page.waitForTimeout(500);
	const gridRows = page.locator('.grid-row');
	await expect(gridRows.first()).toBeVisible();

	// Get all grid rows and find one with 3 cards
	const allRows = await gridRows.all();
	let foundRowWithThree = false;
	for (const row of allRows) {
		const count = await row.locator('.event-card').count();
		if (count >= 3) {
			foundRowWithThree = true;
			break;
		}
	}
	expect(foundRowWithThree).toBe(true);

	// Check tooltip appears on hover
	const firstEvent = eventCards.first();
	await firstEvent.hover();
	// Wait a bit for the global tooltip to render
	await page.waitForTimeout(100);
	const tooltip = page.locator('.global-tooltip');
	await expect(tooltip).toBeVisible();
});

test('Timelines - can change timeline', async ({ page }) => {
	await page.goto('/timelines');

	const select = page.locator('select.timeline-select');

	// Ensure we're on eu-elections first
	await select.selectOption('eu-elections');
	await page.waitForTimeout(200);

	// Get event count for eu-elections
	const electionsEvents = await page.locator('.event-card').count();
	expect(electionsEvents).toBeGreaterThan(0);

	// Select different timeline
	await select.selectOption('eu-key-events');

	// Wait for events to update
	await page.waitForTimeout(200);

	// Check events changed (different count)
	const keyEventsCount = await page.locator('.event-card').count();
	expect(keyEventsCount).not.toBe(electionsEvents);
});

test('Timelines - past events are styled differently', async ({ page }) => {
	await page.goto('/timelines');

	// Get past events
	const pastEvents = page.locator('.event-card.past');

	// Some past events should exist
	await expect(pastEvents.first()).toBeVisible();
});

test('Timelines - all timelines show at least one event', async ({ page }) => {
	await page.goto('/timelines');

	const select = page.locator('select.timeline-select');

	// Get all timeline option values
	const timelineOptions = await select.locator('option').all();
	const timelineIds: string[] = [];

	for (const option of timelineOptions) {
		const value = await option.getAttribute('value');
		if (value) {
			timelineIds.push(value);
		}
	}

	expect(timelineIds.length).toBeGreaterThan(0);

	// Test each timeline
	for (const timelineId of timelineIds) {
		// Select this timeline
		await select.selectOption(timelineId);

		// Wait for UI to update
		await page.waitForTimeout(200);

		// Count event cards
		const eventCount = await page.locator('.event-card').count();

		// Verify at least one event is displayed
		expect(eventCount, `Timeline "${timelineId}" should show at least one event`).toBeGreaterThan(
			0
		);

		// Verify "No events" message is NOT visible
		const emptyState = page.locator('.empty-state');
		await expect(emptyState).not.toBeVisible();
	}
});

test('Timelines - events are in chronological order across years', async ({ page }) => {
	await page.goto('/timelines');

	const select = page.locator('select.timeline-select');
	await select.selectOption('eu-key-events');
	await page.waitForTimeout(200);

	// Get all year labels in order
	const yearLabels = await page.locator('.year-label').allTextContents();

	// Verify years are in ascending order
	for (let i = 1; i < yearLabels.length; i++) {
		const prevYear = parseInt(yearLabels[i - 1]);
		const currYear = parseInt(yearLabels[i]);
		expect(prevYear).toBeLessThan(currYear);
	}

	// Verify we have the expected years for eu-key-events (should include: 1957, 1999, 2004, 2007, 2020, 2022, 2023, 2024, 2025, 2026, 2027)
	expect(yearLabels.length).toBeGreaterThan(5);
});
