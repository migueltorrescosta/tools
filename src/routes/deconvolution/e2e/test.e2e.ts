import { expect, test, type Page } from '@playwright/test';

const PREFIX = 'deconvolution:';

/** The page container (not the top bar) sets data-hydrated once the router is ready. */
function hydrated(page: Page) {
	return page.getByRole('main').locator('[data-hydrated]');
}

async function open(page: Page, hash = '') {
	await page.goto(`/deconvolution${hash}`);
	await expect(hydrated(page)).toBeVisible();
}

async function run(page: Page) {
	await page.getByTestId('run').click();
	await expect(page.getByTestId('run-status')).toBeVisible({ timeout: 60_000 });
}

/** Fitted value of a parameter in the parametric fit table, by its row text. */
async function fitted(page: Page, of: string, param: string): Promise<number> {
	const row = page
		.getByRole('table', { name: 'Parametric fit' })
		.getByRole('row')
		.filter({ has: page.getByRole('cell', { name: of, exact: true }) })
		.filter({ has: page.getByRole('cell', { name: param, exact: true }) });
	return Number((await row.getByRole('cell').nth(2).innerText()).replace(/,/g, ''));
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript((prefix) => {
		if (sessionStorage.getItem('e2e-cleared')) return;
		for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
		sessionStorage.setItem('e2e-cleared', '1');
	}, PREFIX);
});

test('shows the signal, the noise and what we observe', async ({ page }) => {
	await open(page);
	const chart = page.getByTestId('model-chart');
	await expect(chart.getByTestId('curve-x')).toBeVisible();
	await expect(chart.getByTestId('curve-y')).toBeVisible();
	await expect(chart.getByTestId('curve-z')).toBeVisible();
	expect(await chart.locator('rect.bar:not([height="0"])').count()).toBeGreaterThan(10);
});

test('a discrete signal is drawn as point masses', async ({ page }) => {
	await open(page);
	await page.getByTestId('preset').selectOption('counts');
	await expect(page.getByTestId('model-chart').getByTestId('stems-x')).toBeVisible();
});

test('invalid parameters show an inline error and hide the chart', async ({ page }) => {
	await open(page);
	await page.getByTestId('y-family').selectOption('normal');
	await page.getByTestId('y-sigma').fill('-1');
	await expect(page.getByText('σ must be positive.')).toBeVisible();
	await expect(page.getByTestId('model-chart')).toHaveCount(0);
	await expect(page.getByTestId('run')).toBeDisabled();
});

test('the noise hides its location parameter', async ({ page }) => {
	await open(page);
	await page.getByTestId('y-family').selectOption('normal');
	await expect(page.getByTestId('y-sigma')).toBeVisible();
	await expect(page.getByTestId('y-mu')).toHaveCount(0);
});

test('the parametric fit recovers a simulated model', async ({ page }) => {
	await open(page);
	await page.getByTestId('method-npmle').uncheck();
	await run(page);
	expect(Math.abs((await fitted(page, 'X', 'k')) - 3)).toBeLessThan(0.8);
	expect(Math.abs((await fitted(page, 'Y', 'b')) - 0.5)).toBeLessThan(0.25);
	await expect(page.getByTestId('estimate-chart').getByTestId('curve-mle')).toBeVisible();
	await expect(page.getByTestId('identifiability')).toHaveCount(0);
});

test('normal signal plus normal noise is flagged as not identifiable', async ({ page }) => {
	await open(page);
	await page.getByTestId('x-family').selectOption('normal');
	await page.getByTestId('y-family').selectOption('normal');
	await page.getByTestId('method-npmle').uncheck();
	await run(page);
	await expect(page.getByTestId('identifiability')).toContainText('σ of X and σ of Y');
});

