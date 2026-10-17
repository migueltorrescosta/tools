import { expect, test, type Page } from '@playwright/test';

const PREFIX = 'symbolic-regression:';

/** The page container (not the top bar) sets data-hydrated once the router is ready. */
function hydrated(page: Page) {
	return page.getByRole('main').locator('[data-hydrated]');
}

async function open(page: Page, query = '') {
	await page.goto(`/symbolic-regression${query}`);
	await expect(hydrated(page)).toBeVisible();
}

/** The Pareto front's body rows. */
function frontRows(page: Page) {
	return page.getByTestId('front').locator('tbody').getByRole('row');
}

/** Validation R² of the recommended (highlighted) front row. */
async function bestR2(page: Page): Promise<number> {
	const cell = frontRows(page)
		.filter({ has: page.getByTestId('best') })
		.getByTestId('r2');
	if ((await cell.count()) === 0) return -Infinity;
	return Number(await cell.textContent());
}

/** True when some front row is c·a^1.5 (or a·sqrt(a)) with validation R² > 0.999. */
async function frontHasKeplerLaw(page: Page): Promise<boolean> {
	const rows = frontRows(page);
	for (const row of await rows.all()) {
		const text = (await row.getByTestId('row-equation').textContent()) ?? '';
		const r2 = Number(await row.getByTestId('r2').textContent());
		const exponent = text.match(/^(?:[\d.]+ \* )?a_AU\^([\d.]+)$/)?.[1];
		const powLaw = exponent !== undefined && Math.abs(Number(exponent) - 1.5) < 0.01;
		const sqrtLaw = /^(?:[\d.]+ \* )?(?:a_AU \* sqrt\(a_AU\)|sqrt\(a_AU\) \* a_AU)$/.test(text);
		if ((powLaw || sqrtLaw) && r2 > 0.999) return true;
	}
	return false;
}

/** An input-column checkbox (operators are checkboxes too). */
function inputBox(page: Page, name: string) {
	return page.getByTestId('inputs').getByRole('checkbox', { name, exact: true });
}

/** Start a search and wait until the front has `rows` rows. */
async function runUntilFront(page: Page, rows = 2) {
	await page.getByRole('button', { name: 'Start' }).click();
	await expect.poll(() => frontRows(page).count(), { timeout: 15000 }).toBeGreaterThanOrEqual(rows);
}

async function stopSearch(page: Page) {
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 10000 });
}

async function savedKeys(page: Page): Promise<string[]> {
	return page.evaluate(
		(prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)),
		PREFIX
	);
}

test('Kepler example finds c·a^1.5 with validation R² > 0.999 within 20 s', async ({ page }) => {
	test.setTimeout(60000);
	await open(page);
	await page.getByRole('button', { name: /Kepler/ }).click();
	await expect(page.getByTestId('target')).toHaveValue(/\d+/);
	await page.getByRole('button', { name: 'Start' }).click();
	await expect.poll(() => frontHasKeplerLaw(page), { timeout: 20000 }).toBe(true);
	await stopSearch(page);
});

test('noisy Newton example reaches validation R² > 0.95 within 30 s', async ({ page }) => {
	test.setTimeout(60000);
	await open(page);
	await page.getByRole('button', { name: /Newton/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect.poll(() => bestR2(page), { timeout: 30000 }).toBeGreaterThan(0.95);
	await stopSearch(page);
});

const MESSY_CSV = [
	'name;x;"note; with delimiter";y',
	'a;1;"multi',
	'line";2',
	'b;2;plain;4',
	'c;;missing x;6',
	'd;3;ok;6',
	'e;4;ok;8'
].join('\n');

test('upload by file picker: columns, disabled non-numeric columns and dropped rows', async ({
	page
}) => {
	await open(page);
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'messy.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(MESSY_CSV)
	});
	await expect(page.getByTestId('data-status')).toContainText('messy.csv: 5 rows, 4 columns');
	// The last numeric column is the default target; x is the default input
	await expect(page.getByTestId('target').locator('option:checked')).toHaveText('y');
	await expect(inputBox(page, 'x')).toBeChecked();
	await expect(inputBox(page, 'name')).toBeDisabled();
	await expect(inputBox(page, 'note; with delimiter')).toBeDisabled();
	await expect(page.getByTestId('dropped')).toContainText('1 row dropped');
	await expect(page.getByTestId('dropped')).toContainText('4 used');
});

test('upload by drag and drop, then pick another target and inputs', async ({ page }) => {
	await open(page);
	const csv = 'p\tq\tr\n1\t2\t3\n4\t5\t6\n7\t8\t9\n';
	const transfer = await page.evaluateHandle((text) => {
		const dt = new DataTransfer();
		dt.items.add(new File([text], 'drop.tsv', { type: 'text/tab-separated-values' }));
		return dt;
	}, csv);
	await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer: transfer });
	await expect(page.getByTestId('data-status')).toContainText('drop.tsv: 3 rows, 3 columns');
	await expect(inputBox(page, 'p')).toBeChecked();
	await expect(inputBox(page, 'q')).toBeChecked();

	await page.getByTestId('target').selectOption({ label: 'p' });
	await expect(inputBox(page, 'p')).toHaveCount(0);
	await inputBox(page, 'q').uncheck();
	await expect(inputBox(page, 'r')).toBeChecked();
	await expect(page.getByTestId('share-url')).toHaveValue(/target=p/);
	await expect(page.getByTestId('share-url')).toHaveValue(/in=r/);
	await expect(page.getByTestId('share-url')).not.toHaveValue(/in=q/);
});

