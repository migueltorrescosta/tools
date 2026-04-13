import { expect, test } from '@playwright/test';

test('Wordle Solver - page loads correctly', async ({ page }) => {
	await page.goto('/wordle');
	await page.waitForLoadState('networkidle');

	// Verify main heading
	await expect(page.locator('h1')).toHaveText('WORDLE SOLVER');

	// Verify game panel is visible
	await expect(page.locator('.wordle-panel')).toBeVisible();

	// Verify legend is present
	await expect(page.locator('.legend')).toBeVisible();
	await expect(page.locator('.legend-letter.black')).toBeVisible();
	await expect(page.locator('.legend-letter.yellow')).toBeVisible();
	await expect(page.locator('.legend-letter.green')).toBeVisible();
});

test('Wordle Solver - keyboard input functionality', async ({ page }) => {
	await page.goto('/wordle');
	await page.waitForLoadState('networkidle');

	// Get the tile inputs
	const tileInputs = page.locator('.tile-input');
	await expect(tileInputs).toHaveCount(5);

	// Click first tile to cycle through colors
	await tileInputs.first().click();

	// Verify the tile has a color class applied (should cycle to yellow)
	await expect(tileInputs.first()).toHaveClass(/yellow/);

	// Click again to cycle to green
	await tileInputs.first().click();
	await expect(tileInputs.first()).toHaveClass(/green/);

	// Click again to cycle back to black
	await tileInputs.first().click();
	await expect(tileInputs.first()).toHaveClass(/black/);
});

test('Wordle Solver - submit and restart flow', async ({ page }) => {
	await page.goto('/wordle');
	await page.waitForLoadState('networkidle');

	// Submit button should be visible
	const submitBtn = page.locator('button:has-text("Submit")');
	await expect(submitBtn).toBeVisible();

	// Get tile inputs
	const tileInputs = page.locator('.tile-input');

	// Invalid result (all blacks - not valid pattern for solver)
	await tileInputs.nth(0).click();
	await tileInputs.nth(1).click();
	await tileInputs.nth(2).click();
	await tileInputs.nth(3).click();
	await tileInputs.nth(4).click();

	// Click submit with black result (invalid - no valid words)
	await submitBtn.click();

	// Should show an error or continue (depends on solution tree state)
	// The tool shows error if no words match the result
	const errorMessage = page.locator('.error-message');
	await expect(errorMessage).toBeVisible();
});

test('Wordle Solver - restart game button appears on game over', async ({ page }) => {
	await page.goto('/wordle');
	await page.waitForLoadState('networkidle');

	// Trigger game over by submitting invalid pattern
	const tileInputs = page.locator('.tile-input');
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).click();
	}

	await page.locator('button:has-text("Submit")').click();

	// Wait for error
	await page.waitForSelector('.error-message', { timeout: 5000 });

	// Restart button should appear
	const restartBtn = page.locator('button:has-text("Start New Game")');
	await expect(restartBtn).toBeVisible();

	// Click restart
	await restartBtn.click();

	// Game should be reset - submit button should be visible again
	await expect(page.locator('button:has-text("Submit")')).toBeVisible();
});
