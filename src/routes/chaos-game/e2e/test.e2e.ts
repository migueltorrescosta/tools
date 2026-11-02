import { expect, test, type Page } from '@playwright/test';

const PREFIX = 'chaos-game:';

/**
 * Waits until both the page container and the layout's top bar set data-hydrated:
 * a select changed before the layout hydrates can lose its change.
 */
async function ready(page: Page) {
	await expect(page.getByRole('main').locator('[data-hydrated]')).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Site' })).toHaveAttribute('data-hydrated');
}

async function open(page: Page, hash = '') {
	await page.goto(`/chaos-game${hash}`);
	await ready(page);
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript((prefix) => {
		if (sessionStorage.getItem('e2e-cleared')) return;
		for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
		sessionStorage.setItem('e2e-cleared', '1');
	}, PREFIX);
});

test.describe('chaos game', () => {
	test('loads with three handles and the run reaches 10,000,000 jumps', async ({ page }) => {
		await open(page);
		await expect(page.getByTestId('handle')).toHaveCount(3);
		await page.getByTestId('run').click();
		await expect
			.poll(() => page.getByTestId('progress').getAttribute('data-jumps'), { timeout: 30_000 })
			.toBe('10000000');
	});

	test('plot background click adds a fourth handle and row', async ({ page }) => {
		await open(page);
		await page.getByTestId('plot-background').click({ position: { x: 50, y: 50 } });
		await expect(page.getByTestId('handle')).toHaveCount(4);
		await expect(page.getByTestId('points-table').locator('tbody tr')).toHaveCount(4);
	});

	test('first handle arrow right changes x and delete removes it', async ({ page }) => {
		await open(page);
		const handle = page.getByTestId('handle').first();
		await handle.focus();
		const initialValue = await page.getByLabel('Point 1 x').inputValue();
		await handle.press('ArrowRight');
		const newValue = await page.getByLabel('Point 1 x').inputValue();
		expect(newValue).not.toBe(initialValue);
		await handle.press('Delete');
		await expect(page.getByTestId('handle')).toHaveCount(2);
	});

	test('sides 5 then polygon creates five handles and touching button', async ({ page }) => {
		await open(page);
		await page.getByLabel('Sides').fill('5');
		await page.getByTestId('use-polygon').click();
		await expect(page.getByTestId('handle')).toHaveCount(5);
		await expect(page.getByTestId('touching')).toBeVisible();
		await page.getByTestId('touching').click();
		const ratioValue = await page.getByTestId('ratio').inputValue();
		expect(parseFloat(ratioValue)).toBeCloseTo(0.618, 3);
	});

	test('custom rule shows alert for invalid input', async ({ page }) => {
		await open(page);
		await page.getByRole('radio', { name: 'Custom' }).check();
		await expect(page.getByTestId('custom-rule')).toBeVisible();
		await page.getByTestId('custom-rule').fill('x');
		await expect(page.getByRole('alert')).toContainText('whole numbers');
		await page.getByTestId('custom-rule').fill('1');
		await expect(page.getByRole('alert')).toHaveCount(0);
	});

	test('challenge falcon scores low until the answer solves it', async ({ page }) => {
		await open(page);
		const card = page.getByTestId('challenges').locator('button[data-id="falcon"]');
		await card.click();
		await expect(card).toHaveAttribute('aria-pressed', 'true');
		const score = () => page.getByTestId('score').getAttribute('data-score');
		await expect.poll(score, { timeout: 30_000 }).toMatch(/^0\.[0-8]/);
		await expect(page.getByTestId('solved')).toHaveCount(0);
		await page.getByTestId('show-answer').click();
		await expect(page.getByTestId('handle')).toHaveCount(5);
		await expect.poll(async () => Number(await score()), { timeout: 30_000 }).toBeGreaterThan(0.9);
		await expect(page.getByTestId('solved')).toBeVisible();
	});

	test('dragging a handle moves its point', async ({ page }) => {
		await open(page);
		const before = Number(await page.getByLabel('Point 2 x').inputValue());
		const box = (await page.getByTestId('handle').nth(1).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		for (let i = 1; i <= 5; i++)
			await page.mouse.move(box.x + box.width / 2 + i * 20, box.y + box.height / 2);
		await page.mouse.up();
		await expect
			.poll(async () => Number(await page.getByLabel('Point 2 x').inputValue()))
			.toBeGreaterThan(before);
		await expect(page.getByTestId('handle')).toHaveCount(3);
	});

	test('share link round trip', async ({ page }) => {
		await open(page);
		await page.getByTestId('ratio').fill('0.6');
		await page.getByTestId('ratio').press('Tab');
		await expect
			.poll(() => page.getByTestId('copy-link').getAttribute('data-url'), { timeout: 30_000 })
			.toContain('r=0.6');
		const url = await page.getByTestId('copy-link').getAttribute('data-url');
		await page.goto(url ?? '/chaos-game');
		await ready(page);
		await expect(page.getByTestId('ratio')).toHaveValue('0.6');
	});

	test('reload keeps state', async ({ page }) => {
		await open(page);
		await page.getByTestId('ratio').fill('0.7');
		await page.getByTestId('ratio').press('Tab');
		await page.waitForTimeout(500);
		await page.reload();
		await ready(page);
		await expect(page.getByTestId('ratio')).toHaveValue('0.7');
	});

	test('step through shows jumps and ends', async ({ page }) => {
		await open(page);
		await page.getByTestId('step-start').click();
		await expect(page.getByTestId('current-point')).toBeVisible();
		await page.getByTestId('step-next').click();
		await page.getByTestId('step-next').click();
		await page.getByTestId('step-next').click();
		await expect(page.getByTestId('step-text')).toContainText('Jump 3');
		await page.getByTestId('step-end').click();
		await expect(page.getByTestId('walk')).toBeHidden();
	});

	test('per-point options show inputs', async ({ page }) => {
		await open(page);
		await page.getByTestId('per-point').check();
		await expect(page.getByLabel('Point 1 weight')).toBeVisible();
		await expect(page.getByLabel('Point 1 matrix a')).toBeVisible();
	});
});
