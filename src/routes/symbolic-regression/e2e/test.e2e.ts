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

/** Load one of the example datasets under the file picker. */
async function loadExample(page: Page, name: RegExp) {
	await page.getByTestId('examples').getByRole('button', { name }).click();
}

/** Open the Run box's Advanced line, which holds the run settings. */
async function openAdvanced(page: Page) {
	const advanced = page.locator('details.ui-run-advanced');
	if ((await advanced.getAttribute('open')) === null) await advanced.locator('summary').click();
}

/** Show every equation in the list, not only the simplest, best and most accurate. */
async function showAllEquations(page: Page) {
	const button = page.getByTestId('show-all');
	if ((await button.count()) > 0 && /Show all/.test((await button.textContent()) ?? ''))
		await button.click();
}

/** The selected equation as text. */
async function selectedText(page: Page): Promise<string> {
	return (await page.getByTestId('equation').getAttribute('data-equation')) ?? '';
}

/** The equation list's rows (one button each). */
function frontRows(page: Page) {
	return page.getByTestId('front').getByRole('listitem');
}

/** How many equations the front holds: one Pareto point each. */
function frontSize(page: Page) {
	return page.getByTestId('pareto-plot').getByRole('button').count();
}

/** The plot point of a complexity. */
function point(page: Page, complexity: string | null) {
	return page.getByTestId('pareto-plot').locator(`[data-complexity="${complexity}"]`);
}

/** Validation R² of the recommended front entry. */
async function bestR2(page: Page): Promise<number> {
	const best = page.getByTestId('pareto-plot').getByRole('button', { name: /\(best\)/ });
	if ((await best.count()) === 0) return -Infinity;
	return Number(await best.getAttribute('data-r2'));
}

/** Every front entry as its text equation and validation R². */
async function frontEquations(page: Page): Promise<{ text: string; r2: number }[]> {
	await showAllEquations(page);
	const out: { text: string; r2: number }[] = [];
	for (const row of await frontRows(page).getByRole('button').all()) {
		const complexity = await row.getAttribute('data-complexity');
		const r2 = Number(await point(page, complexity).getAttribute('data-r2'));
		out.push({ text: (await row.getAttribute('data-equation')) ?? '', r2 });
	}
	return out;
}

/** True when some front row is c·a^1.5 (or a·sqrt(a)) with validation R² > 0.999. */
async function frontHasKeplerLaw(page: Page): Promise<boolean> {
	for (const { text, r2 } of await frontEquations(page)) {
		const exponent = text.match(/^(?:[\d.]+ \* )?a_AU\^([\d.]+)$/)?.[1];
		const powLaw = exponent !== undefined && Math.abs(Number(exponent) - 1.5) < 0.01;
		const sqrtLaw = /^(?:[\d.]+ \* )?(?:a_AU \* sqrt\(a_AU\)|sqrt\(a_AU\) \* a_AU)$/.test(text);
		if ((powLaw || sqrtLaw) && r2 > 0.999) return true;
	}
	return false;
}

/** One mode radio (Exclude, Include, Categorical) of an input column. */
function mode(page: Page, column: string, label: 'Exclude' | 'Include' | 'Categorical') {
	return page
		.getByTestId('inputs')
		.locator(`[data-column="${column}"]`)
		.getByRole('radio', { name: label, exact: true });
}

/** The share link the copy button carries. */
async function shareUrl(page: Page): Promise<string> {
	return (await page.getByTestId('copy-link').getAttribute('data-url')) ?? '';
}

/** Run a search and wait until the front has `rows` rows. */
async function runUntilFront(page: Page, rows = 2) {
	await page.getByRole('button', { name: 'Run', exact: true }).click();
	await expect.poll(() => frontSize(page), { timeout: 15000 }).toBeGreaterThanOrEqual(rows);
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
	await loadExample(page, /Kepler/);
	await expect(page.getByTestId('target')).toHaveValue(/\d+/);
	await page.getByRole('button', { name: 'Run', exact: true }).click();
	await expect.poll(() => frontHasKeplerLaw(page), { timeout: 20000 }).toBe(true);
	await stopSearch(page);
});

