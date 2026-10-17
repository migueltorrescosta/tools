import { expect, test, type Page } from '@playwright/test';

/** Load the solver and wait until it has hydrated, so clicks are not lost. */
async function open(page: Page) {
	await page.goto('/wordle');
	await expect(page.locator('.wordle-panel[data-hydrated]')).toBeVisible();
}

/** The editable row of five tiles for the next guess. */
function inputRow(page: Page) {
	return page.getByRole('group', { name: 'Next guess' });
}

function tileInputs(page: Page) {
	return inputRow(page).getByRole('button');
}

function resultRows(page: Page) {
	return page.getByTestId('result-row');
}

function message(page: Page) {
	return page.getByTestId('message');
}

function submit(page: Page) {
	return page.getByRole('button', { name: 'Submit', exact: true });
}

test('Wordle Solver - page loads correctly', async ({ page }) => {
	await open(page);

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wordle Solver');
	await expect(page).toHaveTitle('Wordle Solver');
	await expect(inputRow(page)).toBeVisible();

	// The legend names each colour in text
	const legend = page.getByRole('list', { name: 'Legend' });
	await expect(legend).toBeVisible();
	await expect(legend.getByRole('listitem')).toHaveText([
		/Black: not in the word/,
		/Yellow: wrong position/,
		/Green: right position/
	]);
});

test('Wordle Solver - keyboard input functionality', async ({ page }) => {
	await open(page);

	const tiles = tileInputs(page);
	await expect(tiles).toHaveCount(5);

	// Clicking the first tile cycles black → yellow → green → black
	await tiles.first().click();
	await expect(tiles.first()).toHaveAccessibleName(/: yellow$/);
	await expect(tiles.first()).toHaveAttribute('data-state', 'present');

	await tiles.first().click();
	await expect(tiles.first()).toHaveAccessibleName(/: green$/);
	await expect(tiles.first()).toHaveAttribute('data-state', 'correct');

	await tiles.first().click();
	await expect(tiles.first()).toHaveAccessibleName(/: black$/);
	await expect(tiles.first()).toHaveAttribute('data-state', 'absent');
});

test('Wordle Solver - pattern absent from the tree shows the no-match error', async ({ page }) => {
	await open(page);

	await expect(submit(page)).toBeVisible();

	// One click per tile turns every tile yellow: YYYYY is not a key of the root tree
	const tiles = tileInputs(page);
	for (let i = 0; i < 5; i++) {
		await tiles.nth(i).click();
	}
	await submit(page).click();

	await expect(page.getByRole('status')).toContainText('no words');
	await expect(message(page)).toContainText('no words');
});

test('Wordle Solver - happy path suggests the next word and records history up to a win', async ({
	page
}) => {
	await open(page);
	const tiles = tileInputs(page);

	// RAISE scored BBBBB: the tree suggests MULCH
	await submit(page).click();
	await expect(inputRow(page)).toHaveText('MULCH');
	await expect(resultRows(page)).toHaveCount(1);

	// MULCH scored BYYBB: the tree suggests FLUNK
	await tiles.nth(1).press('y');
	await tiles.nth(2).press('y');
	await submit(page).click();
	await expect(inputRow(page)).toHaveText('FLUNK');
	const rows = resultRows(page);
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveText('RAISE');
	await expect(rows.nth(1)).toHaveText('MULCH');
	await expect(rows.nth(1).getByRole('img', { name: 'U, position 2: yellow' })).toHaveAttribute(
		'data-state',
		'present'
	);
	await expect(rows.nth(1).getByRole('img', { name: 'L, position 3: yellow' })).toHaveAttribute(
		'data-state',
		'present'
	);

	// FLUNK scored GGGGG: the game is won
	for (let i = 0; i < 5; i++) {
		await tiles.nth(i).press('g');
	}
	await submit(page).click();
	await expect(message(page)).toHaveText('CONGRATULATIONS');
	await expect(page.getByRole('button', { name: 'Start New Game' })).toBeVisible();
	// The input row is gone once the game is won: no placeholder glyphs, nothing to click.
	await expect(inputRow(page)).toHaveCount(0);
});

