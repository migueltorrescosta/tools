import { expect, test, type Page } from '@playwright/test';

const PREFIX = 'ancilla-mzi:';

/** The page container (not the top bar) sets data-hydrated once the router is ready. */
function hydrated(page: Page) {
	return page.getByRole('main').locator('[data-hydrated]');
}

/** Opens the page with the Noise and Accounting overrides panels expanded (they start collapsed). */
async function open(page: Page, query = '') {
	await page.goto(`/ancilla-mzi${query}`);
	await expect(hydrated(page)).toBeVisible();
	for (const id of ['noise-fold', 'accounting-fold'])
		await page.getByTestId(id).evaluate((d) => ((d as HTMLDetailsElement).open = true));
}

async function savedKeys(page: Page): Promise<string[]> {
	return page.evaluate(
		(prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)),
		PREFIX
	);
}

function rule(page: Page, id: number) {
	return page.getByTestId(`rule-${id}`);
}

const seeds = async (page: Page) =>
	parseInt((await page.getByTestId('seeds-done').textContent()) ?? '0', 10);

test('a preset fills in the custom controls', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('preset')).toHaveValue('active');
	await expect(page.getByTestId('alpha-zz')).toBeChecked();
	await expect(page.getByTestId('pulse-count')).toHaveValue('2');

	await page.getByTestId('preset').selectOption('local');
	await expect(page.getByTestId('weight')).toHaveValue('1');
	await expect(page.getByTestId('alpha-zz')).not.toBeChecked();
	await expect(page.getByTestId('alpha-xy')).not.toBeChecked();
	await expect(page.getByTestId('field-bx')).toBeChecked();

	await page.getByTestId('preset').selectOption('passive-ent');
	await expect(page.getByTestId('weight')).toHaveValue('0');
	await expect(page.getByTestId('field-bx')).not.toBeChecked();
	await expect(page.getByTestId('pulse-count')).toHaveValue('0');

	await page.getByTestId('preset').selectOption('clean');
	await expect(page.getByTestId('ancilla-same')).not.toBeChecked();
	await expect(page.getByTestId('ancilla-amplitudeDamping')).toHaveValue('0');
	await expect(rule(page, 4)).toHaveAttribute('data-kept', 'false');
});

test('custom edits: coupling toggle, pulse count, time and target', async ({ page }) => {
	await open(page);
	await page.getByTestId('alpha-xy').uncheck();
	await expect(page.getByTestId('preset')).toHaveValue('custom');
	await page.getByTestId('alpha-xy').check();
	await expect(page.getByTestId('preset')).toHaveValue('active');

	await page.getByTestId('pulse-count').selectOption('3');
	await expect(page.getByTestId('pulse-2-time')).toHaveValue('0.75');
	await expect(page.getByTestId('pulse-0-time')).toHaveValue('0.25');

	await page.getByTestId('pulse-1-time').fill('0.6');
	await page.getByTestId('pulse-1-target').selectOption('both');
	await expect(page.getByTestId('copy-link')).toHaveAttribute('data-url', /p=0\.25A_0\.6B_0\.75A/);
	await expect(page.getByTestId('run')).toBeEnabled();

	// Out of order breaks the pulse sequence
	await page.getByTestId('pulse-1-time').fill('0.9');
	await expect(page.getByTestId('validation-errors')).toContainText('must come after pulse 2');
	await expect(page.getByTestId('run')).toBeDisabled();
});

test('noise combination limits disable Run and say why', async ({ page }) => {
	await open(page);
	// Controlled Lorentzian dephasing runs pseudomodes, allowed only at (1, 1)
	await page.getByTestId('system-lorentzian').selectOption('dephasing');
	await expect(page.getByTestId('pm-levels')).toBeVisible();
	await expect(page.getByTestId('run')).toBeEnabled();
	await page.getByTestId('nS').fill('2');
	await expect(page.getByTestId('validation-errors')).toContainText(
		'Lorentzian dephasing needs pseudomodes'
	);
	await expect(page.getByTestId('run')).toBeDisabled();
	// Lorentzian damping can't even be picked there
	await expect(
		page.getByTestId('system-lorentzian').locator('option[value="amplitudeDamping"]')
	).toBeDisabled();

	// Two Lorentzian kinds, one per register
	await open(page, '?n=1_1&ls=d_1_1&na=0_0_0_0_0&la=a_1_1');
	await expect(page.getByTestId('validation-errors')).toContainText('one Lorentzian bath per run');
	await expect(page.getByTestId('run')).toBeDisabled();
});

