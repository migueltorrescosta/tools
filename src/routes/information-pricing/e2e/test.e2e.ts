import { deflateRawSync, inflateRawSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
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
	const json = JSON.stringify({ v: 2, model });
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
const graph = (page: Page) => page.getByTestId('dataflow');

/** Add an input of `family` through the Add input menu. */
async function addInput(page: Page, family: string) {
	await page.getByRole('button', { name: 'Add input' }).click();
	await page.getByRole('menuitem', { name: family, exact: true }).click();
}
const runButton = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });
const steps = (page: Page) => page.getByRole('list', { name: 'Steps' });
const stepButton = (page: Page, name: 'Setup' | 'Results') =>
	steps(page).getByRole('button', { name, exact: true });

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
	await expect(inputRows(page)).toHaveCount(4);
	await expect(inputRows(page).nth(3).getByTestId('family')).toHaveText('Fixed');
	await expect(reward(page)).toHaveValue('min(N, t*T)*P - t*C');

	await preset(page).selectOption('airline-share-buyback');
	await expect(inputRows(page)).toHaveCount(7);
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
	// No distribution select: a row's family is fixed once added
	await expect(page.getByTestId('setup').locator('select')).toHaveCount(1);
	await addInput(page, 'Triangular');
	await expect(inputRows(page)).toHaveCount(5);
	await expect(page.getByRole('menu')).toBeHidden();
	await expect(page.getByRole('textbox', { name: 'Symbol of input X' })).toHaveValue('X');
	const added = inputRows(page).nth(4);
	await expect(added.getByTestId('family')).toHaveText('Triangular');
	for (const [p, v] of [
		['low', '0'],
		['mode', '0.5'],
		['high', '1']
	])
		await expect(added.getByRole('textbox', { name: `${p} of input X` })).toHaveValue(v);
	await expect(preset(page)).toHaveValue('custom');

	// Keyboard: the menu opens with ArrowDown and Escape closes it
	const menuButton = page.getByRole('button', { name: 'Add input' });
	await menuButton.focus();
	await menuButton.press('ArrowDown');
	await expect(page.getByRole('menuitem', { name: 'Normal', exact: true })).toBeFocused();
	await page.keyboard.press('End');
	await expect(page.getByRole('menuitem', { name: 'Fixed' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toBeHidden();
	await expect(menuButton).toBeFocused();

	await page.getByRole('button', { name: 'Remove input X' }).click();
	await expect(inputRows(page)).toHaveCount(4);
	// Back to exactly the preset
	await expect(preset(page)).toHaveValue('distribution-centre');
	await page.getByRole('button', { name: 'Remove input C' }).click();
	await expect(inputRows(page)).toHaveCount(3);
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
	['distribution-centre', '40 trucks', 3],
	['airline-share-buyback', '750 M€', 6]
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
		await expect(page.getByTestId('headline')).toContainText(
			'Expected value of perfect information'
		);
		await expect(page.getByTestId('worst')).not.toBeEmpty();
		await expect(page.getByTestId('input-voi-row')).toHaveCount(inputs);
		// Fixed inputs have no row
		await expect(
			page
				.getByTestId('input-voi-row')
				.filter({ hasText: /Packages per Truck per Year|Cash Balance/ })
		).toHaveCount(0);
		await expect(page.getByTestId('voi-chart').getByTestId('voi-line')).toHaveCount(inputs);
		// The best decision carries its colour swatch
		await expect(page.getByTestId('best-swatch')).toBeVisible();
		const swatch = await page
			.getByTestId('best-swatch')
			.evaluate((e) => getComputedStyle(e).backgroundColor);
		expect(swatch).not.toBe('rgba(0, 0, 0, 0)');
		await expect(page.getByTestId('policy-tree')).toBeVisible();
		// Boxes read "savings" then "share", without naming the decision
		const boxes = await page.getByTestId('policy-tree').locator('text.node-text').allTextContents();
		expect(boxes.length % 2).toBe(0);
		boxes.forEach((t, k) => expect(t).toMatch(k % 2 ? /^\d+(\.\d)?%$/ : /^-?[\d.]+ \S+$/));
		expect(boxes.join(' ')).not.toMatch(/saves|scenarios|trucks/);
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

	await expect(page.locator('#add-hint')).toContainText('Appends 20,000 to the 20,000');
	// Add scenarios stays on the current step
	await stepButton(page, 'Setup').click();
	await press(page, 'Add scenarios', 3);
	await expect(stepButton(page, 'Setup')).toHaveAttribute('aria-current', 'step');
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
	await stepButton(page, 'Setup').click();
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
	await expect(other.getByTestId('input-row')).toHaveCount(7);
	await expect(other.getByRole('combobox', { name: 'Formula for Rev' })).toHaveValue('Km*p');
	await expect(other.getByTestId('preset')).toHaveValue('custom');
	await expect(other.getByTestId('link-error')).toHaveCount(0);
	expect(linkModel(url)).toMatchObject({ seed: 99, samples: 100_000 });
	// The hash is dropped once read, so a reload keeps later edits
	await expect(other).toHaveURL(/\/information-pricing$/);
	await fresh.close();
});

test('Setup sections explain themselves; References list fifteen links', async ({ page }) => {
	await open(page);
	const setup = page.getByTestId('setup');
	for (const name of ['inputs', 'intermediates', 'decisions', 'the dataflow']) {
		const tip = setup.getByRole('button', { name: `About ${name}`, exact: true });
		await expect(tip).toBeVisible();
		await tip.focus();
		await expect(page.getByRole('tooltip').filter({ visible: true })).not.toBeEmpty();
		await tip.blur();
	}
	const refs = page.getByRole('region', { name: 'References' });
	await expect(refs.getByRole('link')).toHaveCount(15);
});

for (const width of [1440, 390]) {
	test(`results at ${width} px: the tree spans the width above the inputs and losses`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page, link(small('distribution-centre')));
		await press(page, 'Run', 1);
		const tree = (await page.getByTestId('tree-box').boundingBox())!;
		const inputs = (await page.getByTestId('inputs-box').boundingBox())!;
		const losses = (await page.getByTestId('losses-box').boundingBox())!;
		expect(inputs.y).toBeGreaterThanOrEqual(tree.y + tree.height);
		expect(Math.abs(inputs.x - tree.x)).toBeLessThan(2);
		if (width === 1440) {
			// Row 2: inputs on the left, losses on the right, together as wide as the tree
			expect(losses.x).toBeGreaterThanOrEqual(inputs.x + inputs.width);
			expect(Math.abs(losses.y - inputs.y)).toBeLessThan(2);
			expect(Math.abs(losses.x + losses.width - (tree.x + tree.width))).toBeLessThan(2);
		} else {
			expect(losses.y).toBeGreaterThanOrEqual(inputs.y + inputs.height);
		}
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBe(0);
	});
}