test('noisy Newton example reaches validation R² > 0.95 within 30 s', async ({ page }) => {
	test.setTimeout(60000);
	await open(page);
	await loadExample(page, /Newton/);
	await page.getByRole('button', { name: 'Run', exact: true }).click();
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

test('upload by file picker: column modes, text columns categorical and dropped rows', async ({
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
	await expect(mode(page, 'x', 'Include')).toBeChecked();
	await expect(mode(page, 'name', 'Include')).toBeDisabled();
	await expect(mode(page, 'name', 'Categorical')).toBeChecked();
	await expect(mode(page, 'note; with delimiter', 'Categorical')).toBeChecked();
	// Categorical inputs never drop a row; the missing x does
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
	await expect(mode(page, 'p', 'Include')).toBeChecked();
	await expect(mode(page, 'q', 'Include')).toBeChecked();

	await page.getByTestId('target').selectOption({ label: 'p' });
	await expect(mode(page, 'p', 'Include')).toHaveCount(0);
	await mode(page, 'q', 'Categorical').check();
	await expect(mode(page, 'r', 'Include')).toBeChecked();
	await expect.poll(() => shareUrl(page)).toMatch(/target=p/);
	expect(await shareUrl(page)).toMatch(/in=r/);
	expect(await shareUrl(page)).toMatch(/cat=q/);
	await mode(page, 'q', 'Exclude').check();
	await expect.poll(() => shareUrl(page)).not.toMatch(/[?&](in|cat)=q/);
});

test('categorical columns: level warnings, the limit, and an indicator in the front', async ({
	page
}) => {
	test.setTimeout(60000);
	await open(page);
	const twelve = Array.from({ length: 24 }, (_, i) => `${i},g${i % 12},h${i},${i * 2}`);
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'levels.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(
			['x,g,h,y', ...twelve, ...twelve.map((l) => l.replace(/h\d+/, (h) => h + 'b'))].join('\n')
		)
	});
	await expect(mode(page, 'g', 'Categorical')).toBeChecked();
	await expect(page.locator('[data-column="g"]').getByTestId('levels-warning')).toContainText(
		'12 categories'
	);
	// 48 distinct values: over the limit, so excluded and not selectable as categorical
	await expect(mode(page, 'h', 'Exclude')).toBeChecked();
	await expect(mode(page, 'h', 'Categorical')).toBeDisabled();

	await loadExample(page, /Parcel prices/);
	await expect(mode(page, 'zone', 'Categorical')).toBeChecked();
	await expect(mode(page, 'carrier', 'Categorical')).toBeChecked();
	await page.getByRole('button', { name: 'Run', exact: true }).click();
	await expect
		.poll(
			async () =>
				(await frontEquations(page)).some(
					// The search may find the indicator or its complement
					({ text, r2 }) =>
						/1\[zone ∈ \{(island, remote|city, rural, suburb)\}\]/.test(text) && r2 > 0.99
				),
			{ timeout: 30000 }
		)
		.toBe(true);
	await stopSearch(page);
	expect(await shareUrl(page)).toMatch(/cat=zone/);
});

test('Stop and Continue resume the search', async ({ page }) => {
	await open(page);
	await loadExample(page, /Newton/);
	await runUntilFront(page);
	// One main button: Run turns into Stop while running
	await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
	await stopSearch(page);
	await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
	const progress = page.getByTestId('progress');
	const before = Number((await progress.textContent())?.match(/(\d+) iterations/)?.[1]);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('button', { name: 'Stop' })).toBeEnabled();
	await expect
		.poll(async () => Number((await progress.textContent())?.match(/(\d+) iterations/)?.[1]))
		.toBeGreaterThan(before);
	await stopSearch(page);
});

