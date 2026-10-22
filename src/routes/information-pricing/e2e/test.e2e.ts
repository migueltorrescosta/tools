import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { presetModel, type PresetId } from '../../../lib/information-pricing/presets';
import type { Model } from '../../../lib/information-pricing/types';

const PREFIX = 'information-pricing:';
/** Few samples keep each run well under a second. */
const SAMPLES = 20_000;

async function open(page: Page, hash = '') {
	await page.goto(`/information-pricing${hash}`);
	await expect(page.locator('div.container[data-hydrated]')).toBeVisible();
}

/** A `#m=` share link for `model`, encoded like the page does (deflate-raw, base64url). */
function link(model: Model): string {
	const json = JSON.stringify({ v: 1, model });
	return `#m=${deflateRawSync(Buffer.from(json)).toString('base64url')}`;
}

/** The model a share link carries, or null. */
function linkModel(url: string | null): Model | null {
	const encoded = url?.split('#m=')[1];
	if (!encoded) return null;
	return JSON.parse(inflateRawSync(Buffer.from(encoded, 'base64url')).toString()).model;
}

/** A preset's model with fewer samples. */
function small(id: PresetId, samples = SAMPLES): Model {
	return { ...presetModel(id), samples };
}

/** Press Run (or Add scenarios) and wait for the `done`-th finished job. */
async function press(page: Page, name: 'Run' | 'Add scenarios', done: number) {
	await page.getByRole('button', { name, exact: true }).click();
	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', String(done), {
		timeout: 20_000
	});
}

const reward = (page: Page) => page.getByTestId('reward');
const preset = (page: Page) => page.getByTestId('preset');
const inputRows = (page: Page) => page.getByTestId('input-row');
const runButton = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });

/** The seed of the autosaved model, or null. */
async function savedSeed(page: Page): Promise<number | null> {
	return page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.model?.seed ?? null,
		`${PREFIX}model`
	);
}

test('choosing a preset fills the editor; an edit shows Custom', async ({ page }) => {
	await open(page);
	await expect(preset(page)).toHaveValue('distribution-centre');
	await expect(inputRows(page)).toHaveCount(3);
	await expect(reward(page)).toHaveValue('min(N, t*T)*P - t*C');

	await preset(page).selectOption('airline-share-buyback');
	await expect(inputRows(page)).toHaveCount(6);
	await expect(page.getByTestId('intermediate-row')).toHaveCount(4);
	await expect(page.getByRole('combobox', { name: 'Formula for L' })).toHaveValue(
		'C0 - b + Delta/1e6'
	);
	await expect(page.getByLabel('Unit')).toHaveValue('M€');

	await page.getByRole('textbox', { name: 'Seed' }).fill('7');
	await expect(preset(page)).toHaveValue('custom');
	await expect(preset(page).locator('option:checked')).toHaveText('Custom');
});

test('add and remove an input', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'Add input' }).click();
	await expect(inputRows(page)).toHaveCount(4);
	await expect(page.getByRole('textbox', { name: 'Symbol of input X' })).toHaveValue('X');
	await expect(page.getByRole('combobox', { name: 'Distribution of input X' })).toHaveValue(
		'normal'
	);
	await expect(preset(page)).toHaveValue('custom');

	await page.getByRole('button', { name: 'Remove input X' }).click();
	await expect(inputRows(page)).toHaveCount(3);
	// Back to exactly the preset
	await expect(preset(page)).toHaveValue('distribution-centre');
	await page.getByRole('button', { name: 'Remove input C' }).click();
	await expect(inputRows(page)).toHaveCount(2);
	// The reward still uses C, so the model cannot run
	await expect(runButton(page)).toBeDisabled();
});

test('a formula error shows a message and a caret and blocks Run; fixing it unblocks', async ({
	page
}) => {
	await open(page);
	await expect(runButton(page)).toBeEnabled();
	await reward(page).fill('min(N, t*T)*P - t*');
	const field = page.locator('.ui-field', { has: reward(page) });
	await expect(field.locator('.ui-error')).toBeVisible();
	await expect(page.getByTestId('reward-caret')).toContainText('^');
	await expect(page.getByTestId('run-reason')).toContainText('Reward');
	await expect(runButton(page)).toBeDisabled();

	await reward(page).fill('min(N, t*T)*P - t*C');
	await expect(field.locator('.ui-error')).toHaveCount(0);
	await expect(page.getByTestId('reward-caret')).toHaveCount(0);
	await expect(runButton(page)).toBeEnabled();
	// An unknown symbol is an error too
	await reward(page).fill('Q*t');
	await expect(field.locator('.ui-error')).toContainText('Q');
	await expect(runButton(page)).toBeDisabled();
});

