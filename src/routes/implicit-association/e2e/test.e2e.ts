import { expect, test, type Page } from '@playwright/test';
import type { Response, Run } from '../../../lib/implicit-association/types';

const PATH = '/implicit-association';

async function open(page: Page, hash = '') {
	await page.goto(PATH + hash);
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

/** A scored run: the first-focal blocks at `fast` ms and the others at `slow` ms. */
function fixtureRun(
	id: string,
	comparisonId: string,
	labels: Run['labels'],
	fast: number,
	slow: number,
	input: Run['input'] = 'keyboard'
): Run {
	const responses: Response[] = [0, 1, 2, 3].flatMap((block) =>
		[...Array(20).keys()].map((i) => ({
			block,
			group: i % 2 ? 'attribute' : 'target',
			category: 0,
			item: 0,
			correct: 'right',
			warmup: i < 4,
			rt: (block % 2 === 0 ? fast : slow) + (i % 4) * 40,
			error: false,
			input
		}))
	);
	return {
		id,
		comparisonId,
		labels,
		date: `2026-11-0${id}T10:00:00Z`,
		input,
		firstFocal: 0,
		responses
	};
}

const GENDER = { targets: ['Male', 'Female'], attributes: ['Science', 'Arts'] } as Run['labels'];
const AGE = { targets: ['Young', 'Old'], attributes: ['Good', 'Bad'] } as Run['labels'];

/** Seed history before the page loads, as earlier visits would have left it. */
async function seed(page: Page, runs: Run[]) {
	await page.addInitScript((data) => {
		if (!localStorage.getItem('implicit-association:runs'))
			localStorage.setItem('implicit-association:runs', data);
	}, JSON.stringify(runs));
}

/** Answer every trial correctly with the keyboard, after `wait` ms, until the result shows. */
async function takeTest(page: Page, wait = 0) {
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	const runner = page.getByTestId('runner');
	for (let block = 0; block < 5; block++) {
		await expect(page.getByRole('button', { name: /^Start (practice|round)$/ })).toBeVisible();
		await page.keyboard.press('Space');
		for (let t = 0; t < (block === 0 ? 16 : 20); t++) {
			await expect(runner).toHaveAttribute('data-phase', 'trial');
			const correct = await page.getByTestId('stimulus').getAttribute('data-correct');
			if (wait) await page.waitForTimeout(wait);
			await page.keyboard.press(correct === 'right' ? 'i' : 'e');
			await page.waitForFunction(
				() => document.querySelector('[data-testid=runner]')?.getAttribute('data-phase') !== 'trial'
			);
		}
	}
	await expect(page.getByTestId('result')).toBeVisible();
}

test('a full run ends with a result and joins the history', async ({ page }) => {
	test.setTimeout(120_000);
	await open(page, '#p=age');
	await expect(page.getByText('Your results appear here after your first test.')).toBeVisible();
	await takeTest(page);
	await expect(page.locator('summary', { hasText: 'All runs' })).toBeVisible();
	await page.reload();
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
	await page.locator('summary', { hasText: 'All runs' }).click();
	await expect(page.getByRole('cell', { name: 'Keyboard' })).toHaveCount(1);
});

test('a wrong key shows a red cross until the right key is pressed', async ({ page }) => {
	await open(page, '#p=gender-science');
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: 'Start practice' }).click();
	const stimulus = page.getByTestId('stimulus');
	const text = await stimulus.textContent();
	const correct = await stimulus.getAttribute('data-correct');
	await page.keyboard.press(correct === 'right' ? 'e' : 'i');
	await expect(page.getByLabel('Wrong key')).toBeVisible();
	await expect(stimulus).toHaveText(text!);
	await page.keyboard.press(correct === 'right' ? 'i' : 'e');
	await expect(page.getByLabel('Wrong key')).toBeHidden();
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('history shows a dot per run, the mean, and a heat map cell per comparison', async ({
	page
}) => {
	await seed(page, [
		fixtureRun('1', 'gender-science', GENDER, 600, 800),
		fixtureRun('2', 'gender-science', GENDER, 620, 780),
		fixtureRun('3', 'gender-science', GENDER, 650, 760),
		fixtureRun('4', 'age', AGE, 800, 600),
		fixtureRun('5', 'age', AGE, 700, 700, 'touch'),
		// Every answer under 300 ms: kept, drawn hollow, left out of means.
		fixtureRun('6', 'age', AGE, 100, 120)
	]);
	await open(page);
	await expect(page.locator('.dot-plot > svg circle.run')).toHaveCount(6);
	await expect(page.locator('.dot-plot > svg circle.run.flagged')).toHaveCount(1);
	await expect(
		page.locator('.dot-plot').getByText('Male / Female × Science / Arts', { exact: true })
	).toBeVisible();
	await expect(
		page.locator('.dot-plot').getByText('Young / Old × Good / Bad (touch)')
	).toBeVisible();
	const heat = page.locator('table.heat');
	await expect(heat.getByRole('columnheader')).toHaveText(['Science / Arts', 'Good / Bad']);
	await expect(heat.getByRole('rowheader')).toHaveText(['Male / Female', 'Young / Old']);
	await expect(heat.locator('td .n')).toHaveText(['3×', '2×']);

	// With charts on screen, a phone-width page still has no horizontal scrolling.
	await page.setViewportSize({ width: 390, height: 800 });
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
		.toBeLessThanOrEqual(390);
});

test('a custom comparison can be built and shared by link', async ({ page, context }) => {
	await open(page);
	await page.getByRole('button', { name: 'New comparison' }).click();
	const groups = [
		['Tea', 'oolong, matcha, chai, earl grey'],
		['Coffee', 'latte, mocha, ristretto, lungo'],
		['Morning', 'dawn, sunrise, breakfast, alarm'],
		['Night', 'moon, stars, midnight, dusk']
	];
	await page.getByRole('button', { name: 'Save comparison' }).click();
	await expect(page.getByText('Name every category.')).toBeVisible();
	for (const [i, [name, words]] of groups.entries()) {
		const set = page.locator('fieldset').nth(i);
		await set.getByLabel('Name').fill(name);
		await set.getByLabel('Words').fill(words);
	}
	await page.getByRole('button', { name: 'Save comparison' }).click();
	await expect(page.getByRole('combobox', { name: 'Comparison' })).toHaveValue(/^custom-/);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: /Copy share link/ }).click();
	const url = await page.evaluate(() => navigator.clipboard.readText());
	expect(url).toContain('#c=');

	const other = await context.browser()!.newContext();
	const friend = await other.newPage();
	await friend.goto(url);
	await expect(friend.locator('.container[data-hydrated]')).toBeVisible();
	await expect(
		friend.getByRole('combobox', { name: 'Comparison' }).locator('option:checked')
	).toHaveText('Yours: Tea / Coffee × Morning / Night');
	await other.close();
});

test('export and import move the history', async ({ page, browser }) => {
	await seed(page, [fixtureRun('1', 'age', AGE, 600, 800)]);
	await open(page);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export' }).click();
	const file = await (await download).path();

	const fresh = await (await browser.newContext()).newPage();
	await open(fresh);
	await fresh.getByLabel('Import file').setInputFiles(file);
	await expect(fresh.getByRole('status').filter({ hasText: 'Added 1 run.' })).toBeVisible();
	await expect(
		fresh.locator('.dot-plot').getByText('Young / Old × Good / Bad', { exact: true })
	).toBeVisible();
	await fresh.context().close();
});
