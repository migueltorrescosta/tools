import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
	await page.goto('/warhammer-simulator');
	// The first visit to a cold dev server compiles the route, so allow longer than the default.
	await expect(page.locator('.container[data-hydrated]')).toBeVisible({ timeout: 20_000 });
}

const runButton = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });
const winnerHeading = (page: Page) => page.getByRole('heading', { name: 'Winner' });

test('Warhammer Simulator - page loads correctly', async ({ page }) => {
	await open(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Warhammer Simulator');
	await expect(page.getByText('100 000 simulations by default')).toBeVisible();
});

test('Warhammer Simulator - preset selection populates form', async ({ page }) => {
	await open(page);

	const builderA = page.getByTestId('builder-A');
	await builderA.getByLabel('Preset').selectOption('Chaos Lord');

	await expect(builderA.getByLabel('Name')).toHaveValue('Chaos Lord');
});

test('Warhammer Simulator - run simulation with default characters', async ({ page }) => {
	await open(page);

	// Reduce simulation count for faster test execution
	await page.getByLabel('Simulations').fill('1000');
	await runButton(page).click();

	await expect(page.getByRole('progressbar', { name: 'Simulation progress' })).toBeVisible({
		timeout: 5000
	});
	await expect(winnerHeading(page)).toBeVisible({ timeout: 30000 });

	// Every chart rendered as an SVG image with a summary
	const results = page.getByTestId('results');
	await expect(results.getByRole('img', { name: 'Winner share' })).toBeVisible();
	await expect(
		results.getByRole('img', { name: 'Share of duels ending in each round' })
	).toBeVisible();
	await expect(results.getByText(/^Most duels end in round \d+ \(\d+\.\d%\)/)).toBeVisible();
	// The finished run is announced politely
	await expect(page.locator('[aria-live="polite"]')).toContainText('Simulation finished.');
});

test('Warhammer Simulator - presets loaded for both characters produce different stats', async ({
	page
}) => {
	await open(page);
	await page.getByLabel('Simulations').fill('1000');

	await page.getByTestId('builder-A').getByLabel('Preset').selectOption('Chaos Lord');
	await page.getByTestId('builder-B').getByLabel('Preset').selectOption('Empire General');

	await runButton(page).click();
	await expect(winnerHeading(page)).toBeVisible({ timeout: 30000 });
	await expect(page.getByTestId('winner-label')).toHaveText([
		'Chaos Lord',
		'Mutual kill / draw',
		'Empire General'
	]);
});

test('Warhammer Simulator - simulation count input accepts values', async ({ page }) => {
	await open(page);

	const simCountInput = page.getByLabel('Simulations');
	await simCountInput.fill('500');
	await expect(simCountInput).toHaveValue('500');
	// Character A's WS is untouched (the old test wrote 500 into it).
	await expect(page.getByTestId('builder-A').getByLabel('WS')).toHaveValue('4');
});

test('Warhammer Simulator - out-of-range simulation count shows an error', async ({ page }) => {
	await open(page);

	await page.getByLabel('Simulations').fill('0');
	await runButton(page).click();
	await expect(page.getByRole('alert')).toContainText('Simulations must be a whole number');
	await expect(winnerHeading(page)).toHaveCount(0);
});

test('Warhammer Simulator - validation prevents >50 gift points', async ({ page }) => {
	await open(page);

	const panelA = page.getByTestId('builder-A');
	const standard = panelA.getByRole('button', { name: /Blasted Standard/ });
	await standard.click();
	await expect(standard).toHaveAttribute('aria-pressed', 'true');
	await panelA.getByRole('button', { name: /Immortal Fury/ }).click();
	await expect(panelA.getByText(/^Exceeds 50 pts/)).toContainText('65 pts');

	await runButton(page).click();
	await expect(page.getByRole('alert')).toHaveText(
		/^\W*Character A exceeds 50 gift points \(65\)$/
	);
	await expect(winnerHeading(page)).toHaveCount(0);
});

test('Warhammer Simulator - item limit disables a third item', async ({ page }) => {
	await open(page);

	const panelA = page.getByTestId('builder-A');
	await panelA.getByRole('button', { name: /Strength Potion/ }).click();
	await panelA.getByRole('button', { name: /Toughness Potion/ }).click();
	await expect(panelA.getByRole('button', { name: /Potion of Speed/ })).toBeDisabled();
	await expect(panelA.getByText('Item limit reached')).toBeVisible();
	// Gifts stay available.
	await expect(panelA.getByRole('button', { name: /Killing Blow/ })).toBeEnabled();
});

test('Warhammer Simulator - charge control has no Initiative bonus', async ({ page }) => {
	await open(page);

	await expect(page.getByLabel('Charger')).toBeVisible();
	await expect(page.getByLabel(/charge bonus/i)).toHaveCount(0);
	await expect(page.getByText('Charge persists')).toHaveCount(0);
});

test('Warhammer Simulator - default 100k run renders every chart without page errors', async ({
	page
}) => {
	const pageErrors: Error[] = [];
	page.on('pageerror', (err) => pageErrors.push(err));

	await open(page);
	await expect(page.getByLabel('Simulations')).toHaveValue('100000');

	await page.getByLabel('Seed (optional)').fill('12345');
	await page.getByLabel('Charger').selectOption('A');
	await runButton(page).click();

	await expect(winnerHeading(page)).toBeVisible({ timeout: 120_000 });
	const charts = page.getByTestId('results').getByRole('img');
	await expect(charts).toHaveCount(3);
	for (let i = 0; i < 3; i++) await expect(charts.nth(i)).toBeVisible();
	// Each chart keeps its numbers in a closed "Show data" table
	const showData = page.getByTestId('results').getByText('Show data');
	await expect(showData).toHaveCount(3);
	await showData.nth(1).click();
	await expect(
		page.getByRole('table', { name: 'Share of duels ending in each round' })
	).toBeVisible();

	const winRates = page.getByTestId('winner-value');
	await expect(winRates).toHaveCount(3);
	for (let i = 0; i < 3; i++) await expect(winRates.nth(i)).toHaveText(/^\d{1,3}\.\d%$/);
	await expect(page.getByTestId('seed-used')).toHaveText('12345');
	await expect(page.getByTestId('stale-warning')).toHaveCount(0);

	// Editing a character flags the old results as stale and keeps the run's labels.
	await page.getByTestId('builder-A').getByLabel('Name').fill('Renamed');
	await expect(page.getByTestId('stale-warning')).toBeVisible();
	await expect(page.getByTestId('winner-label').first()).toHaveText('Character A');

	expect(pageErrors).toEqual([]);
});
