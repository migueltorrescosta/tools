import { expect, test, type Page } from '@playwright/test';

/** Load the page and wait until it has hydrated, so clicks and inputs are not lost. */
async function open(page: Page) {
	await page.goto('/company-trends');
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

const industries = (page: Page) => page.getByRole('group', { name: 'Industries' });

test('Company trends - homepage card links to the tool', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('link', { name: /Company Trends/ }).click();
	await expect(page).toHaveURL(/\/company-trends$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Company Trends');
});

test('Company trends - renders the chart at the last quarter with default companies', async ({
	page
}) => {
	await open(page);
	await expect(page.getByTestId('trends-chart')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	const heads = page.getByTestId('head-dot');
	expect(await heads.count()).toBeGreaterThan(5);
	await expect(page.getByTestId('quarter-label')).toHaveText(/^20\d\dQ[1-4]$/);
});

test('Company trends - slider moves through time', async ({ page }) => {
	await open(page);
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
	await open(page);
	await page.getByTestId('quarter-slider').fill('0');
	await page.getByRole('button', { name: /Play|Pause/ }).click();
	await expect(page.getByTestId('quarter-label')).not.toHaveText('2000Q1', { timeout: 5000 });
	await page.getByRole('button', { name: /Play|Pause/ }).click();
});

test('Company trends - checkboxes and type filter control visible companies', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'None', exact: true }).click();
	await expect(page.getByTestId('head-dot')).toHaveCount(0);

	await page.getByRole('checkbox', { name: 'Apple' }).check();
	await expect(page.getByRole('button', { name: /^Apple, \d{4}Q[1-4]$/ })).toHaveCount(1);
	await expect(page.getByTestId('head-dot')).toHaveCount(1);

	await industries(page).getByRole('checkbox', { name: 'tech', exact: true }).uncheck();
	await expect(page.getByTestId('head-dot')).toHaveCount(0);
});

test('Company trends - currency selector relabels axes', async ({ page }) => {
	await open(page);
	const chart = page.getByTestId('trends-chart');
	await expect(chart).toContainText('€');
	await page.getByRole('radio', { name: 'USD', exact: true }).check();
	await expect(chart).toContainText('Revenue (trailing 12 months, USD, log scale)');
	await expect(chart).toContainText('$');
	await page.getByRole('radio', { name: 'GBP', exact: true }).check();
	await expect(chart).toContainText('£');
});

test('Company trends - tooltip shows provenance and pins with a source link', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'None', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Apple' }).check();
	const head = page.getByTestId('head-dot').first();
	await head.hover({ force: true });
	const tooltip = page.getByTestId('trends-tooltip');
	await expect(tooltip).toContainText('Apple');
	await expect(tooltip).toContainText(/Reported|Interpolated/);
	await head.click({ force: true });
	await expect(tooltip.getByRole('link').first()).toHaveAttribute('href', /^https?:\/\//);
	await page.keyboard.press('Escape');
});

test('Company trends - a pinned tooltip follows a currency switch', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'None', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Apple' }).check();
	// Pin from the keyboard: focus the company's head and press Enter.
	await page.getByRole('button', { name: /^Apple, / }).focus();
	await page.keyboard.press('Enter');
	const tooltip = page.getByTestId('trends-tooltip');
	await expect(tooltip.getByRole('button', { name: 'Close' })).toBeFocused();

	await page.getByRole('radio', { name: 'USD', exact: true }).check();
	const table = page.getByTestId('table-view');
	await table.getByText(/^Data table/).click();
	const row = table.getByRole('row', { name: /Apple/ });
	const usdRevenue = (await row.getByRole('cell').nth(3).textContent())!.trim();
	expect(usdRevenue).toMatch(/^\$/);
	await expect(tooltip.getByRole('definition').nth(1)).toHaveText(usdRevenue);

	// Escape unpins (focus returns to the company's head, which shows it unpinned).
	await page.keyboard.press('Escape');
	await expect(tooltip.getByRole('button', { name: 'Close' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Apple, / })).toBeFocused();
});