test('the front plot: integer complexity ticks, hover tooltips, and How it works', async ({
	page
}) => {
	await open(page);
	await loadExample(page, /Kepler/);
	await runUntilFront(page, 3);
	await stopSearch(page);

	const plot = page.getByTestId('pareto-plot');
	const ticks = await plot.locator('.grid text[text-anchor="middle"]').allTextContents();
	expect(ticks.length).toBeGreaterThan(1);
	for (const t of ticks) expect(Number.isInteger(Number(t)), t).toBe(true);
	// The R² axis has one tick per nine (log scale of 1 − R²)
	const yTicks = await plot.locator('.grid text[text-anchor="end"]').allTextContents();
	expect(yTicks.slice(0, 3)).toEqual(['0', '0.9', '0.99']);
	for (const t of yTicks) expect(t).toMatch(/^0(\.9+)?$/);
	// Points sit at their complexity, not their rank
	await showAllEquations(page);
	const complexities = await plot
		.getByRole('button')
		.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-complexity'))));
	const rowComplexities = await frontRows(page)
		.getByRole('button')
		.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-complexity'))));
	expect(complexities).toEqual(rowComplexities);

	const first = plot.getByRole('button').first();
	await first.hover();
	const tip = page.getByTestId('front-tooltip');
	await expect(tip).toBeVisible();
	await expect(tip).toContainText('Validation R²');
	await expect(tip).toContainText('Train MSE');
	await expect(tip.locator('.katex-html')).toBeVisible();

	// No (i) icons: the explanations sit in How it works
	await expect(page.getByRole('button', { name: /^About / })).toHaveCount(0);
	const how = page.getByTestId('how');
	await how.locator('summary').click();
	await expect(how).toContainText('Nodes in the expression tree');
	await expect(how).toContainText('Everything runs in your browser');
});

test('the result shows two metrics and three equations; the rest fold', async ({ page }) => {
	await open(page);
	await loadExample(page, /Kepler/);
	await runUntilFront(page, 5);
	await stopSearch(page);

	const metrics = page.getByTestId('metrics');
	await expect(metrics.locator('dt')).toHaveText(['Complexity', 'Validation R²']);
	const more = page.getByTestId('more-metrics');
	await expect(more).not.toHaveAttribute('open');
	await more.locator('summary').click();
	await expect(more).toContainText('Validation RMSE');
	await expect(more).toContainText('Score');

	const total = await frontSize(page);
	const chips = page.getByTestId('front').getByRole('button');
	// The simplest, the best and the most accurate (fewer when they coincide)
	const shown = await chips.count();
	expect(shown).toBeLessThanOrEqual(3);
	expect(shown).toBeLessThan(total);
	await expect(chips.first()).toHaveAttribute('data-complexity', '1');
	await expect(page.getByTestId('front').getByTestId('best')).toHaveCount(1);
	await page.getByRole('button', { name: `Show all ${total} equations` }).click();
	await expect(chips).toHaveCount(total);
	await page.getByRole('button', { name: 'Show fewer' }).click();
	await expect(chips).toHaveCount(shown);
});

test('clicking a Pareto point selects that equation; Copy copies each format', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page);
	await loadExample(page, /Kepler/);
	await runUntilFront(page, 3);
	await stopSearch(page);

	const first = page.getByTestId('pareto-plot').getByRole('button').first();
	await first.click();
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	// The selected equation is always in the list
	const row = frontRows(page).filter({
		has: page.locator(`[data-complexity="${await first.getAttribute('data-complexity')}"]`)
	});
	await expect(row.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('front').getByRole('button', { pressed: true })).toHaveCount(1);
	const text = (await row.getByRole('button').getAttribute('data-equation')) ?? '';
	await expect(page.getByTestId('equation')).toHaveAttribute('data-equation', text);
	await expect(page.getByTestId('equation').locator('.katex-html')).toBeVisible();

	// Select a row that uses a_AU so every format names it
	await frontRows(page)
		.getByRole('button')
		.and(page.locator('[data-equation*="a_AU"]'))
		.last()
		.click();
	const clip = () => page.evaluate(() => navigator.clipboard.readText());
	const format = page.getByLabel('Copy format');
	const copyButton = page.getByRole('button', { name: 'Copy', exact: true });
	await expect(format.locator('option:checked')).toHaveText('as text');
	await copyButton.click();
	await expect.poll(clip).toBe(await selectedText(page));
	await expect(page.getByTestId('copied')).toHaveText('Copied as text');
	await format.selectOption({ label: 'as LaTeX' });
	await copyButton.click();
	await expect.poll(clip).toContain('\\mathrm{a\\_AU}');
	await format.selectOption({ label: 'as Python' });
	await copyButton.click();
	await expect.poll(clip).toMatch(/a_AU/);
	await format.selectOption({ label: 'as JavaScript' });
	await copyButton.click();
	await expect.poll(clip).toMatch(/a_AU/);
	await expect(page.getByTestId('copied')).toHaveText('Copied as JavaScript');
	// The copied JS evaluates to the predictions' scale at a = 1 AU, T ≈ 1 year
	const js = await clip();
	// Evaluated here, not in the page: the page's CSP has no 'unsafe-eval'
	const atEarth = new Function('a_AU', `return ${js};`)(1) as number;
	expect(atEarth).toBeGreaterThan(0);
});

