import { expect, test, type Page } from '@playwright/test';

const PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
const ESSERE_PRESENTE = ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'];

/** Load the page and wait until it has hydrated, so clicks are not lost. */
async function load(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

/** Restrict Italian to essere/indicativo presente so the blank card's answer is known. */
async function seedSingleCardSet(page: Page) {
	await page.goto('/verb-conjugator');
	await load(page);
	await page.evaluate(() => {
		localStorage.clear();
		localStorage.setItem('italian-verbs-selected', JSON.stringify(['essere']));
		localStorage.setItem('italian-verbs-tenses', JSON.stringify(['indicativo presente']));
	});
	await page.reload();
	await load(page);
}

const stats = (page: Page) => page.getByTestId('stats');
const historyRows = (page: Page) => page.getByTestId('history').getByRole('row');
const settings = (page: Page) => page.getByTestId('practice-settings');
const answerBox = (page: Page) =>
	page.getByRole('textbox', { name: /^(Risposta|Respuesta|Resposta): .+$/ });

async function blankIndex(page: Page) {
	const rows = page.getByTestId('card-row');
	await expect(rows).toHaveCount(6);
	const index = await rows.evaluateAll((els) =>
		els.findIndex((el) => el.getAttribute('data-state') === 'current')
	);
	expect(index).toBeGreaterThanOrEqual(0);
	return index;
}

async function answerCurrentCardCorrectly(page: Page) {
	const i = await blankIndex(page);
	await answerBox(page).fill(`${PERSONS[i]} ${ESSERE_PRESENTE[i]}`);
	await answerBox(page).press('Enter');
}

test('Verb conjugator - correct answer is recorded and survives reload', async ({ page }) => {
	await seedSingleCardSet(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verb Conjugator');
	// Before any answer the toolbar shows only the language switch
	await expect(stats(page)).toHaveCount(0);
	// The card names what is being practised
	await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
		'essere · indicativo presente'
	);
	await expect(page.getByText('Scrivi la forma mancante')).toBeVisible();
	expect(await answerBox(page).getAttribute('placeholder')).toBeNull();

	await answerCurrentCardCorrectly(page);
	await expect(historyRows(page)).toHaveCount(1);
	await expect(stats(page)).toContainText('Copertura: 1 / 6');
	await expect(page.getByRole('status')).toContainText('Giusto');

	await page.reload();
	await load(page);
	await expect(historyRows(page)).toHaveCount(1);
	await expect(stats(page)).toContainText('Copertura: 1 / 6');
});

test('Verb conjugator - wrong answer is announced and marked in the diff', async ({ page }) => {
	await seedSingleCardSet(page);
	const i = await blankIndex(page);
	await answerBox(page).fill(`${PERSONS[i]} xyz`);
	await answerBox(page).press('Enter');

	await expect(page.getByRole('status')).toContainText(
		`Non proprio: ${PERSONS[i]} ${ESSERE_PRESENTE[i]}`
	);
	const row = historyRows(page).first();
	await expect(row).toHaveAttribute('data-state', 'wrong');
	await expect(row.locator('del')).toHaveText(['xyz']);
	await expect(row.locator('ins')).toHaveText([ESSERE_PRESENTE[i]]);
	await expect(stats(page)).toContainText('Copertura: 0 / 6');
});

test('Verb conjugator - switching language keeps the Italian session', async ({ page }) => {
	await seedSingleCardSet(page);
	await answerCurrentCardCorrectly(page);
	await expect(stats(page)).toContainText('Copertura: 1 / 6');

	await page.getByRole('radio', { name: 'Español' }).check();
	// No Spanish answers yet, so no stats line
	await expect(stats(page)).toHaveCount(0);
	await expect(page.getByText('Aún no hay intentos.')).toBeVisible();
	// All interface text follows the practised language
	await expect(page.getByRole('button', { name: 'Comprobar' })).toBeVisible();
	await expect(settings(page)).toContainText('Practicas');
	await expect(page.locator('.vc-grid')).toHaveAttribute('lang', 'es');

	await page.getByRole('radio', { name: 'Italiano' }).check();
	await expect(stats(page)).toContainText('Copertura: 1 / 6');
	await expect(historyRows(page)).toHaveCount(1);
});

test('Verb conjugator - selected language survives reload', async ({ page }) => {
	await seedSingleCardSet(page);
	await page.getByRole('radio', { name: 'Português' }).check();
	await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();

	await page.reload();
	await load(page);
	await expect(page.getByRole('radio', { name: 'Português' })).toBeChecked();
	await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
});

test('Verb conjugator - verb and tense chips expose pressed state', async ({ page }) => {
	await seedSingleCardSet(page);
	// The chips sit behind one closed summary line
	await expect(settings(page)).toContainText('Stai esercitando 1 verbo · 1 tempo');
	const verbs = page.getByRole('group', { name: 'Verbi' });
	await expect(verbs).toBeHidden();
	await page.getByText('Cambia', { exact: true }).click();
	await expect(verbs).toBeVisible();
	const essere = verbs.getByRole('button', { name: 'essere', exact: true });
	await expect(essere).toHaveAttribute('aria-pressed', 'true');
	// The last selected verb cannot be turned off
	await expect(essere).toBeDisabled();

	const avere = verbs.getByRole('button', { name: 'avere', exact: true });
	await expect(avere).toHaveAttribute('aria-pressed', 'false');
	await avere.click();
	await expect(avere).toHaveAttribute('aria-pressed', 'true');
	await expect(essere).toBeEnabled();
	await expect(settings(page)).toContainText('2 verbi · 1 tempo');

	const tenses = page.getByRole('group', { name: 'Tempi' });
	await expect(
		tenses.getByRole('button', { name: 'indicativo presente', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
});

test('Verb conjugator - answer input and submit button have accessible names', async ({ page }) => {
	await seedSingleCardSet(page);
	await expect(answerBox(page)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Controlla' })).toBeVisible();
});

test('Verb conjugator - imperative never asks for io and shows a dash', async ({ page }) => {
	await page.goto('/verb-conjugator');
	await load(page);
	await page.evaluate(() => {
		localStorage.clear();
		localStorage.setItem('italian-verbs-selected', JSON.stringify(['parlare']));
		localStorage.setItem('italian-verbs-tenses', JSON.stringify(['imperativo']));
	});
	await page.reload();
	await load(page);

	const ioRow = page.getByTestId('card-row').first();
	await expect(ioRow).not.toHaveAttribute('data-state', 'current');
	await expect(ioRow).toContainText('—');

	// Coverage counts the five forms that exist
	const i = await blankIndex(page);
	await answerBox(page).fill(`${PERSONS[i]} xyz`);
	await answerBox(page).press('Enter');
	await expect(stats(page)).toContainText('Copertura: 0 / 5');
});

test('Verb conjugator - card stays readable at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await seedSingleCardSet(page);
	const card = page.locator('.vc-card');
	// Each row stacks the translation above the answer instead of one letter per line
	const height = await card.evaluate((el) => el.getBoundingClientRect().height);
	expect(height).toBeLessThan(400);
	const translation = page.locator('.vc-card .vc-translation').first();
	const width = await translation.evaluate((el) => el.getBoundingClientRect().width);
	expect(width).toBeGreaterThan(150);
});