test('renaming a symbol rewrites the formulas that use it', async ({ page }) => {
	await open(page, link(presetModel('airline-share-buyback')));
	await page.getByRole('textbox', { name: 'Symbol of input K' }).fill('Km');
	await expect(page.getByRole('textbox', { name: 'Symbol of input Km' })).toHaveValue('Km');
	await expect(page.getByRole('combobox', { name: 'Formula for Rev' })).toHaveValue('Km*p');
	await expect(page.getByRole('combobox', { name: 'Formula for Fuel' })).toHaveValue('Km*F');

	await page.getByLabel('Decision symbol').fill('spend');
	await expect(page.getByRole('combobox', { name: 'Formula for L' })).toHaveValue(
		'C0 - spend + Delta/1e6'
	);
	await expect(reward(page)).toHaveValue('spend*R + (L >= 0 ? L*(1+i)^5 : L*(1+Lr)^5)');
	await expect(runButton(page)).toBeEnabled();
});

test('autocomplete offers declared symbols and inserts the chosen one', async ({ page }) => {
	await open(page, link(presetModel('airline-share-buyback')));
	await reward(page).fill('');
	await reward(page).pressSequentially('b*De');
	const list = page.getByRole('listbox', { name: 'Suggestions' });
	await expect(list).toBeVisible();
	await expect(list.getByRole('option', { name: /Delta/ })).toBeVisible();
	await list.getByRole('option', { name: /Delta/ }).click();
	await expect(reward(page)).toHaveValue('b*Delta');
	await expect(list).toBeHidden();

	// Keyboard: Enter takes the active suggestion
	await reward(page).pressSequentially(' + Fu');
	await expect(list.getByRole('option', { name: /Fuel/ })).toBeVisible();
	await reward(page).press('Enter');
	await expect(reward(page)).toHaveValue('b*Delta + Fuel');
	await expect(runButton(page)).toBeEnabled();
});

const BEST: [PresetId, string, number][] = [
	['distribution-centre', '10 trucks', 3],
	['airline-share-buyback', '1000 M€', 6]
];

for (const [id, best, inputs] of BEST) {
	test(`Run on ${id} shows the results and picks ${best}`, async ({ page }) => {
		await open(page, link(small(id)));
		await press(page, 'Run', 1);
		await expect(page.getByTestId('run-status')).toContainText('20,000 scenarios');
		await expect(page.getByTestId('results')).toBeVisible();
		await expect(page.getByTestId('headline')).toBeVisible();
		await expect(page.getByTestId('best-decision')).toHaveText(best);
		await expect(page.getByTestId('price')).not.toBeEmpty();
		await expect(page.getByTestId('worst')).not.toBeEmpty();
		await expect(page.getByTestId('loss-table').locator('tbody tr')).toHaveCount(5);
		await expect(page.getByTestId('loss-table').locator('tr.best th')).toContainText(best);
		await expect(page.getByTestId('voi-table').locator('tbody tr')).toHaveCount(inputs);
		await expect(page.getByTestId('policy-tree')).toBeVisible();
		await expect(page.getByTestId('stale')).toHaveCount(0);
	});
}

test('the same seed and samples reproduce the price; Add scenarios grows the set', async ({
	page
}) => {
	await open(page, link(small('distribution-centre')));
	await press(page, 'Run', 1);
	const price = await page.getByTestId('price').textContent();
	expect(price).toMatch(/\d/);
	await press(page, 'Run', 2);
	await expect(page.getByTestId('price')).toHaveText(price!);

	await expect(page.locator('#add-hint')).toContainText('appends 20,000 to the 20,000');
	await press(page, 'Add scenarios', 3);
	await expect(page.getByTestId('run-status')).toContainText('40,000 scenarios');
	await expect(page.locator('#add-hint')).toContainText('to the 40,000');
	await expect(page.getByTestId('stale')).toHaveCount(0);
});

test('any edit marks the results stale; Run clears the marker', async ({ page }) => {
	await open(page, link(small('distribution-centre')));
	await expect(page.getByTestId('stale')).toHaveCount(0);
	await press(page, 'Run', 1);
	await page.getByRole('textbox', { name: 'Seed' }).fill('3');
	await expect(page.getByTestId('stale')).toBeVisible();
	// Undoing the edit makes the results current again
	await page.getByRole('textbox', { name: 'Seed' }).fill('2026');
	await expect(page.getByTestId('stale')).toHaveCount(0);
	await page.getByRole('textbox', { name: 'mean of input P' }).fill('0.5');
	await expect(page.getByTestId('stale')).toBeVisible();
	await press(page, 'Run', 2);
	await expect(page.getByTestId('stale')).toHaveCount(0);
});