test('example datasets show as buttons and a loaded one is labelled', async ({ page }) => {
	await open(page);
	const examples = page.getByTestId('examples');
	await expect(examples).toContainText('No CSV? Try an example:');
	await expect(examples.getByRole('button')).toHaveText([
		"Kepler's third law",
		"Newton's gravity (noisy)",
		'Parcel prices (categorical)'
	]);
	await loadExample(page, /Kepler/);
	await expect(page.getByTestId('data-status')).toContainText("Example dataset Kepler's third law");
	await expect(examples.getByRole('button')).toHaveCount(3);
});

test('run settings sit behind one Advanced line that names their values', async ({ page }) => {
	await open(page);
	const advanced = page.locator('details.ui-run-advanced');
	await expect(advanced).not.toHaveAttribute('open');
	await expect(page.getByLabel('Seed')).toBeHidden();
	await expect(advanced.locator('summary')).toContainText('seed 1');
	await expect(advanced.locator('summary')).toContainText('% validation');
	await openAdvanced(page);
	for (const label of ['Time budget (s)', 'Seed', 'Workers', 'Validation (%)'])
		await expect(page.getByLabel(label, { exact: true })).toBeVisible();
	await page.getByLabel('Seed').fill('7');
	await expect(advanced.locator('summary')).toContainText('seed 7');

	// No operators: Run is disabled and the reason sits under the operators
	await loadExample(page, /Kepler/);
	for (const box of await page.getByRole('checkbox', { name: /^Operator / }).all())
		await box.uncheck();
	await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled();
	await expect(page.locator('#operators-error')).toHaveText(/Pick at least one operator/);
});

test('hovering an equation previews it in every plot; leaving restores the selection', async ({
	page
}) => {
	await open(page);
	await loadExample(page, /Kepler/);
	await runUntilFront(page, 3);
	await stopSearch(page);

	const plots = page.getByTestId('plots');
	// Only the three plots, no residuals
	await expect(plots.locator('figure')).toHaveCount(3);
	await expect(plots).not.toContainText('Residuals');

	const selected = page.getByTestId('front').getByRole('button', { pressed: true });
	const selectedComplexity = await selected.getAttribute('data-complexity');
	const predicted = page.getByTestId('predicted-plot').locator('circle');
	const before = await predicted.evaluateAll((els) => els.map((e) => e.getAttribute('cy')));
	const other = page
		.getByTestId('front')
		.getByRole('button', { pressed: false })
		.and(page.locator('[data-complexity="1"]'));
	await other.hover();
	await expect(page.getByTestId('plots-for')).toHaveText('Complexity 1 (preview)');
	await expect(page.getByTestId('chip-tooltip')).toContainText('Validation RMSE');
	await expect
		.poll(() => predicted.evaluateAll((els) => els.map((e) => e.getAttribute('cy'))))
		.not.toEqual(before);
	// The header keeps the selected equation
	await expect(selected).toHaveAttribute('data-complexity', selectedComplexity!);

	await page.getByTestId('equation').hover();
	await expect(page.getByTestId('plots-for')).toHaveText(`Complexity ${selectedComplexity}`);
	await expect
		.poll(() => predicted.evaluateAll((els) => els.map((e) => e.getAttribute('cy'))))
		.toEqual(before);

	// A Pareto point previews too
	await page.getByTestId('pareto-plot').locator('[data-complexity="1"]').hover();
	await expect(page.getByTestId('plots-for')).toHaveText('Complexity 1 (preview)');
});

