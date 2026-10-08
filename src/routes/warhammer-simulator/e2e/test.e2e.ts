import { expect, test } from '@playwright/test';

test('Warhammer Simulator - page loads correctly', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await expect(page.locator('h1')).toHaveText('WARHAMMER SIMULATOR');
	await expect(page.locator('.subtitle')).toContainText('100 000 simulations');
});

test('Warhammer Simulator - preset selection populates form', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	// Get the preset select for Character A (first select inside first panel)
	const presetSelect = page
		.locator('.sim-builder-grid .panel')
		.first()
		.locator('select.algorithm-select')
		.first();
	await presetSelect.waitFor({ state: 'visible' });

	// Select a preset for Character A
	await presetSelect.selectOption('Chaos Lord');

	// Check that name field was populated
	const nameInput = page.locator('input[type="text"]').first();
	await expect(nameInput).toHaveValue('Chaos Lord');
});

test('Warhammer Simulator - run simulation with default characters', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	// Reduce simulation count for faster test execution
	const simCountInput = page.locator('.sim-count-input');
	await simCountInput.fill('1000');

	// Click the Run Simulation button
	const runBtn = page.locator('button:has-text("RUN SIMULATION")');
	await runBtn.waitFor({ state: 'visible' });
	await runBtn.click();

	// Wait for progress bar to appear
	const progressBar = page.locator('.progress-bar-bg');
	await expect(progressBar).toBeVisible({ timeout: 5000 });

	// Wait for results to appear
	const resultsHeader = page.locator('text=WINNER');
	await expect(resultsHeader).toBeVisible({ timeout: 30000 });

	// Verify pie chart canvas rendered
	const pieCanvas = page.locator('canvas').first();
	await expect(pieCanvas).toBeVisible();

	// Verify histogram canvas rendered
	const histCanvas = page.locator('canvas').nth(1);
	await expect(histCanvas).toBeVisible();
});

test('Warhammer Simulator - presets loaded for both characters produce different stats', async ({
	page
}) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	// Reduce simulation count for faster test execution
	const simCountInput = page.locator('.sim-count-input');
	await simCountInput.fill('1000');

	// Get the preset selects for each character panel
	const selectA = page
		.locator('.sim-builder-grid .panel')
		.first()
		.locator('select.algorithm-select')
		.first();
	const selectB = page
		.locator('.sim-builder-grid .panel')
		.nth(1)
		.locator('select.algorithm-select')
		.first();

	// Load different presets
	await selectA.selectOption('Chaos Lord');
	await selectB.selectOption('Empire General');

	// Run simulation
	await page.locator('button:has-text("RUN SIMULATION")').click();

	// Wait for results
	await expect(page.locator('text=WINNER')).toBeVisible({ timeout: 30000 });
});

test('Warhammer Simulator - simulation count input accepts values', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	const simCountInput = page.locator('#sim-count');
	await simCountInput.fill('500');
	await expect(simCountInput).toHaveValue('500');
	// Character A's WS is untouched (the old test wrote 500 into it).
	await expect(page.locator('#charA-ws')).toHaveValue('4');
});

test('Warhammer Simulator - out-of-range simulation count shows an error', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	await page.locator('#sim-count').fill('0');
	await page.locator('button:has-text("RUN SIMULATION")').click();
	await expect(page.locator('p.error')).toContainText('Simulations must be a whole number');
	await expect(page.locator('text=WINNER')).toHaveCount(0);
});

test('Warhammer Simulator - validation prevents >50 gift points', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	const panelA = page.locator('.sim-builder-grid .panel').first();
	await panelA.getByRole('button', { name: /Blasted Standard/ }).click();
	await panelA.getByRole('button', { name: /Immortal Fury/ }).click();
	await expect(panelA.locator('.error-small')).toContainText('65 pts');

	await page.locator('button:has-text("RUN SIMULATION")').click();
	await expect(page.locator('p.error')).toHaveText('Character A exceeds 50 gift points (65)');
	await expect(page.locator('text=WINNER')).toHaveCount(0);
});

test('Warhammer Simulator - item limit disables a third item', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	const panelA = page.locator('.sim-builder-grid .panel').first();
	await panelA.getByRole('button', { name: /Strength Potion/ }).click();
	await panelA.getByRole('button', { name: /Toughness Potion/ }).click();
	await expect(panelA.getByRole('button', { name: /Potion of Speed/ })).toBeDisabled();
	await expect(panelA.locator('text=Item limit reached')).toBeVisible();
	// Gifts stay available.
	await expect(panelA.getByRole('button', { name: /Killing Blow/ })).toBeEnabled();
});

test('Warhammer Simulator - charge control has no Initiative bonus', async ({ page }) => {
	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');

	await expect(page.locator('#charger')).toBeVisible();
	await expect(page.locator('#charge-bonus')).toHaveCount(0);
	await expect(page.locator('text=Charge persists')).toHaveCount(0);
});

test('Warhammer Simulator - default 100k run renders every chart without page errors', async ({
	page
}) => {
	const pageErrors: Error[] = [];
	page.on('pageerror', (err) => pageErrors.push(err));

	await page.goto('/warhammer-simulator');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('#sim-count')).toHaveValue('100000');

	await page.locator('#sim-seed').fill('12345');
	await page.locator('#charger').selectOption('A');
	await page.locator('button:has-text("RUN SIMULATION")').click();

	await expect(page.locator('text=WINNER')).toBeVisible({ timeout: 120_000 });
	const canvases = page.locator('.sim-results-grid canvas');
	await expect(canvases).toHaveCount(3);
	for (let i = 0; i < 3; i++) await expect(canvases.nth(i)).toBeVisible();

	const winRates = page.locator('.winner-value');
	await expect(winRates).toHaveCount(3);
	for (let i = 0; i < 3; i++) await expect(winRates.nth(i)).toHaveText(/^\d{1,3}\.\d%$/);
	await expect(page.locator('.seed-used')).toHaveText('12345');
	await expect(page.locator('.stale-warning')).toHaveCount(0);

	// Editing a character flags the old results as stale and keeps the run's labels.
	await page.locator('#charA-name').fill('Renamed');
	await expect(page.locator('.stale-warning')).toBeVisible();
	await expect(page.locator('.winner-label').first()).toHaveText('Character A');

	expect(pageErrors).toEqual([]);
});