for (const id of ['distribution-centre', 'airline-share-buyback'] as const) {
	test(`setup at 1920 px on ${id}: dataflow across the top, three tables below, nothing clipped`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 1920, height: 1000 });
		await open(page, link(small(id)));
		const setup = (await page.getByTestId('setup').boundingBox())!;
		expect(setup.width).toBeGreaterThan(1800);
		const dataflow = (await page.locator('section.dataflow').boundingBox())!;
		const tables = (await page.getByTestId('setup-tables').boundingBox())!;
		expect(Math.abs(dataflow.width - setup.width)).toBeLessThan(2);
		expect(tables.y).toBeGreaterThanOrEqual(dataflow.y + dataflow.height);
		const tops = await Promise.all(
			['inputs', 'intermediates', 'decisions'].map(async (h) =>
				Math.round((await page.locator(`#${h}-heading`).boundingBox())!.y)
			)
		);
		expect(new Set(tops).size).toBe(1);
		const clipped = await page
			.getByTestId('setup')
			.locator('input')
			.evaluateAll((els) =>
				(els as HTMLInputElement[])
					.filter((e) => e.scrollWidth > e.clientWidth + 1)
					.map((e) => e.value)
			);
		expect(clipped).toEqual([]);
	});
}

test('the dataflow graph has a node per row and an arrow per dependency', async ({ page }) => {
	await open(page, link(presetModel('airline-share-buyback')));
	await expect(graph(page)).toHaveAttribute('data-ready', '');
	const nodes = graph(page).getByTestId('dataflow-node');
	// 7 inputs, 4 intermediates, the decision and the reward
	await expect(nodes).toHaveCount(13);
	await expect(nodes.and(page.locator('[data-kind="input"]'))).toHaveCount(6);
	await expect(nodes.and(page.locator('[data-kind="fixed"]'))).toHaveCount(1);
	await expect(nodes.and(page.locator('[data-kind="intermediate"]'))).toHaveCount(4);
	await expect(nodes.and(page.locator('[data-kind="decision"]'))).toHaveCount(1);
	await expect(nodes.and(page.locator('[data-kind="reward"]'))).toHaveCount(1);
	// Random inputs wear their input colour in model order; the fixed one stays neutral.
	const inputColours = await page.evaluate(() => {
		const probe = document.createElement('div');
		document.body.append(probe);
		const out = Array.from({ length: 6 }, (_, i) => {
			probe.style.color = `var(--input-${i + 1})`;
			return getComputedStyle(probe).color;
		});
		probe.remove();
		return out;
	});
	const left = (kind: string) =>
		nodes
			.and(page.locator(`[data-kind="${kind}"]`))
			.evaluateAll((els) => els.map((e) => getComputedStyle(e).borderLeftColor));
	expect(await left('input')).toEqual(inputColours);
	for (const c of await left('fixed')) expect(inputColours).not.toContain(c);
	// Rev(K,p) Fuel(K,F) Delta(Rev,Fuel) L(C0,b,Delta) reward(b,R,L,i,Lr)
	await expect(graph(page).getByTestId('dataflow-edge')).toHaveCount(14);
	await expect(graph(page).locator('.katex').first()).toBeVisible();

	// A removed input takes its node and arrows with it
	await page.getByRole('button', { name: 'Remove input R' }).click();
	await expect(nodes).toHaveCount(12);
	await expect(graph(page).getByTestId('dataflow-edge')).toHaveCount(13);
});