test('methods that need another noise are disabled with a reason', async ({ page }) => {
	await open(page);
	await page.getByTestId('y-family').selectOption('laplace');
	await expect(page.getByTestId('method-gmm')).toBeDisabled();
	await expect(page.getByText('The Gaussian mixture needs normal noise.')).toBeVisible();
	await page.getByTestId('y-family').selectOption('uniform');
	await expect(page.getByTestId('method-kernel')).toBeDisabled();
	await page.getByTestId('y-family').selectOption('poisson');
	await expect(page.getByTestId('method-npmle')).toBeDisabled();
});

test('every method runs on two peaks in white noise and reports distances to the truth', async ({
	page
}) => {
	test.setTimeout(120_000);
	await open(page);
	// Two normal peaks in normal noise: identifiable only with the noise as entered.
	await page.getByTestId('preset').selectOption('two-peaks');
	await page.getByTestId('fit-noise').uncheck();
	for (const m of ['gmodel', 'kernel', 'gmm']) await page.getByTestId(`method-${m}`).check();
	await run(page);
	const table = page.getByRole('table', { name: 'Fits' });
	for (const name of [
		'Parametric MLE',
		'NPMLE (grid)',
		'g-modeling',
		'Kernel deconvolution',
		'Gaussian mixture'
	])
		await expect(table.getByRole('cell', { name, exact: true })).toBeVisible();
	const chart = page.getByTestId('estimate-chart');
	await expect(chart.getByTestId('stems-npmle')).toBeVisible();
	await expect(chart.getByTestId('curve-truth')).toBeVisible();
	const w1 = await table.getByRole('row').nth(1).getByRole('cell').nth(5).innerText();
	expect(Number(w1)).toBeLessThan(0.5);
});

test('pasted data is parsed, bad lines reported, and estimated', async ({ page }) => {
	await open(page);
	await page.getByRole('radio', { name: 'Your data' }).check();
	const values = Array.from({ length: 200 }, (_, i) => ((i * 7919) % 200) / 40 - 2.5);
	await page.getByTestId('paste').fill(['z', ...values.map(String), 'oops'].join('\n'));
	await expect(page.getByTestId('upload-status')).toContainText('200 numbers, header skipped');
	await expect(page.getByText('Skipped 1 line')).toBeVisible();
	await run(page);
	await expect(page.getByRole('table', { name: 'Fits' })).toBeVisible();
	await expect(page.getByText('W₁ and L₁ need the true signal')).toBeVisible();
});

test('bootstrap can be stopped, and shades a band when it finishes', async ({ page }) => {
	test.setTimeout(120_000);
	await open(page);
	await page.getByTestId('preset').selectOption('two-peaks');
	await page.getByTestId('fit-noise').uncheck();
	await page.getByTestId('method-mle').uncheck();
	await page.getByTestId('method-npmle').uncheck();
	await page.getByTestId('method-gmodel').check();
	await run(page);
	const results = page.getByTestId('results');
	await page.getByLabel('Resamples B').fill('2000');
	await page.getByTestId('bootstrap').click();
	await results.getByRole('button', { name: 'Stop' }).click();
	await expect(page.getByText('Bootstrap stopped.')).toBeVisible();
	await expect(page.getByTestId('estimate-chart').locator('path.band')).toHaveCount(0);
	await page.getByLabel('Resamples B').fill('20');
	await page.getByTestId('bootstrap').click();
	await expect(page.getByTestId('estimate-chart').locator('path.band')).toBeVisible({
		timeout: 60_000
	});
});

test('settings survive a reload and travel in the share link', async ({ page }) => {
	await open(page);
	await page.getByTestId('n').fill('500');
	await page.getByTestId('seed').fill('42');
	await page.reload();
	await expect(hydrated(page)).toBeVisible();
	await expect(page.getByTestId('n')).toHaveValue('500');
	await expect(page.getByTestId('seed')).toHaveValue('42');
});

test('a damaged share link falls back to the defaults with a warning', async ({ page }) => {
	await open(page, '#s=not-a-real-link');
	await expect(page.getByText('This link is damaged')).toBeVisible();
	await expect(page.getByTestId('model-chart')).toBeVisible();
});
