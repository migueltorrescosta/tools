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

	// Check events are displayed
	const eventRows = page.locator('.event-row');
	await expect(eventRows.first()).toBeVisible();

	// Check today divider exists
	const todayDivider = page.locator('.today-divider-row');
	await expect(todayDivider).toBeVisible();

	// Check tooltip appears on hover
	const firstEvent = eventRows.first();
	await firstEvent.hover();
	const tooltip = page.locator('.tooltip').first();
	await expect(tooltip).toBeVisible();
});

test('Timelines - can change timeline', async ({ page }) => {
	await page.goto('/timelines');

	const select = page.locator('select.timeline-select');

	// Ensure we're on eu-elections first
	await select.selectOption('eu-elections');
	await page.waitForTimeout(200);

	// Get event count for eu-elections
	const electionsEvents = await page.locator('.event-row').count();
	expect(electionsEvents).toBeGreaterThan(0);

	// Select different timeline
	await select.selectOption('eu-key-events');

	// Wait for events to update
	await page.waitForTimeout(200);

	// Check events changed (different count)
	const keyEventsCount = await page.locator('.event-row').count();
	expect(keyEventsCount).not.toBe(electionsEvents);
});

test('Timelines - past events are styled differently', async ({ page }) => {
	await page.goto('/timelines');

	// Get past events
	const pastEvents = page.locator('.event-row.past');

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

		// Count event rows
		const eventCount = await page.locator('.event-row').count();

		// Verify at least one event is displayed
		expect(eventCount, `Timeline "${timelineId}" should show at least one event`).toBeGreaterThan(
			0
		);

		// Verify "No events" message is NOT visible
		const emptyState = page.locator('.empty-state');
		await expect(emptyState).not.toBeVisible();
	}
});