test('clicking a dataflow node highlights its row; again or Escape clears it', async ({ page }) => {
	await open(page, link(presetModel('airline-share-buyback')));
	await expect(graph(page)).toHaveAttribute('data-ready', '');
	const delta = page.getByTestId('intermediate-row').nth(2);
	const node = graph(page).locator(`[data-node="${await delta.getAttribute('data-node')}"]`);
	await node.click();
	await expect(node).toHaveAttribute('aria-pressed', 'true');
	await expect(delta).toHaveClass(/selected/);
	await expect(page.locator('.setup .selected')).toHaveCount(1);
	// Its chain lights up: Rev, Fuel, K, p, F upstream; L and the reward downstream
	await expect(graph(page).locator('.df-edge.lit')).toHaveCount(6 + 2);
	await node.click();
	await expect(delta).not.toHaveClass(/selected/);
	await expect(graph(page).locator('.df-edge.lit')).toHaveCount(0);

	// Keyboard: Enter picks, Escape clears
	const reward = graph(page).locator('[data-kind="reward"]');
	await reward.focus();
	await reward.press('Enter');
	await expect(page.locator('[data-node="reward"].selected')).toHaveCount(1);
	await reward.press('Escape');
	await expect(page.locator('.setup .selected')).toHaveCount(0);
});

