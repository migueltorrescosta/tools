import { expect, test, type Page } from '@playwright/test';

// Explanation tips are covered by src/lib/decision-tree/DecisionTree.svelte.spec.ts
// on a fixture tree, since tree.json has no explanations.

/** Load `url` and wait until the page has hydrated, so clicks are not lost. */
async function open(page: Page, url = '/decision-tree') {
	await page.goto(url);
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

/** Click the answer labelled `label` in the answer row at `depth` (0 = root question). */
async function answer(page: Page, depth: number, label: string) {
	await page
		.locator('.answer-row')
		.nth(depth)
		.getByRole('button', { name: label, exact: true })
		.click();
}

function questions(page: Page) {
	return page.locator('.question-prompt');
}

function result(page: Page) {
	return page.locator('.result-text');
}

test.describe('Decision Tree E2E', () => {
	test.beforeEach(async ({ page }) => {
		await open(page);
		await expect(page.locator('h1')).toHaveText('DECISION TREE');
		await expect(questions(page).first()).toHaveText('What do you want to do today?');
	});

	test('valid traversal renders alternating rows and reaches a result', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await expect(questions(page)).toHaveCount(2);
		await expect(questions(page).nth(1)).toHaveText('What matters most?');

		await answer(page, 1, 'Environmental impact');
		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).nth(2)).toHaveText('Can you charge at home?');

		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');
		await expect(page.locator('.answer-row')).toHaveCount(3);
	});

	test('changing a previous answer removes downstream rows', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Environmental impact');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');

		await answer(page, 2, 'No');
		await expect(result(page)).toHaveText('Hybrid or Plug-in Hybrid');

		await answer(page, 1, 'Family practicality');
		await expect(result(page)).toHaveCount(0);
		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
	});

	test('state persists after page refresh', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Family practicality');
		await expect(questions(page).last()).toHaveText('Need 3 rows?');

		await page.reload();
		await expect(page.locator('.container[data-hydrated]')).toBeVisible();

		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).nth(1)).toHaveText('What matters most?');
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
	});

	test('state restores from localStorage when visiting without ?p', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Family practicality');
		await expect(page).toHaveURL(/\?p=/);

		await open(page);

		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
		await expect(page).toHaveURL(/\?p=/);
	});

	test('shareable URL restores traversal state in a fresh context', async ({ page, browser }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Lowest total cost');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Hybrid');
		// Answer positions per step: readable, and immune to commas in labels
		await expect(page).toHaveURL(/\?p=\d+(\.\d+){2}$/);

		// A new context has empty localStorage, so only ?p can restore the path
		const context = await browser.newContext();
		const shared = await context.newPage();
		await open(shared, page.url());
		await expect(shared.locator('.result-text')).toHaveText('Hybrid');
		await context.close();
	});

	test('only one answer selected per question', async ({ page }) => {
		const rootRow = page.locator('.answer-row').first();
		await answer(page, 0, 'Choose a car');
		await expect(rootRow.locator('.answer-btn.selected')).toHaveCount(1);
		await expect(rootRow.locator('.answer-btn.selected')).toHaveText('Choose a car');

		await answer(page, 0, 'Religion');
		await expect(rootRow.locator('.answer-btn.selected')).toHaveCount(1);
		await expect(rootRow.locator('.answer-btn.selected')).toHaveText('Religion');
	});

	test('interface works on mobile viewport with answer wrapping', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await answer(page, 0, 'Choose a car');

		const carAnswers = page.locator('.answer-row').nth(1).locator('.answer-btn');
		await expect(carAnswers).toHaveCount(6);
		for (const button of await carAnswers.all()) {
			await expect(button).toBeInViewport();
		}
	});

	test('long trees preserve all rows without collapsing', async ({ page }) => {
		await answer(page, 0, 'Religion');
		await answer(page, 1, 'Bible');
		await answer(page, 2, 'Yes');
		await answer(page, 3, 'Pope of Rome');

		await expect(result(page)).toHaveText('Roman Catholic');
		await expect(questions(page)).toHaveText([
			'What do you want to do today?',
			'Which book contains the final word of God?',
			'Is Jesus God?',
			"Who leads Christ's church?"
		]);
	});

	test('switching trees at root replaces all downstream', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Fun / Performance');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Lightweight Sports Car');

		await answer(page, 0, 'Religion');
		await expect(questions(page)).toHaveText([
			'What do you want to do today?',
			'Which book contains the final word of God?'
		]);
		await expect(result(page)).toHaveCount(0);
	});

	test('Start over returns to the root question and clears ?p', async ({ page }) => {
		await answer(page, 0, 'Choose a car');
		await answer(page, 1, 'Lowest total cost');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Hybrid');
		await expect(page).toHaveURL(/\?p=/);

		await page.getByRole('button', { name: 'Start over' }).click();

		await expect(questions(page)).toHaveText(['What do you want to do today?']);
		await expect(result(page)).toHaveCount(0);
		await expect(page.locator('.answer-btn[aria-pressed="true"]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Choose a car', exact: true })).toBeFocused();
		await expect(page).not.toHaveURL(/\?p=/);
		await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);

		// The cleared path is what persists
		await page.reload();
		await expect(page.locator('.container[data-hydrated]')).toBeVisible();
		await expect(questions(page)).toHaveCount(1);
	});
});