test('Download CSV adds the selected equation and the split to every row', async ({ page }) => {
	await open(page);
	await page.getByLabel('Choose a CSV file').setInputFiles({
		name: 'line.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(
			['x,y', ...Array.from({ length: 20 }, (_, i) => `${i},${2 * i + 1}`), ',5'].join('\n')
		)
	});
	await runUntilFront(page, 2);
	await stopSearch(page);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download CSV' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('line-predicted.csv');
	const lines = (await (await file.createReadStream()).toArray()).join('').trim().split('\n');
	expect(lines[0]).toBe('x,y,y_predicted,split');
	expect(lines).toHaveLength(22);
	expect(lines[21]).toBe(',5,,dropped');
	const splits = lines.slice(1, 21).map((l) => l.split(',')[3]);
	expect(splits).toContain('validation');
	expect(splits).toContain('train');
	const text = await selectedText(page);
	for (const line of lines.slice(1, 21)) {
		const [x, , pred] = line.split(',').map(Number);
		const expected = new Function('x', `return ${text.replaceAll('^', '**')};`)(x) as number;
		expect(pred).toBeCloseTo(expected, 3);
	}
});

test('share URL restores settings and the example, and never carries data', async ({
	page,
	context
}) => {
	await open(page);
	await loadExample(page, /Kepler/);
	await openAdvanced(page);
	await page.getByLabel('Seed').fill('42');
	await page.getByLabel('Time budget (s)').fill('15');
	await page.getByRole('checkbox', { name: 'Operator cos' }).check();
	await expect.poll(() => shareUrl(page)).toContain('seed=42');
	const url = await shareUrl(page);
	expect(url).toContain('example=kepler');
	expect(url).toContain('seed=42');
	expect(url).not.toContain('Mercury');

	const other = await context.newPage();
	await other.goto(url);
	await expect(hydrated(other)).toBeVisible();
	await expect(other.getByTestId('data-status')).toContainText('rows');
	await openAdvanced(other);
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
	await expect(mode(page, 'x2', 'Include')).toBeChecked();
	await expect(mode(page, 'x1', 'Exclude')).toBeChecked();
	await expect(mode(page, 'z', 'Exclude')).toBeChecked();
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
	await openAdvanced(page);
	await page.getByLabel('Seed').fill('9');
	await expect.poll(() => savedKeys(page)).toContain(`${PREFIX}dataset`);

	await open(page);
	await expect(page.getByTestId('data-status')).toContainText('saved.csv');
	await expect(page.getByLabel('Seed')).toHaveValue('9');

	// The first click asks for confirmation
	await page.getByRole('button', { name: 'Clear saved data' }).click();
	expect(await savedKeys(page)).not.toEqual([]);
	await page.getByRole('button', { name: 'Confirm: clear saved data' }).click();
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
	await mode(page, 'c5', 'Exclude').check();
	await expect(mode(page, 'c5', 'Exclude')).toBeChecked();
	await runUntilFront(page, 1);
	await stopSearch(page);
});

test('three boxes: Run holds the data, How it works closes the last box', async ({ page }) => {
	await open(page);
	const boxes = page.getByRole('main').locator('.ui-panel');
	// Before a run: Run (with the data) and Results; How it works ends Results
	await expect(boxes).toHaveCount(2);
	await expect(boxes.first().getByTestId('data')).toBeVisible();
	await expect(boxes.last().getByTestId('how')).toBeVisible();

	await loadExample(page, /Kepler/);
	await runUntilFront(page, 2);
	await stopSearch(page);
	// After a run: the Plots box joins, and How it works moves to its end
	await expect(boxes).toHaveCount(3);
	await expect(page.getByTestId('plots').locator('.ui-panel')).toContainText('Complexity');
	await expect(page.getByTestId('plots').getByTestId('how')).toBeVisible();
	await expect(page.getByTestId('how')).toHaveCount(1);
});

test('equation size variant: 1.75× scales the equations and nothing overflows on a phone', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem('proto2', JSON.stringify({ sreq: 's175' })));
	await open(page);
	await loadExample(page, /Kepler/);
	await runUntilFront(page, 2);
	await stopSearch(page);

	const equation = page.getByTestId('equation');
	await expect(equation.locator('.katex-html')).toBeVisible();
	const [size, base] = await equation.evaluate((el) => {
		const probe = document.createElement('span');
		probe.style.fontSize = 'var(--text-xl)';
		document.body.append(probe);
		const px = parseFloat(getComputedStyle(probe).fontSize);
		probe.remove();
		return [parseFloat(getComputedStyle(el).fontSize), px];
	});
	expect(size).toBeCloseTo(base * 1.75, 1);
	await expect(frontRows(page).first().getByTestId('row-equation')).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