test('an invalid formula shows as an error node with the arrows it still names', async ({
	page
}) => {
	await open(page, link(presetModel('airline-share-buyback')));
	await page.getByRole('combobox', { name: 'Formula for Rev' }).fill('K * p +');
	const bad = graph(page).locator('.df-node.error');
	await expect(bad).toHaveCount(1);
	await expect(bad).toContainText('K * p +');
	await expect(graph(page).getByTestId('dataflow-edge')).toHaveCount(14);
	await page.getByRole('combobox', { name: 'Formula for Rev' }).fill('K*p');
	await expect(bad).toHaveCount(0);
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
	const decisions = ['30 trucks', '40 trucks', '50 trucks', '60 trucks', '70 trucks'];
	expect(lines[0]).toBe(
		[
			'Packages per Year',
			'Profit per Package',
			'Yearly cost per Truck',
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
	await expect(inputRows(page)).toHaveCount(4);
	await expect.poll(() => savedSeed(page)).toBe(2026);
	// A reload now opens the default too
	await open(page);
	await expect(preset(page)).toHaveValue('distribution-centre');
});

test('the stepper: Results waits for the first run, Run jumps there, every step is clickable', async ({
	page
}) => {
	await open(page, link(small('distribution-centre')));
	await expect(stepButton(page, 'Setup')).toHaveAttribute('aria-current', 'step');
	await expect(stepButton(page, 'Results')).toBeDisabled();
	await expect(steps(page).getByRole('button')).toHaveCount(2);
	await expect(runButton(page)).toBeVisible();

	await press(page, 'Run', 1);
	await expect(stepButton(page, 'Results')).toHaveAttribute('aria-current', 'step');
	await expect(page.getByTestId('results')).toBeVisible();
	// The run bar shows on every step
	await expect(runButton(page)).toBeVisible();
	await stepButton(page, 'Setup').click();
	await expect(page.getByTestId('setup')).toBeVisible();
	await expect(stepButton(page, 'Results')).toBeEnabled();
	await stepButton(page, 'Results').click();
	await expect(page.getByTestId('results')).toBeVisible();
});

test('Setup holds the parameters inline and the decision values as chips', async ({ page }) => {
	await open(page, link(presetModel('airline-share-buyback')));
	const setup = page.getByTestId('setup');
	await expect(setup.getByRole('textbox', { name: 'median of input K' })).toHaveValue('250000000');
	// A fixed input has a single value field
	const cash = inputRows(page).nth(6);
	await expect(cash.getByTestId('family')).toHaveText('Fixed');
	await expect(cash.locator('[inputmode="decimal"]')).toHaveCount(1);
	await expect(cash.getByRole('textbox', { name: 'value of input C0' })).toHaveValue('600');
	// No KaTeX under the formulas: TeX only in the dataflow
	await expect(setup.locator('.katex')).toHaveCount(await graph(page).locator('.katex').count());
	await expect(page.locator('input[type="range"]')).toHaveCount(0);

	const values = page.getByTestId('decision-values');
	await expect(values.locator('.chip')).toHaveCount(5);
	await page.getByRole('textbox', { name: 'New decision value' }).fill('125');
	await page.getByRole('button', { name: 'Add decision value' }).click();
	await expect(values.locator('.chip')).toHaveCount(6);
	await page.getByRole('button', { name: 'Remove decision value 125' }).click();
	await expect(values.locator('.chip')).toHaveCount(5);
	await expect(preset(page)).toHaveValue('airline-share-buyback');

	// An invalid parameter shows inline and blocks Run
	await setup.getByRole('textbox', { name: 'σ of input K' }).fill('-1');
	await expect(inputRows(page).nth(1).locator('.ui-error, .row-error').first()).toBeVisible();
	await expect(runButton(page)).toBeDisabled();
});

test('the value-of-information chart: tight log decades under a dashed EVPI ceiling, input-coloured dashed lines, gaps', async ({
	page
}) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	const chart = page.getByTestId('voi-chart');
	const evpi = Number((await page.getByTestId('price').textContent())!.replace(/[^\d.]/g, ''));
	const [lo, hi] = (await chart.getAttribute('data-bounds'))!.split(',').map(Number);
	// Top: the smallest power of 10 above the EVPI
	expect(hi).toBeCloseTo(10 ** (Math.floor(Math.log10(evpi)) + 1));
	expect(hi).toBeGreaterThan(evpi);
	// Bottom: the decade of the smallest plotted savings
	const plotted = await chart
		.getByTestId('voi-point')
		.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
	const least = Math.min(...plotted);
	expect(lo).toBeLessThanOrEqual(least);
	expect(least).toBeLessThan(10 * lo);
	// Ticks on every power of 10 between the bounds
	const ticks = await chart.locator('.axis').nth(1).locator('text:not(.title)').allTextContents();
	expect(ticks).toHaveLength(Math.round(Math.log10(hi / lo)) + 1);
	// The ceiling: a dashed line labelled with the EVPI
	const ceiling = chart.getByTestId('voi-ceiling');
	await expect(ceiling).toContainText('EVPI');
	expect(
		await ceiling.locator('line').evaluate((e) => getComputedStyle(e).strokeDasharray)
	).not.toBe('none');

	// Inputs wear the input colours, by model order and never a decision colour,
	// and are told apart by dashes too; the Results rows show the same key.
	const lines = chart.getByTestId('voi-line');
	const strokes = await lines.evaluateAll((els) => els.map((e) => getComputedStyle(e).stroke));
	const palette = (name: string, n: number) =>
		page.evaluate(
			([name, n]) => {
				const probe = document.createElement('div');
				document.body.append(probe);
				const out = Array.from({ length: n }, (_, i) => {
					probe.style.color = `var(--${name}-${i + 1})`;
					return getComputedStyle(probe).color;
				});
				probe.remove();
				return out;
			},
			[name, n] as const
		);
	// None is an Okabe–Ito decision colour (--data-1..8). --data-9..12 borrow Tol
	// muted colours, so only a model with nine or more decisions could share one.
	const decisionColours = await palette('data', 8);
	const inputColours = await palette('input', 9);
	expect(new Set(inputColours).size).toBe(9);
	for (const c of inputColours) expect(decisionColours).not.toContain(c);
	// Lines come in value-of-information order; their colours, in model order, are 1..6.
	const order = await chart
		.getByTestId('voi-key')
		.evaluateAll((els) => els.map((e) => e.textContent!.replace(' (no savings)', '').trim()));
	const model = [
		'Share Return',
		'Kilometers Flown',
		'Fuel Cost per km',
		'Loan Rate',
		'Net revenue per km',
		'Interest Rate'
	];
	strokes.forEach((s, k) => expect(s).toBe(inputColours[model.indexOf(order[k])]));
	const swatches = await page
		.getByTestId('input-swatch')
		.evaluateAll((els) => els.map((e) => getComputedStyle(e.querySelector('line')!).stroke));
	expect(swatches).toEqual(strokes);
	const dashes = await lines.evaluateAll((els) =>
		els.map((e) => e.getAttribute('stroke-dasharray'))
	);
	expect(new Set(dashes).size).toBe(dashes.length);

	// No savings, no line: an empty path and a label that says so
	const labels = await chart.getByTestId('voi-label').allTextContents();
	const paths = await lines.evaluateAll((els) => els.map((e) => e.getAttribute('d') ?? ''));
	labels.forEach((l, i) => expect(paths[i] === '').toBe(l.includes('(no savings)')));

	// Hovering a legend key fades the other lines
	await chart.getByTestId('voi-key').first().hover();
	await expect(chart.locator('g.series.dim')).toHaveCount(labels.length - 1);
});

test('the policy tree defaults to max depth 2', async ({ page }) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	await expect(page.getByRole('textbox', { name: 'Max depth' })).toHaveValue('2');
	const levels = await page
		.getByTestId('policy-tree')
		.locator('text.split-label')
		.evaluateAll((els) => new Set(els.map((e) => e.getAttribute('y'))).size);
	expect(levels).toBeGreaterThan(0);
	expect(levels).toBeLessThanOrEqual(2);
});

