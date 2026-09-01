import { expect, test } from '@playwright/test';

test.describe('Decision Tree E2E', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/decision-tree');
		await page.waitForLoadState('networkidle');
	});

	// 1. Valid traversal path renders alternating rows until result
	test('valid traversal renders alternating rows and reaches a result', async ({ page }) => {
		await expect(page.locator('h1')).toHaveText('DECISION TREE');

		// First question should be visible
		await expect(page.locator('.question-prompt').first()).toHaveText(
			'What do you want to do today?'
		);

		// Click "Choose a car"
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(100);

		// Should now see two question rows
		const questions = page.locator('.question-prompt');
		await expect(questions).toHaveCount(2);
		await expect(questions.nth(1)).toHaveText('What matters most?');

		// Click "Environmental impact"
		await page.locator('.answer-btn').filter({ hasText: 'Environmental impact' }).click();
		await page.waitForTimeout(100);

		// Should see three question rows now
		await expect(page.locator('.question-prompt')).toHaveCount(3);

		// Click "Yes" for "Can you charge at home?"
		await page.locator('.answer-btn').filter({ hasText: 'Yes' }).last().click();
		await page.waitForTimeout(100);

		// Should see the result
		const result = page.locator('.result-text');
		await expect(result).toBeVisible();
		await expect(result).toHaveText('Battery EV');
	});

	// 2. Changing answer removes downstream rows
	test('changing a previous answer removes downstream rows', async ({ page }) => {
		// Navigate deep into car tree: root → Choose a car → Environmental impact → Yes → Battery EV
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Environmental impact' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Yes' }).last().click();
		await page.waitForTimeout(50);

		// Should have result
		await expect(page.locator('.result-text')).toBeVisible();

		// Go back and change "Can you charge at home?" from "Yes" to "No"
		// The answer rows are: [root answers, car options, charge-at-home answers]
		// So nth(2) = the 3rd answer row = "Can you charge at home?"
		await page.locator('.answer-row').nth(2).locator('.answer-btn').filter({ hasText: 'No' }).click();
		await page.waitForTimeout(100);

		// Result should now be different (Hybrid or Plug-in Hybrid instead of Battery EV)
		const result = page.locator('.result-text');
		await expect(result).toBeVisible();
		await expect(result).toHaveText('Hybrid or Plug-in Hybrid');
	});

	// 3. State persists after refresh
	test('state persists after page refresh', async ({ page }) => {
		// Navigate partway through: root → Choose a car → Family practicality
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Family practicality' }).click();
		await page.waitForTimeout(50);

		// We should see 3 questions: root, "What matters most?", "Need 3 rows?"
		// The last question is always visible even without a selected answer
		await expect(page.locator('.question-prompt').last()).toHaveText('Need 3 rows?');

		// Reload
		await page.reload();
		await page.waitForLoadState('networkidle');

		// State should be restored — same 3 questions
		await expect(page.locator('.question-prompt').first()).toHaveText(
			'What do you want to do today?'
		);
		const questions = page.locator('.question-prompt');
		await expect(questions).toHaveCount(3);
		await expect(questions.nth(1)).toHaveText('What matters most?');
		await expect(questions.last()).toHaveText('Need 3 rows?');
	});

	// 4. Shareable URL restores state
	test('shareable URL restores traversal state', async ({ page }) => {
		// Navigate to a result
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Lowest total cost' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Yes' }).first().click();
		await page.waitForTimeout(50);

		// Get the current URL
		const shareUrl = page.url();
		expect(shareUrl).toContain('?p=');

		// Open in new page
		const newPage = await page.context().newPage();
		await newPage.goto(shareUrl);
		await newPage.waitForLoadState('networkidle');

		// Verify state is restored
		await expect(newPage.locator('.result-text')).toBeVisible();
		await expect(newPage.locator('.result-text')).toHaveText('Hybrid');
		await newPage.close();
	});

	// 5. Only one answer may be selected per question
	test('only one answer selected per question', async ({ page }) => {
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);

		// The selected button should have the 'selected' class
		const firstAnswerRow = page.locator('.answer-row').first();
		await expect(firstAnswerRow.locator('.answer-btn.selected')).toHaveCount(1);
		await expect(firstAnswerRow.locator('.answer-btn.selected')).toHaveText('Choose a car');

		// Click a different answer in the same row
		await page.locator('.answer-btn').filter({ hasText: 'Religion' }).click();
		await page.waitForTimeout(50);

		// Now only the new answer should be selected
		await expect(firstAnswerRow.locator('.answer-btn.selected')).toHaveCount(1);
		await expect(firstAnswerRow.locator('.answer-btn.selected')).toHaveText('Religion');
	});

	// 6. Interface usable on narrow mobile layouts
	test('interface works on mobile viewport with answer wrapping', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Verify page renders
		await expect(page.locator('.question-prompt').first()).toBeVisible();

		// Click answer
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);

		// After clicking "Choose a car", the second answer row has the 6 car options
		// First answer row = root answers (2 buttons), second = car answers (6 buttons)
		const carAnswerRow = page.locator('.answer-row').nth(1);
		const buttons = carAnswerRow.locator('.answer-btn');
		await expect(buttons.first()).toBeVisible();

		// All 6 answers for "What matters most?" should be visible
		await expect(buttons).toHaveCount(6);
	});

	// 7. Long trees preserve all rows
	test('long trees preserve all rows without collapsing', async ({ page }) => {
		// Traverse deep into the religion tree
		await page.locator('.answer-btn').filter({ hasText: 'Religion' }).click();
		await page.waitForTimeout(50);

		async function clickAnswer(label: string) {
			await page.locator('.answer-btn').filter({ hasText: label }).last().click();
			await page.waitForTimeout(50);
		}

		// r_q1: Bible (final word of God)
		await clickAnswer('Bible');
		// r_q4: Yes (Jesus is God)
		await clickAnswer('Yes');
		// r_q5: Pope of Rome (who leads church)
		await page.locator('.answer-btn').filter({ hasText: 'Pope of Rome' }).click();
		await page.waitForTimeout(50);

		// Should see the result
		await expect(page.locator('.result-text')).toBeVisible();
		await expect(page.locator('.result-text')).toHaveText('Roman Catholic');

		// All previous rows should still be visible
		const allQuestions = page.locator('.question-prompt');
		const questionCount = await allQuestions.count();
		expect(questionCount).toBeGreaterThanOrEqual(4);

		// First question should still be visible
		await expect(allQuestions.first()).toHaveText('What do you want to do today?');
	});

	// 8. Switching trees at root resets everything
	test('switching trees at root replaces all downstream', async ({ page }) => {
		// Start with car tree
		await page.locator('.answer-btn').filter({ hasText: 'Choose a car' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Fun / Performance' }).click();
		await page.waitForTimeout(50);
		await page.locator('.answer-btn').filter({ hasText: 'Yes' }).first().click();
		await page.waitForTimeout(50);

		// Verify we got a result
		await expect(page.locator('.result-text')).toBeVisible();

		// Now switch to religion tree at the root
		const rootAnswerRow = page.locator('.answer-row').first();
		await rootAnswerRow.locator('.answer-btn').filter({ hasText: 'Religion' }).click();
		await page.waitForTimeout(100);

		// Car-specific questions should be gone, religion questions should show
		const questions = page.locator('.question-prompt');
		await expect(questions.first()).toHaveText('What do you want to do today?');
		await expect(questions.last()).toHaveText(
			'Which book contains the final word of God?'
		);

		// No result should be visible (still navigating)
		await expect(page.locator('.result-text')).toHaveCount(0);
	});

	// 9. Explanation is hidden unless requested
	test('explanations are hidden by default', async ({ page }) => {
		// Our sample trees currently have no explanations, so verify
		// the explanation elements are not visible
		const explanations = page.locator('.explanation-tip');
		await expect(explanations).toHaveCount(0);
	});
});