test('without an ancilla the A-only controls are greyed out and ignored', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('no-ancilla-note')).toHaveCount(0);
	await page.getByTestId('nA').fill('0');
	await expect(page.getByTestId('no-ancilla-note')).toBeVisible();
	await expect(page.getByTestId('alpha-zz')).toBeDisabled();
	await expect(page.getByTestId('field-bx')).toBeDisabled();
	await expect(page.getByTestId('field-cx')).toBeEnabled();
	await expect(page.getByTestId('pulse-0-target')).toBeDisabled();
	await expect(page.getByTestId('validation-errors')).toHaveCount(0);
	await expect(page.getByTestId('run')).toBeEnabled();
	await expect(rule(page, 4)).toHaveAttribute('data-kept', 'true');
});

test('the rules panel reacts to each rule break', async ({ page }) => {
	await open(page);
	for (const id of [1, 2, 3, 4]) await expect(rule(page, id)).toHaveAttribute('data-kept', 'true');

	await page.getByTestId('weight').fill('2');
	await expect(rule(page, 2)).toHaveAttribute('data-kept', 'false');
	await expect(rule(page, 2)).toContainText('a = 2 > 1');
	await page.getByTestId('weight').fill('1');
	await expect(rule(page, 2)).toHaveAttribute('data-kept', 'true');

	await page.getByTestId('mzi-particles').fill('1');
	await expect(rule(page, 1)).toHaveAttribute('data-kept', 'false');
	await expect(rule(page, 1)).toContainText('only 1 of N = 2');
	await page.getByTestId('mzi-particles').fill('2');

	await page.getByTestId('ancilla-hold').fill('2');
	await expect(rule(page, 3)).toHaveAttribute('data-kept', 'false');
	await page.getByTestId('ancilla-hold').fill('1');
	await expect(rule(page, 3)).toHaveAttribute('data-kept', 'true');

	await page.getByTestId('ancilla-same').uncheck();
	await expect(rule(page, 4)).toHaveAttribute('data-kept', 'true');
	await page.getByTestId('ancilla-dephasing').fill('0.5');
	await expect(rule(page, 4)).toHaveAttribute('data-kept', 'false');
	await expect(rule(page, 4)).toContainText('different noise');
	for (const id of [1, 2, 3]) await expect(rule(page, id)).toHaveAttribute('data-kept', 'true');
});

test('Run, Stop and Continue with live updates', async ({ page }) => {
	// The default: (1, 1) active, controlled under amplitude damping at γt = 1, fast to optimise
	await open(page);
	await page.getByTestId('run').click();
	await expect(page.getByTestId('stop')).toBeEnabled();
	await expect
		.poll(async () => Number(await page.getByTestId('metric-R').textContent()), {
			timeout: 20000
		})
		.toBeGreaterThan(1);
	await expect(page.getByTestId('convergence')).toBeVisible();
	// A log axis draws every bound instead of noting it
	await page.getByTestId('convergence').getByText('Log', { exact: true }).click();
	// (A horizontal line has no height, so Playwright never calls it visible)
	await expect(
		page.getByTestId('convergence').locator('svg[role="img"] line.ref.seminorm')
	).toHaveCount(1);
	await expect(page.getByTestId('off-scale-seminorm')).toHaveCount(0);

	await page.getByTestId('stop').click();
	await expect(page.getByTestId('continue')).toBeEnabled({ timeout: 2000 });
	await expect(page.getByTestId('run')).toBeEnabled();
	await expect(page.getByTestId('stop')).toBeDisabled();
	const stopped = await seeds(page);

	await page.getByTestId('continue').click();
	await expect(page.getByTestId('stop')).toBeEnabled();
	await expect.poll(() => seeds(page), { timeout: 15000 }).toBeGreaterThan(stopped);
	await page.getByTestId('stop').click();
	await expect(page.getByTestId('continue')).toBeEnabled({ timeout: 2000 });
});