test('results: inputs sorted by value of information, names in the tree, max depth 1', async ({
	page
}) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	const rows = page.getByTestId('input-voi-row');
	await expect(rows).toHaveCount(6);
	const savings = (await rows.evaluateAll((els) =>
		els.map((e) => Number(e.getAttribute('data-savings')))
	)) as number[];
	const finite = savings.filter(Number.isFinite);
	expect(finite).toEqual([...finite].sort((a, b) => b - a));
	expect(savings.slice(0, finite.length)).toEqual(finite);
	// Net revenue per km leads; share return is no longer the main driver
	await expect(rows.first()).toContainText('Net revenue per km (p)');

	const tree = page.getByTestId('policy-tree');
	const names = [
		'Share Return',
		'Kilometers Flown',
		'Fuel Cost per km',
		'Loan Rate',
		'Net revenue per km',
		'Interest Rate'
	];
	const splits = tree.locator('text.split-label');
	expect(await splits.count()).toBeGreaterThan(1);
	for (const label of await splits.allTextContents()) expect(names).toContain(label);

	await page.getByRole('textbox', { name: 'Max depth' }).fill('1');
	await page.getByRole('button', { name: 'Update tree' }).click();
	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', '2', {
		timeout: 20_000
	});
	// One split level: the root's split only, and the run stays on Results
	await expect(splits).toHaveCount(1);
	await expect(stepButton(page, 'Results')).toHaveAttribute('aria-current', 'step');
});

const PROGRESS = /^(Simulating|Summary and inputs|Value of information|Policy tree) · \d+ %$/;

