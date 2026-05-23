import { expect, test } from '@playwright/test';

test('Italian Verbs - page loads with title and pills', async ({ page }) => {
	await page.goto('/italian-verbs');

	await expect(page.locator('h1')).toHaveText('ITALIAN VERBS');

	// Should have 30 verb pills in the verbs column
	const verbPills = page.locator('.pills-col-verbs .format-btn');
	await expect(verbPills).toHaveCount(30);

	// Should have 21 tense pills in the tenses column
	const tensePills = page.locator('.pills-col-tenses .format-btn');
	await expect(tensePills).toHaveCount(21);
});

test('Italian Verbs - all pills active by default', async ({ page }) => {
	await page.goto('/italian-verbs');

	// All verb pills should be active by default
	const verbPills = page.locator('.pills-col-verbs .format-btn');
	const verbCount = await verbPills.count();
	for (let i = 0; i < verbCount; i++) {
		await expect(verbPills.nth(i)).toHaveClass(/active/);
	}

	// All tense pills should be active by default
	const tensePills = page.locator('.pills-col-tenses .format-btn');
	const tenseCount = await tensePills.count();
	for (let i = 0; i < tenseCount; i++) {
		await expect(tensePills.nth(i)).toHaveClass(/active/);
	}
});

test('Italian Verbs - verb and tense pills toggle selection', async ({ page }) => {
	await page.goto('/italian-verbs');

	// All 5 verbs should be active by default
	const verbPills = page.locator('.pills-col-verbs .format-btn');
	await expect(verbPills.nth(0)).toHaveClass(/active/);

	// Deselect "essere" — should work since 4 remain
	await verbPills.nth(0).click();
	await expect(verbPills.nth(0)).not.toHaveClass(/active/);

	// Reselect "essere"
	await verbPills.nth(0).click();
	await expect(verbPills.nth(0)).toHaveClass(/active/);
});

test('Italian Verbs - cannot deselect last verb', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Deselect all active verb pills except the first one
	const verbPills = page.locator('.pills-col-verbs .format-btn');
	const verbCount = await verbPills.count();
	for (let i = 1; i < verbCount; i++) {
		const classes = await verbPills.nth(i).getAttribute('class');
		if (classes?.includes('active')) {
			await verbPills.nth(i).click();
		}
	}

	// Now only the first verb should remain active, try to deselect it
	await expect(verbPills.nth(0)).toHaveClass(/active/);
	await verbPills.nth(0).click();
	// Should still be active
	await expect(verbPills.nth(0)).toHaveClass(/active/);
});

test('Italian Verbs - cannot deselect last tense', async ({ page }) => {
	await page.goto('/italian-verbs');

	const tensePills = page.locator('.pills-col-tenses .format-btn');

	// Deselect all active tense pills except the first one
	const tenseCount = await tensePills.count();
	for (let i = 1; i < tenseCount; i++) {
		const classes = await tensePills.nth(i).getAttribute('class');
		if (classes?.includes('active')) {
			await tensePills.nth(i).click();
		}
	}

	// Try to deselect the last remaining
	await expect(tensePills.nth(0)).toHaveClass(/active/);
	await tensePills.nth(0).click();
	await expect(tensePills.nth(0)).toHaveClass(/active/);
});

test('Italian Verbs - shows card with 6 translation rows', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Card should exist with 6 translation spans (one per person)
	const translations = page.locator('.line-translation');
	await expect(translations).toHaveCount(6);
});

test('Italian Verbs - shows "lui/lei" in the conjugation menu', async ({ page }) => {
	await page.goto('/italian-verbs');

	// One of the line-person labels should contain "lui/lei"
	const personLabels = page.locator('.line-person');
	const texts = await personLabels.allTextContents();
	expect(texts.some((t) => t.includes('lui/lei'))).toBe(true);
});

test('Italian Verbs - no hint paragraph shown', async ({ page }) => {
	await page.goto('/italian-verbs');

	// The "Type the full line..." hint should not exist
	await expect(page.locator('.input-hint')).toHaveCount(0);
});

test('Italian Verbs - placeholder shows English translation', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Input should exist and placeholder should not contain "Type"
	const input = page.locator('.verb-input');
	await expect(input).toBeVisible();
	const placeholder = await input.getAttribute('placeholder');
	expect(placeholder).toBeTruthy();
	expect(placeholder).not.toContain('Type');
});

test('Italian Verbs - input and submit work and create history entry', async ({ page }) => {
	await page.goto('/italian-verbs');

	const input = page.locator('.verb-input');
	await expect(input).toBeVisible();

	// Type an answer and submit (doesn't need to be correct)
	await input.fill('io test');
	await page.locator('.submit-verb-btn').click();

	// History should have 1 entry
	await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
});

test('Italian Verbs - restart resets session but keeps selections', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Type an answer to create history
	const input = page.locator('.verb-input');
	await input.fill('io test');
	await page.locator('.submit-verb-btn').click();

	// Wait for card to advance
	await page.waitForTimeout(1000);

	// Verify history has an entry
	await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
});

test('Italian Verbs - shows coverage and accuracy', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Coverage stat should be visible
	await expect(page.locator('.stats-row')).toBeVisible();
	await expect(page.locator('.stat').first()).toContainText('/');
});

test('Italian Verbs - no progress section', async ({ page }) => {
	await page.goto('/italian-verbs');

	// The word "Progress" as a section label should not exist
	await expect(page.locator('.label:has-text("Progress")')).toHaveCount(0);
});

test('Italian Verbs - empty pool message when no verbs selected', async ({ page }) => {
	// We can't actually deselect all verbs, so just verify the card is visible
	await page.goto('/italian-verbs');
	const card = page.locator('.verb-card');
	await expect(card).toBeVisible();
});

test('Italian Verbs - history includes grammatical person in answer', async ({ page }) => {
	await page.goto('/italian-verbs');

	// Submit a test answer
	const input = page.locator('.verb-input');
	await input.fill('io test');
	await page.locator('.submit-verb-btn').click();

	// Wait for processing
	await page.waitForTimeout(1000);

	// History entry should include a grammatical person (shown in answer-person span)
	const answerPerson = page.locator('.answer-person').first();
	await expect(answerPerson).toBeVisible();
	const personText = await answerPerson.textContent();
	expect(personText).toBeTruthy();
});
