import { expect, test, type Page } from '@playwright/test';

/** Load the solver and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/wordle');
	await expect(page.locator('.wordle-panel[data-hydrated]')).toBeVisible();
}

test('Wordle Solver - page loads correctly', async ({ page }) => {
	await open(page);

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
	await open(page);

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

test('Wordle Solver - pattern absent from the tree shows the no-match error', async ({ page }) => {
	await open(page);

	const submitBtn = page.locator('button:has-text("Submit")');
	await expect(submitBtn).toBeVisible();

	// One click per tile turns every tile yellow: YYYYY is not a key of the root tree
	const tileInputs = page.locator('.tile-input');
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).click();
	}
	await submitBtn.click();

	await expect(page.locator('.error-message')).toContainText('no words');
});

test('Wordle Solver - happy path suggests the next word and records history up to a win', async ({
	page
}) => {
	await open(page);
	const tileInputs = page.locator('.tile-input');
	const submitBtn = page.locator('button:has-text("Submit")');

	// RAISE scored BBBBB: the tree suggests MULCH
	await submitBtn.click();
	await expect(page.locator('.input-tiles')).toHaveText('MULCH');
	await expect(page.locator('.result-tiles')).toHaveCount(1);

	// MULCH scored BYYBB: the tree suggests FLUNK
	await tileInputs.nth(1).press('y');
	await tileInputs.nth(2).press('y');
	await submitBtn.click();
	await expect(page.locator('.input-tiles')).toHaveText('FLUNK');
	const rows = page.locator('.result-tiles');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveText('RAISE');
	await expect(rows.nth(1)).toHaveText('MULCH');
	await expect(rows.nth(1).locator('.tile').nth(1)).toHaveClass(/yellow/);
	await expect(rows.nth(1).locator('.tile').nth(2)).toHaveClass(/yellow/);

	// FLUNK scored GGGGG: the game is won
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).press('g');
	}
	await submitBtn.click();
	await expect(page.locator('.error-message')).toHaveText('CONGRATULATIONS');
	await expect(page.locator('button:has-text("Start New Game")')).toBeVisible();
	// The input row is gone once the game is won: no placeholder glyphs, nothing to click.
	await expect(page.locator('.tile-input')).toHaveCount(0);
});

test('Wordle Solver - reaching a leaf names the answer and GGGGG confirms it', async ({ page }) => {
	await open(page);
	const tileInputs = page.locator('.tile-input');
	const submitBtn = page.locator('button:has-text("Submit")');

	// RAISE scored BGGBG: the tree suggests WINDY
	for (const i of [1, 2, 4]) await tileInputs.nth(i).press('g');
	await submitBtn.click();
	await expect(page.locator('.input-tiles')).toHaveText('WINDY');

	// WINDY scored GYBBB: only WAIVE is left
	await tileInputs.nth(0).press('g');
	await tileInputs.nth(1).press('y');
	await submitBtn.click();
	await expect(page.locator('.input-tiles')).toHaveText('WAIVE');
	await expect(page.locator('.error-message')).toContainText('Answer: WAIVE');
	await expect(submitBtn).toBeVisible();

	for (let i = 0; i < 5; i++) await tileInputs.nth(i).press('g');
	await submitBtn.click();
	await expect(page.locator('.error-message')).toHaveText('CONGRATULATIONS');
	await expect(page.locator('.tile-input')).toHaveCount(0);
});

test('Wordle Solver - tiles expose letter, position and colour to assistive tech', async ({
	page
}) => {
	await open(page);

	await expect(page.getByRole('button', { name: /R, position 1: black/ })).toBeVisible();
	await page.getByRole('button', { name: /A, position 2: black/ }).press('y');
	await expect(page.getByRole('button', { name: /A, position 2: yellow/ })).toBeVisible();

	await page.locator('button:has-text("Submit")').click();
	await expect(page.getByRole('img', { name: 'A, position 2: yellow' })).toBeVisible();
});

test('Wordle Solver - restart game button appears on game over', async ({ page }) => {
	await open(page);

	// Trigger game over by winning: two clicks per tile turn every tile green
	const tileInputs = page.locator('.tile-input');
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).click();
		await tileInputs.nth(i).click();
	}

	await page.locator('button:has-text("Submit")').click();
	await expect(page.locator('.error-message')).toHaveText('CONGRATULATIONS');

	const restartBtn = page.locator('button:has-text("Start New Game")');
	await expect(restartBtn).toBeVisible();

	await restartBtn.click();

	await expect(page.locator('button:has-text("Submit")')).toBeVisible();
	await expect(page.locator('.result-tiles')).toHaveCount(0);
});

test('Wordle Solver - unmatched pattern keeps the row editable', async ({ page }) => {
	await open(page);

	// YYYYY is not a key of the root tree
	const tileInputs = page.locator('.tile-input');
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).click();
	}
	await page.locator('button:has-text("Submit")').click();
	await expect(page.locator('.error-message')).toContainText('no words');
	await expect(page.locator('button:has-text("Start New Game")')).toHaveCount(0);

	// Fix the tiles back to black and resubmit
	for (let i = 0; i < 5; i++) {
		await tileInputs.nth(i).press('b');
	}
	await page.locator('button:has-text("Submit")').click();
	await expect(page.locator('.input-tiles')).toHaveText('MULCH');
});

test('Wordle Solver - undo restores the last row for editing', async ({ page }) => {
	await open(page);

	await page.locator('button:has-text("Submit")').click();
	await expect(page.locator('.input-tiles')).toHaveText('MULCH');

	await page.locator('button:has-text("Undo")').click();
	await expect(page.locator('.result-tiles')).toHaveCount(0);
	await expect(page.locator('.input-tiles')).toHaveText('RAISE');
	await expect(page.locator('button:has-text("Undo")')).toHaveCount(0);
});

test('Wordle Solver - untouched all-black row submits as BBBBB', async ({ page }) => {
	await open(page);

	await page.locator('button:has-text("Submit")').click();

	await expect(page.locator('.error-message')).toHaveCount(0);
	const historyTiles = page.locator('.result-tiles .tile');
	await expect(historyTiles).toHaveCount(5);
	for (let i = 0; i < 5; i++) {
		await expect(historyTiles.nth(i)).toHaveClass(/black/);
	}
	await expect(page.locator('.result-tiles')).toHaveText('RAISE');
	await expect(page.locator('.input-tiles')).toHaveText('MULCH');
});