test('a big run shows results as they come: spinners, then the full analysis; Update tree spins only the tree', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1920, height: 1000 });
	await open(page, link(small('airline-share-buyback', 1_000_000)));
	await runButton(page).click();
	// One progress bar with the step and a percentage
	await expect(page.getByTestId('progress-label')).toHaveText(PROGRESS);
	await expect(page.getByRole('progressbar', { name: PROGRESS })).toBeVisible();
	// The first partial opens Results while the run is still going
	await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', '0');
	await expect(stepButton(page, 'Results')).toHaveAttribute('aria-current', 'step');
	await expect(page.getByTestId('headline')).toBeVisible();
	await expect(page.getByTestId('losses-box').locator('svg').first()).toBeVisible();
	const pending = page.getByTestId('results').getByTestId('pending');
	await expect(pending.first()).toBeVisible();
	await expect(pending.first()).toHaveAttribute('aria-busy', 'true');
	// CSV and Add scenarios wait for the complete run
	await expect(page.getByTestId('download-csv')).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Add scenarios' })).toBeDisabled();

	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', '1', {
		timeout: 60_000
	});
	await expect(pending).toHaveCount(0);
	await expect(page.getByTestId('policy-tree')).toBeVisible();
	await expect(page.getByTestId('voi-chart')).toBeVisible();
	await expect(page.getByTestId('voi-scatter')).toBeVisible();
	await expect(page.getByTestId('input-voi-row').first()).toHaveAttribute('data-savings', /\d/);
	await expect(page.getByTestId('download-csv')).toBeEnabled();

	// Update tree: only the tree box is pending
	await page.getByRole('textbox', { name: 'Max depth' }).fill('3');
	const onlyTree = page.waitForFunction(() => {
		const all = document.querySelectorAll('[data-testid="results"] [data-testid="pending"]');
		const tree = document.querySelectorAll('[data-testid="tree-box"] [data-testid="pending"]');
		return all.length === 1 && tree.length === 1;
	});
	await page.getByRole('button', { name: 'Update tree' }).click();
	await onlyTree;
	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', '2', {
		timeout: 60_000
	});
	await expect(pending).toHaveCount(0);
	await expect(page.getByTestId('policy-tree')).toBeVisible();
});

test('intermediates get their own rows under the inputs; decision-dependent ones are listed', async ({
	page
}) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	const box = page.getByTestId('intermediates-box');
	await expect(
		box.getByRole('heading', { name: 'Intermediates by value of information' })
	).toBeVisible();
	await expect(box).toContainText("doesn't add up with them");
	const rows = box.getByTestId('intermediate-voi-row');
	await expect(rows).toHaveCount(3);
	// Neutral rows: no input colour key
	await expect(box.getByTestId('input-swatch')).toHaveCount(0);
	// Below the last input row, after a divider
	const lastInput = (await page.getByTestId('input-voi-row').last().boundingBox())!;
	const section = (await box.boundingBox())!;
	expect(section.y).toBeGreaterThanOrEqual(lastInput.y + lastInput.height);
	expect(await box.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('solid');
	// Sorted by value of information
	const savings = await rows.evaluateAll((els) =>
		els.map((e) => Number(e.getAttribute('data-savings')))
	);
	expect(savings).toEqual([...savings].sort((a, b) => b - a));
	for (const name of [
		'Operating Revenue (Rev)',
		'Fuel Bill (Fuel)',
		'Net Operating Cash Flow (Delta)'
	])
		await expect(rows.filter({ hasText: name })).toHaveCount(1);
	// L uses the decision: listed, no plot
	const dependent = box.getByTestId('dependent-intermediate');
	await expect(dependent).toHaveCount(1);
	await expect(dependent).toHaveText(/Liquidity \(L\)\s+depends on the decision/);
	await expect(dependent.locator('svg')).toHaveCount(0);

	// A model without intermediates has no such section
	await open(page, link(small('distribution-centre')));
	await press(page, 'Run', 1);
	await expect(page.getByTestId('intermediates-box')).toHaveCount(0);
});

test('results at 1920 px: the tree, then inputs | losses | value of information side by side', async ({
	page
}) => {
	await page.setViewportSize({ width: 1920, height: 1000 });
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
	const tree = await box('tree-box');
	const [inputs, losses, voi] = [
		await box('inputs-box'),
		await box('losses-box'),
		await box('voi-box')
	];
	expect(inputs.y).toBeGreaterThanOrEqual(tree.y + tree.height);
	for (const b of [losses, voi]) expect(Math.abs(b.y - inputs.y)).toBeLessThan(2);
	expect(losses.x).toBeGreaterThanOrEqual(inputs.x + inputs.width);
	expect(voi.x).toBeGreaterThanOrEqual(losses.x + losses.width);
	expect(Math.abs(inputs.x - tree.x)).toBeLessThan(2);
	expect(Math.abs(voi.x + voi.width - (tree.x + tree.width))).toBeLessThan(2);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		)
	).toBe(0);
});