test('the share URL restores the setup', async ({ page, browser }) => {
	await open(page);
	// The link is there before any edit
	await expect(page.getByTestId('copy-link')).toHaveAttribute('data-url', /\/ancilla-mzi\?/);
	await page.getByTestId('nS').fill('2');
	await page.getByTestId('weight').fill('0.5');
	await page.getByTestId('alpha-zz').uncheck();
	await page.getByTestId('pulse-count').selectOption('1');
	await page.getByTestId('system-amplitudeDamping').fill('0.3');
	await page.getByTestId('ancilla-same').uncheck();
	await page.getByTestId('ancilla-depolarizing').fill('0.2');
	await expect(page.getByTestId('copy-link')).toHaveAttribute('data-url', /n=2_1/);
	const url = (await page.getByTestId('copy-link').getAttribute('data-url')) ?? '';
	expect(url).toContain('n=2_1');

	// A fresh context, so nothing comes from localStorage
	const context = await browser.newContext();
	const other = await context.newPage();
	await other.goto(url);
	await expect(hydrated(other)).toBeVisible();
	await expect(other.getByTestId('nS')).toHaveValue('2');
	await expect(other.getByTestId('weight')).toHaveValue('0.5');
	await expect(other.getByTestId('alpha-zz')).not.toBeChecked();
	await expect(other.getByTestId('alpha-xx')).toBeChecked();
	await expect(other.getByTestId('pulse-count')).toHaveValue('1');
	await expect(other.getByTestId('system-amplitudeDamping')).toHaveValue('0.3');
	await expect(other.getByTestId('ancilla-same')).not.toBeChecked();
	await expect(other.getByTestId('ancilla-depolarizing')).toHaveValue('0.2');
	await expect(other.getByTestId('mzi-particles')).toHaveValue('3');
	await context.close();
});

test('Clear saved data removes the saved setup and result', async ({ page }) => {
	await open(page);
	await page.getByTestId('system-dephasing').fill('0.1');
	await page.getByTestId('run').click();
	await expect
		.poll(() => seeds(page), {
			timeout: 20000
		})
		.toBeGreaterThan(0);
	await page.getByTestId('stop').click();
	await expect(page.getByTestId('continue')).toBeEnabled({ timeout: 2000 });
	await expect.poll(() => savedKeys(page)).toHaveLength(2);

	// Both survive a reload
	await open(page);
	await expect(page.getByTestId('system-dephasing')).toHaveValue('0.1');
	await expect(page.getByText('Saved result from your last finished run.')).toBeVisible();

	// The first click asks for confirmation
	await page.getByTestId('clear-saved').click();
	await page.getByTestId('clear-saved').click();
	await expect(hydrated(page)).toBeVisible();
	await expect.poll(() => savedKeys(page)).toEqual([]);
	await expect(page.getByTestId('system-dephasing')).toHaveValue('0');
	await expect(page.getByTestId('system-amplitudeDamping')).toHaveValue('1');
	await expect(page.getByTestId('metric-R')).toHaveCount(0);
});

test('on a phone, Results follow Run and the rarely used panels start collapsed', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/ancilla-mzi');
	await expect(hydrated(page)).toBeVisible();
	await expect(page.getByTestId('noise-fold')).not.toHaveAttribute('open');
	await expect(page.getByTestId('accounting-fold')).not.toHaveAttribute('open');
	const top = async (name: string) =>
		(await page.getByRole('heading', { name, exact: true }).boundingBox())?.y ?? 0;
	const [run, results, setup] = [await top('Run'), await top('Results'), await top('Setup')];
	expect(run).toBeLessThan(results);
	expect(results).toBeLessThan(setup);
});