test('Stop and Continue resume the search', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: /Newton/ }).click();
	await runUntilFront(page);
	await stopSearch(page);
	const progress = page.getByTestId('progress');
	const before = Number((await progress.textContent())?.match(/(\d+) iterations/)?.[1]);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('button', { name: 'Stop' })).toBeEnabled();
	await expect
		.poll(async () => Number((await progress.textContent())?.match(/(\d+) iterations/)?.[1]))
		.toBeGreaterThan(before);
	await stopSearch(page);
});

test('clicking a Pareto point selects that equation; copy buttons copy each format', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page);
	await page.getByRole('button', { name: /Kepler/ }).click();
	await runUntilFront(page, 3);
	await stopSearch(page);

	const first = page.getByTestId('pareto-plot').getByRole('button').first();
	const id = Number(await first.getAttribute('data-id'));
	await first.click();
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	const row = frontRows(page).nth(id);
	await expect(row.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('front').getByRole('button', { pressed: true })).toHaveCount(1);
	const text = (await row.getByTestId('row-equation').textContent()) ?? '';
	await expect(page.getByTestId('equation-text')).toHaveText(text);
	await expect(page.getByTestId('equation').locator('math')).toBeVisible();

	// Select a row that uses a_AU so every format names it
	await frontRows(page).filter({ hasText: 'a_AU' }).last().click();
	const clip = () => page.evaluate(() => navigator.clipboard.readText());
	await page.getByRole('button', { name: 'Text', exact: true }).click();
	await expect.poll(clip).toBe(await page.getByTestId('equation-text').textContent());
	await page.getByRole('button', { name: 'LaTeX' }).click();
	await expect.poll(clip).toContain('\\mathrm{a\\_AU}');
	await page.getByRole('button', { name: 'Python' }).click();
	await expect.poll(clip).toMatch(/a_AU/);
	await page.getByRole('button', { name: 'JavaScript' }).click();
	await expect.poll(clip).toMatch(/a_AU/);
	// The copied JS evaluates to the predictions' scale at a = 1 AU, T ≈ 1 year
	const js = await clip();
	const atEarth = await page.evaluate(
		(code) => new Function('a_AU', `return ${code};`)(1) as number,
		js
	);
	expect(atEarth).toBeGreaterThan(0);
});

test('share URL restores settings and the example, and never carries data', async ({
	page,
	context
}) => {
	await open(page);
	await page.getByRole('button', { name: /Kepler/ }).click();
	await page.getByLabel('Seed').fill('42');
	await page.getByLabel('Time budget (s)').fill('15');
	await page.getByRole('checkbox', { name: 'Operator cos' }).check();
	const url = await page.getByTestId('share-url').inputValue();
	expect(url).toContain('example=kepler');
	expect(url).toContain('seed=42');
	expect(url).not.toContain('Mercury');

	const other = await context.newPage();
	await other.goto(url);
	await expect(hydrated(other)).toBeVisible();
	await expect(other.getByTestId('data-status')).toContainText('rows');
	await expect(other.getByLabel('Seed')).toHaveValue('42');
	await expect(other.getByLabel('Time budget (s)')).toHaveValue('15');
	await expect(other.getByRole('checkbox', { name: 'Operator cos' })).toBeChecked();
	await expect(other.getByTestId('target').locator('option:checked')).toHaveText('T_years');
});

test('share URL column settings apply to a user CSV only where names match', async ({ page }) => {
	await open(page, '?target=y&in=x2&in=missing&seed=3');
	await expect(page.getByLabel('Seed')).toHaveValue('3');
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'mine.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('x1,x2,y,z\n1,2,3,4\n2,3,4,5\n3,4,5,6\n')
	});
	await expect(page.getByTestId('target').locator('option:checked')).toHaveText('y');
	await expect(inputBox(page, 'x2')).toBeChecked();
	await expect(inputBox(page, 'x1')).not.toBeChecked();
	await expect(inputBox(page, 'z')).not.toBeChecked();
});

test('saved data survives a reload; Clear saved data removes it and resets the page', async ({
	page
}) => {
	await open(page);
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'saved.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('u,v\n1,2\n2,4\n3,6\n')
	});
	await page.getByLabel('Seed').fill('9');
	await expect.poll(() => savedKeys(page)).toContain(`${PREFIX}dataset`);

	await open(page);
	await expect(page.getByTestId('data-status')).toContainText('saved.csv');
	await expect(page.getByLabel('Seed')).toHaveValue('9');

	await page.getByRole('button', { name: 'Clear saved data' }).click();
	await expect(page).toHaveURL(/\/symbolic-regression$/);
	await expect(hydrated(page)).toBeVisible();
	await expect(page.getByTestId('data-status')).toHaveCount(0);
	await expect(page.getByLabel('Seed')).toHaveValue('1');
	expect(await savedKeys(page)).toEqual([]);
});

test('50,000 rows × 20 columns load, stay responsive and search', async ({ page }) => {
	test.setTimeout(90000);
	const header = Array.from({ length: 20 }, (_, j) => `c${j}`).join(',');
	const lines = [header];
	for (let i = 0; i < 50000; i++) {
		const row: number[] = [];
		for (let j = 0; j < 19; j++) row.push(((i * (j + 7)) % 997) / 100);
		row.push(row[0] * 2 + row[1]);
		lines.push(row.join(','));
	}
	await open(page);
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'big.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(lines.join('\n'))
	});
	await expect(page.getByTestId('data-status')).toContainText('50000 rows, 20 columns', {
		timeout: 15000
	});
	await expect(page.getByTestId('not-saved')).toBeVisible();
	await inputBox(page, 'c5').uncheck();
	await expect(inputBox(page, 'c5')).not.toBeChecked();
	await runUntilFront(page, 1);
	await stopSearch(page);
});