for (const id of ['distribution-centre', 'airline-share-buyback'] as const) {
	test(`the scatter on ${id}: one point per input on log decades, floor points hollow, tooltips`, async ({
		page
	}) => {
		await open(page, link(small(id)));
		await press(page, 'Run', 1);
		const scatter = page.getByTestId('voi-scatter');
		await expect(scatter).toContainText('Right: matters for the decision. Up: moves your profit.');
		const points = scatter.getByTestId('scatter-point');
		await expect(points).toHaveCount(BEST.find(([p]) => p === id)![2]);
		// Points are labelled with input names; each axis explains itself in an info tip
		const labels = await scatter.getByTestId('scatter-label').allTextContents();
		expect(labels).toHaveLength(await points.count());
		for (const l of labels) expect(l.length).toBeGreaterThan(2);
		await expect(
			scatter.getByRole('button', { name: 'About value of knowing it first' })
		).toBeVisible();
		await expect(
			scatter.getByRole('button', { name: 'About share of profit spread' })
		).toBeVisible();
		const bounds = async (axis: 'x' | 'y') =>
			(await scatter.getAttribute(`data-${axis}-bounds`))!.split(',').map(Number);
		const [xlo, xhi] = await bounds('x');
		const [ylo, yhi] = await bounds('y');
		const data = await points.evaluateAll((els) =>
			els.map((e) => ({
				x: Number(e.getAttribute('data-x')),
				y: Number(e.getAttribute('data-y')),
				floor: e.hasAttribute('data-floor'),
				fill: getComputedStyle(e).fill,
				stroke: getComputedStyle(e).stroke
			}))
		);
		// Across: three decades under the next power of 10 above the max; up: a linear 0–100 % share
		const xmax = Math.max(...data.map((d) => d.x));
		expect(xhi).toBeGreaterThan(xmax);
		expect(xhi / 10).toBeLessThanOrEqual(xmax);
		expect(xhi / xlo).toBeCloseTo(1000, 6);
		expect([ylo, yhi]).toEqual([0, 100]);
		for (const d of data) {
			expect(d.x).toBeLessThan(xhi);
			expect(d.y).toBeGreaterThanOrEqual(0);
			expect(d.y).toBeLessThanOrEqual(100);
			// Under the log floor (or not positive): on the floor, hollow
			expect(d.floor).toBe(!(d.x >= xlo));
			if (d.floor) expect(d.fill).not.toBe(d.stroke);
			else expect(d.fill).toBe(d.stroke);
		}
		// Every point has a title; focus shows the numbers in the readout
		await expect(points.locator('title')).toHaveCount(data.length);
		await points.first().focus();
		await expect(scatter.getByTestId('scatter-readout')).toHaveText(
			/: knowing it first (saves .+|saves nothing); it explains [\d.]+ % of your profit's spread$/
		);
	});
}

test('the policy tree fill is on a log scale: red at the largest savings × share', async ({
	page
}) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	const nodes = page.getByTestId('tree-node');
	const boxes = await page.getByTestId('policy-tree').locator('text.node-text').allTextContents();
	const fills = await nodes.evaluateAll((els) =>
		els.map((e) => ({ fill: Number(e.getAttribute('data-fill')), css: e.getAttribute('fill')! }))
	);
	expect(fills.length * 2).toBe(boxes.length);
	const weighted = fills.map((_, k) => {
		const savings = Math.max(0, Number(boxes[2 * k].split(' ')[0]));
		return savings * Number(boxes[2 * k + 1].replace('%', ''));
	});
	const top = Math.max(...weighted);
	const k = weighted.indexOf(top);
	expect(fills[k].fill).toBe(1);
	expect(fills[k].css).toContain('--danger-fill) 100%');
	let tenth = 0;
	weighted.forEach((w, i) => {
		const r = w / top;
		// Two decades: a hundredth or less is green, a tenth yellow (labels are rounded)
		const want = r > 0 ? Math.min(1, Math.max(0, 1 + Math.log10(r) / 2)) : 0;
		expect(fills[i].fill).toBeCloseTo(want, 1);
		if (r > 0.05 && r < 0.2) {
			tenth++;
			expect(fills[i].fill).toBeGreaterThan(0.3);
			expect(fills[i].css).toContain('--warning-fill)');
			expect(fills[i].css).not.toMatch(/--warning-fill\) 0%/);
		}
	});
	expect(tenth).toBeGreaterThan(0);
});

/** Each maximizable plot: its title, and the element that must fill the window when maximized. */
const MAXIMIZE: [string, string][] = [
	['Policy tree', 'figure.tree'],
	['Inputs by value of information', '.inputs'],
	['Loss box plots', 'figure svg'],
	['Loss histograms', 'figure svg'],
	['Savings by number of bins', '[data-testid="voi-chart"] svg[role="img"]'],
	['Value of knowing first vs share of profit spread', '[data-testid="voi-scatter"] svg']
];