test('the copied share link restores the model in a fresh browser', async ({
	page,
	context,
	browser
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page);
	await preset(page).selectOption('airline-share-buyback');
	await page.getByRole('textbox', { name: 'Symbol of input K' }).fill('Km');
	await page.getByRole('textbox', { name: 'Seed' }).fill('99');
	const copy = page.getByRole('button', { name: 'Copy share link (the model, never results)' });
	await expect(copy).toHaveAttribute('data-url', /#m=/);
	// The link follows the last edit
	await expect.poll(async () => linkModel(await copy.getAttribute('data-url'))?.seed).toBe(99);
	await copy.click();
	await expect(page.getByTestId('share-status')).toHaveText('Link copied');
	const url = await page.evaluate(() => navigator.clipboard.readText());
	expect(url).toMatch(/\/information-pricing#m=[\w-]+$/);

	const fresh = await browser.newContext();
	const other = await fresh.newPage();
	await other.goto(url);
	await expect(other.locator('div.container[data-hydrated]')).toBeVisible();
	await expect(other.getByRole('textbox', { name: 'Seed' })).toHaveValue('99');
	await expect(other.getByTestId('input-row')).toHaveCount(6);
	await expect(other.getByRole('combobox', { name: 'Formula for Rev' })).toHaveValue('Km*p');
	await expect(other.getByTestId('preset')).toHaveValue('custom');
	await expect(other.getByTestId('link-error')).toHaveCount(0);
	expect(linkModel(url)).toMatchObject({ seed: 99, samples: 100_000 });
	// The hash is dropped once read, so a reload keeps later edits
	await expect(other).toHaveURL(/\/information-pricing$/);
	await fresh.close();
});

test('a bad link shows an error and falls back to the default preset', async ({ page }) => {
	await open(page, '#m=not*base64');
	await expect(page.getByTestId('link-error')).toContainText('not valid base64url');
	await expect(preset(page)).toHaveValue('distribution-centre');

	await open(page, `#m=${deflateRawSync(Buffer.from('{"v":9}')).toString('base64url')}`);
	await expect(page.getByTestId('link-error')).toContainText('Unsupported version 9');
	await expect(preset(page)).toHaveValue('distribution-centre');
});

test('Download scenarios writes a header and one row per scenario', async ({ page }) => {
	await open(page, link(small('distribution-centre', 500)));
	await expect(page.getByTestId('download-csv')).toBeDisabled();
	await press(page, 'Run', 1);
	const download = page.waitForEvent('download');
	await page.getByTestId('download-csv').click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('scenarios.csv');
	const text = (await (await file.createReadStream()).toArray()).join('');
	const lines = text.trimEnd().split('\r\n');
	const decisions = ['8 trucks', '9 trucks', '10 trucks', '11 trucks', '12 trucks'];
	expect(lines[0]).toBe(
		[
			'Number of Packages',
			'Profit per Package',
			'Maintenance cost per Truck',
			...decisions,
			...decisions.map((d) => `${d} Opportunity Loss`),
			'Optimal Reward'
		].join(',')
	);
	expect(lines).toHaveLength(501);
	for (const line of lines.slice(1)) expect(line.split(',')).toHaveLength(14);
});

test('autosave restores the model after a reload; Clear saved data resets it', async ({ page }) => {
	await open(page);
	await preset(page).selectOption('blank');
	await page.getByRole('textbox', { name: 'Seed' }).fill('5');
	await expect.poll(() => savedSeed(page)).toBe(5);

	await open(page);
	await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('5');
	await expect(inputRows(page)).toHaveCount(1);
	await expect(reward(page)).toHaveValue('d*X');

	// The first click asks for confirmation
	await page.getByRole('button', { name: 'Clear saved data' }).click();
	await page.getByRole('button', { name: 'Confirm: clear saved data' }).click();
	await expect(page).toHaveURL(/\/information-pricing$/);
	await expect(page.locator('div.container[data-hydrated]')).toBeVisible();
	await expect(preset(page)).toHaveValue('distribution-centre');
	await expect(page.getByRole('textbox', { name: 'Seed' })).toHaveValue('2026');
	await expect(inputRows(page)).toHaveCount(3);
	await expect.poll(() => savedSeed(page)).toBe(2026);
	// A reload now opens the default too
	await open(page);
	await expect(preset(page)).toHaveValue('distribution-centre');
});
