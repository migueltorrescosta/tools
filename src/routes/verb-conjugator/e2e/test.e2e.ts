import { expect, test, type Page } from '@playwright/test';

const PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
const ESSERE_PRESENTE = ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'];

/** Restrict Italian to essere/indicativo presente so the blank card's answer is known. */
async function seedSingleCardSet(page: Page) {
	await page.goto('/verb-conjugator');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => {
		localStorage.clear();
		localStorage.setItem('italian-verbs-selected', JSON.stringify(['essere']));
		localStorage.setItem('italian-verbs-tenses', JSON.stringify(['indicativo presente']));
	});
	await page.reload();
	await page.waitForLoadState('networkidle');
}

async function answerCurrentCardCorrectly(page: Page) {
	const lines = page.locator('.card-lines .line-content');
	await expect(lines).toHaveCount(6);
	const blankIndex = await lines.evaluateAll((els) =>
		els.findIndex((el) => el.classList.contains('is-blank'))
	);
	expect(blankIndex).toBeGreaterThanOrEqual(0);
	await page.locator('.verb-input').fill(`${PERSONS[blankIndex]} ${ESSERE_PRESENTE[blankIndex]}`);
	await page.locator('.verb-input').press('Enter');
}

test('Verb conjugator - correct answer is recorded and survives reload', async ({ page }) => {
	await seedSingleCardSet(page);
	await expect(page.locator('.stats-row')).toContainText('Copertura: 0 / 6');

	await answerCurrentCardCorrectly(page);
	await expect(page.locator('.history-table tr')).toHaveCount(1);
	await expect(page.locator('.stats-row')).toContainText('Copertura: 1 / 6');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.history-table tr')).toHaveCount(1);
	await expect(page.locator('.stats-row')).toContainText('Copertura: 1 / 6');
});

test('Verb conjugator - switching language keeps the Italian session', async ({ page }) => {
	await seedSingleCardSet(page);
	await answerCurrentCardCorrectly(page);
	await expect(page.locator('.stats-row')).toContainText('Copertura: 1 / 6');

	await page.getByRole('button', { name: /Español/ }).click();
	await expect(page.locator('.stats-row')).toContainText('Cobertura: 0 /');
	await expect(page.getByText('No attempts yet.')).toBeVisible();

	await page.getByRole('button', { name: /Italiano/ }).click();
	await expect(page.locator('.stats-row')).toContainText('Copertura: 1 / 6');
	await expect(page.locator('.history-table tr')).toHaveCount(1);
});

test('Verb conjugator - selected language survives reload', async ({ page }) => {
	await seedSingleCardSet(page);
	await page.getByRole('button', { name: /Português/ }).click();
	await expect(page.locator('.stats-row')).toContainText('Cobertura');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('button', { name: /Português/ })).toHaveClass(/active/);
});

test('Verb conjugator - answer input and submit button have accessible names', async ({ page }) => {
	await seedSingleCardSet(page);
	await expect(page.getByRole('textbox', { name: /^Answer: .+ form$/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
});

test('Verb conjugator - imperative never asks for io and shows a dash', async ({ page }) => {
	await page.goto('/verb-conjugator');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => {
		localStorage.clear();
		localStorage.setItem('italian-verbs-selected', JSON.stringify(['parlare']));
		localStorage.setItem('italian-verbs-tenses', JSON.stringify(['imperativo']));
	});
	await page.reload();
	await page.waitForLoadState('networkidle');

	await expect(page.locator('.stats-row')).toContainText('Copertura: 0 / 5');
	const ioLine = page.locator('.card-lines .line-content').first();
	await expect(ioLine).not.toHaveClass(/is-blank/);
	await expect(ioLine).toContainText('—');
});