/** Opens `title` maximized, checks the plot fills the window, closes it with `how`, checks focus. */
async function maximize(page: Page, title: string, plot: string, how: 'Escape' | 'Close') {
	const button = page.getByRole('button', { name: `Maximize ${title}` });
	await button.click();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	const view = page.viewportSize()!;
	const box = (await dialog.locator(plot).first().boundingBox())!;
	expect(box.width).toBeGreaterThan(0.8 * view.width);
	if (how === 'Escape') await page.keyboard.press('Escape');
	else await dialog.getByRole('button', { name: `Close ${title}` }).click();
	await expect(dialog).toBeHidden();
	await expect(button).toBeFocused();
	return box;
}

test('each plot maximizes to fill the window; Esc and ✕ close it and focus returns', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await open(page, link(small('airline-share-buyback')));
	for (const how of ['Escape', 'Close'] as const)
		await maximize(page, 'Dataflow', '[data-testid="dataflow"]', how);
	// The maximized graph is at full size, centred; a pick there lights it up there only
	await page.getByRole('button', { name: 'Maximize Dataflow' }).click();
	const dialog = page.getByRole('dialog', { name: 'Dataflow' });
	const node = dialog.getByTestId('dataflow-node').first();
	await node.click();
	await expect(node).toHaveAttribute('aria-pressed', 'true');
	// Esc on a picked node clears the pick first, then closes
	await node.press('Escape');
	await expect(node).toHaveAttribute('aria-pressed', 'false');
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(graph(page).getByTestId('dataflow-node').first()).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await press(page, 'Run', 1);
	for (const [title, plot] of MAXIMIZE) {
		const box = await maximize(page, title, plot, 'Escape');
		// Charts grow in height too
		if (/Loss|Savings|Value/.test(title)) expect(box.height).toBeGreaterThan(0.6 * 900);
		await maximize(page, title, plot, 'Close');
	}
	// Nothing maximized stays in the page
	await expect(page.getByTestId('maximized').locator('svg')).toHaveCount(0);
});

test('maximized interactions: scatter readout and VoI legend hover', async ({ page }) => {
	await open(page, link(small('airline-share-buyback')));
	await press(page, 'Run', 1);
	await page.getByRole('button', { name: 'Maximize Value of knowing first' }).click();
	const scatter = page.getByRole('dialog').getByTestId('voi-scatter');
	await scatter.getByTestId('scatter-point').first().hover();
	await expect(scatter.getByTestId('scatter-readout')).toContainText('knowing it first');
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Maximize Savings by number of bins' }).click();
	const chart = page.getByRole('dialog').getByTestId('voi-chart');
	await chart.getByTestId('voi-key').first().hover();
	await expect(chart.locator('.series.dim')).toHaveCount(
		(await chart.getByTestId('voi-line').count()) - 1
	);
});

test('the maximize buttons wait for their pending sections', async ({ page }) => {
	await open(page, link(small('airline-share-buyback', 1_000_000)));
	// Checked every frame: the tree may be pending only briefly
	const pendingTree = page.waitForFunction(
		() => {
			const button = (name: string) =>
				document.querySelector<HTMLButtonElement>(`button[aria-label="Maximize ${name}"]`);
			return (
				!!document.querySelector('[data-testid="tree-box"] [data-testid="pending"]') &&
				button('Policy tree')?.disabled === true &&
				button('Loss box plots')?.disabled === false
			);
		},
		null,
		{ polling: 'raf', timeout: 30_000 }
	);
	await runButton(page).click();
	await pendingTree;
	await expect(page.getByTestId('run-status')).toHaveAttribute('data-done', '1', {
		timeout: 60_000
	});
	await expect(page.getByRole('button', { name: 'Maximize Policy tree' })).toBeEnabled();
});

for (const colorScheme of ['light', 'dark'] as const) {
	test(`a maximized plot has no WCAG 2.2 AA violations in ${colorScheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
		await open(page, link(small('airline-share-buyback')));
		await press(page, 'Run', 1);
		for (const [title] of MAXIMIZE) {
			await page.getByRole('button', { name: `Maximize ${title}` }).click();
			await expect(page.getByRole('dialog', { name: title })).toBeVisible();
			const { violations } = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(violations.map((v) => `${title}: ${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
			await page.keyboard.press('Escape');
		}
	});
}