test('Company trends - a pinned tooltip closes when its company is deselected', async ({
	page
}) => {
	await open(page);
	await page.getByRole('button', { name: 'None', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Apple' }).check();
	await page.getByTestId('head-dot').first().click({ force: true });
	await expect(page.getByTestId('trends-tooltip')).toBeVisible();
	await page.getByRole('checkbox', { name: 'Apple' }).uncheck();
	await expect(page.getByTestId('trends-tooltip')).toHaveCount(0);
});

test('Company trends - table view links each row to its source filing', async ({ page }) => {
	await open(page);
	const table = page.getByTestId('table-view');
	await table.getByText(/^Data table/).click();
	const row = table.getByRole('row', { name: /Apple/ });
	await expect(row.getByRole('link').first()).toHaveAttribute('href', /^https?:\/\//);

	// An interpolated quarter links both bracketing filings
	await page.getByTestId('quarter-slider').fill('41');
	await expect(row).toContainText('interpolated between');
	await expect(row.getByRole('link')).toHaveCount(2);
});

test('Company trends - y axis is operating margin with a 0% break-even line', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('y-axis-title')).toHaveText(/Operating margin/);
	await expect(page.getByTestId('breakeven')).toHaveCount(1);
	const chart = page.getByTestId('trends-chart');
	await expect(chart).toContainText('−200%');
	await expect(chart).toContainText('100%');
});

/** Distinct trail stroke colours per company id. */
async function trailColors(page: import('@playwright/test').Page) {
	return page.locator('[data-company]').evaluateAll((groups) =>
		groups.map((g) => ({
			id: g.getAttribute('data-company'),
			type: g.getAttribute('data-type'),
			color: getComputedStyle(g.querySelector('path.trail') ?? g).stroke
		}))
	);
}

test('Company trends - a single industry gets one colour per company', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'All', exact: true }).click();
	for (const box of await industries(page).getByRole('checkbox').all()) {
		if ((await box.getAttribute('value')) !== 'tech') await box.uncheck();
	}
	await expect(page.getByTestId('color-mode')).toHaveText('Coloured by company');
	const colors = await trailColors(page);
	expect(colors.length).toBeGreaterThan(5);
	expect(new Set(colors.map((c) => c.color)).size).toBe(colors.length);
	await expect(page.getByTestId('company-swatch')).toHaveCount(colors.length);
});

test('Company trends - large selections colour by industry', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'All', exact: true }).click();
	await expect(page.getByTestId('color-mode')).toContainText('Coloured by industry');
	const colors = await trailColors(page);
	const byType = new Map<string | null, Set<string>>();
	for (const c of colors) byType.set(c.type, (byType.get(c.type) ?? new Set()).add(c.color));
	for (const set of byType.values()) expect(set.size).toBe(1);
	await expect(page.getByTestId('company-swatch')).toHaveCount(0);
});

test('Company trends - off-scale margins are pinned with a true-value tooltip', async ({
	page
}) => {
	await open(page);
	await page.getByRole('button', { name: 'None', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Tesla' }).check();
	await page.getByTestId('quarter-slider').fill('36');
	const head = page.getByTestId('offscale-head');
	await expect(head).toHaveCount(1);
	await head.hover({ force: true });
	const tooltip = page.getByTestId('trends-tooltip');
	await expect(tooltip).toContainText('Tesla');
	await expect(tooltip).toContainText('off-scale');
	await expect(tooltip).toContainText(/−\d{1,3}(,\d{3})*\.\d%/);
});

test('Company trends - on a phone the chart opens at the large companies, with a scroll hint', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page);
	const scroller = page.getByTestId('chart-scroll');
	await expect(page.getByTestId('scroll-hint')).toBeVisible();
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft))
		.toBeLessThanOrEqual(1);
	await expect(page.locator('.ui-scroll-edges')).toHaveClass(/more-left/);
	await expect(page.locator('.ui-scroll-edges')).not.toHaveClass(/more-right/);
});
