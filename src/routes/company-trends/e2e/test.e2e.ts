import { expect, test } from '@playwright/test';

test('Company trends - homepage card links to the tool', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: /Company Trends/ }).click();
	await expect(page).toHaveURL(/\/company-trends$/);
	await expect(page.locator('h1')).toHaveText('COMPANY TRENDS');
});

test('Company trends - renders the chart at the last quarter with default companies', async ({
	page
}) => {
	await page.goto('/company-trends');
	await expect(page.getByTestId('trends-chart')).toBeVisible();
	await expect(page.locator('[role=alert]')).toHaveCount(0);
	const heads = page.locator('.head-dot');
	expect(await heads.count()).toBeGreaterThan(5);
	await expect(page.getByTestId('quarter-label')).toHaveText(/^20\d\dQ[1-4]$/);
});

test('Company trends - slider moves through time', async ({ page }) => {
	await page.goto('/company-trends');
	const label = page.getByTestId('quarter-label');
	const atEnd = await label.textContent();
	await page.getByTestId('quarter-slider').fill('0');
	await expect(label).toHaveText('2000Q1');
	expect(atEnd).not.toBe('2000Q1');
	await page.getByTestId('quarter-slider').fill('40');
	await expect(label).toHaveText('2010Q1');
	await expect(page.getByTestId('trends-chart')).toContainText('2010Q1');
});

test('Company trends - play advances the quarter', async ({ page }) => {
	await page.goto('/company-trends');
	await page.getByTestId('quarter-slider').fill('0');
	await page.getByTestId('play').click();
	await expect(page.getByTestId('quarter-label')).not.toHaveText('2000Q1', { timeout: 5000 });
	await page.getByTestId('play').click();
});

test('Company trends - checkboxes and type filter control visible companies', async ({ page }) => {
	await page.goto('/company-trends');
	await page.getByRole('button', { name: 'none' }).click();
	await expect(page.locator('.head-dot')).toHaveCount(0);

	await page.getByRole('checkbox', { name: 'Apple' }).check();
	await expect(page.locator('g.company[data-company=apple]')).toHaveCount(1);
	await expect(page.locator('.head-dot')).toHaveCount(1);

	await page.locator('.type-chip', { hasText: 'tech' }).getByRole('checkbox').uncheck();
	await expect(page.locator('.head-dot')).toHaveCount(0);
});

test('Company trends - currency selector relabels axes', async ({ page }) => {
	await page.goto('/company-trends');
	const chart = page.getByTestId('trends-chart');
	await expect(chart).toContainText('€');
	await page.getByRole('button', { name: 'USD', exact: true }).click();
	await expect(chart).toContainText('Revenue (trailing 12 months, USD)');
	await expect(chart).toContainText('$');
	await page.getByRole('button', { name: 'GBP', exact: true }).click();
	await expect(chart).toContainText('£');
});

test('Company trends - tooltip shows provenance and pins with a source link', async ({ page }) => {
	await page.goto('/company-trends');
	await page.getByRole('button', { name: 'none' }).click();
	await page.getByRole('checkbox', { name: 'Apple' }).check();
	const head = page.locator('.head-dot').first();
	await head.hover({ force: true });
	const tooltip = page.getByTestId('trends-tooltip');
	await expect(tooltip).toContainText('Apple');
	await expect(tooltip).toContainText(/Reported|Interpolated/);
	await head.click({ force: true });
	await expect(tooltip.locator('a').first()).toHaveAttribute('href', /^https?:\/\//);
	await page.keyboard.press('Escape');
});