test('Wordle Solver - reaching a leaf names the answer and GGGGG confirms it', async ({ page }) => {
	await open(page);
	const tiles = tileInputs(page);

	// RAISE scored BGGBG: the tree suggests WINDY
	for (const i of [1, 2, 4]) await tiles.nth(i).press('g');
	await submit(page).click();
	await expect(inputRow(page)).toHaveText('WINDY');

	// WINDY scored GYBBB: only WAIVE is left
	await tiles.nth(0).press('g');
	await tiles.nth(1).press('y');
	await submit(page).click();
	await expect(inputRow(page)).toHaveText('WAIVE');
	await expect(message(page)).toContainText('Answer: WAIVE');
	await expect(submit(page)).toBeVisible();

	for (let i = 0; i < 5; i++) await tiles.nth(i).press('g');
	await submit(page).click();
	await expect(message(page)).toHaveText('CONGRATULATIONS');
	await expect(tileInputs(page)).toHaveCount(0);
});

test('Wordle Solver - tiles expose letter, position and colour to assistive tech', async ({
	page
}) => {
	await open(page);

	await expect(page.getByRole('button', { name: /R, position 1: black/ })).toBeVisible();
	await page.getByRole('button', { name: /A, position 2: black/ }).press('y');
	await expect(page.getByRole('button', { name: /A, position 2: yellow/ })).toBeVisible();

	await submit(page).click();
	await expect(page.getByRole('img', { name: 'A, position 2: yellow' })).toBeVisible();
});

test('Wordle Solver - restart game button appears on game over', async ({ page }) => {
	await open(page);

	// Trigger game over by winning: two clicks per tile turn every tile green
	const tiles = tileInputs(page);
	for (let i = 0; i < 5; i++) {
		await tiles.nth(i).click();
		await tiles.nth(i).click();
	}

	await submit(page).click();
	await expect(message(page)).toHaveText('CONGRATULATIONS');

	const restartBtn = page.getByRole('button', { name: 'Start New Game' });
	await expect(restartBtn).toBeVisible();

	await restartBtn.click();

	await expect(submit(page)).toBeVisible();
	await expect(resultRows(page)).toHaveCount(0);
});

test('Wordle Solver - unmatched pattern keeps the row editable', async ({ page }) => {
	await open(page);

	// YYYYY is not a key of the root tree
	const tiles = tileInputs(page);
	for (let i = 0; i < 5; i++) {
		await tiles.nth(i).click();
	}
	await submit(page).click();
	await expect(message(page)).toContainText('no words');
	await expect(page.getByRole('button', { name: 'Start New Game' })).toHaveCount(0);

	// Fix the tiles back to black and resubmit
	for (let i = 0; i < 5; i++) {
		await tiles.nth(i).press('b');
	}
	await submit(page).click();
	await expect(inputRow(page)).toHaveText('MULCH');
});

test('Wordle Solver - undo restores the last row for editing', async ({ page }) => {
	await open(page);

	await submit(page).click();
	await expect(inputRow(page)).toHaveText('MULCH');

	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(resultRows(page)).toHaveCount(0);
	await expect(inputRow(page)).toHaveText('RAISE');
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('Wordle Solver - untouched all-black row submits as BBBBB', async ({ page }) => {
	await open(page);

	await submit(page).click();

	await expect(message(page)).toHaveCount(0);
	const historyTiles = resultRows(page).getByRole('img');
	await expect(historyTiles).toHaveCount(5);
	for (let i = 0; i < 5; i++) {
		await expect(historyTiles.nth(i)).toHaveAccessibleName(/: black$/);
		await expect(historyTiles.nth(i)).toHaveAttribute('data-state', 'absent');
	}
	await expect(resultRows(page)).toHaveText('RAISE');
	await expect(inputRow(page)).toHaveText('MULCH');
});
