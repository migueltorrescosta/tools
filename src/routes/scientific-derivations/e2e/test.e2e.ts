import { expect, test, type Page } from '@playwright/test';
import { PAPERS } from '../../../lib/scientific-derivations';

const paper = PAPERS[0];

async function open(page: Page, query = '') {
	await page.goto(`/scientific-derivations${query}`);
	// The first visit on a cold dev server waits for Vite to optimise dagre.
	await expect(page.getByRole('main').locator('[data-hydrated]')).toBeVisible({ timeout: 15000 });
	await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '');
}

test('opens the first derivation of the first paper', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('paper')).toHaveValue(paper.id);
	await expect(page.getByTestId('derivation')).toHaveValue(paper.derivations[0].id);
	await expect(page.getByTestId('node-gksl')).toBeVisible();
});

test('every derivation of every paper lays out and renders its TeX', async ({ page }) => {
	await open(page);
	for (const derivation of PAPERS.flatMap((p) =>
		p.derivations.map((d) => ({ ...d, paper: p.id }))
	)) {
		await page.getByTestId('paper').selectOption(derivation.paper);
		await page.getByTestId('derivation').selectOption(derivation.id);
		await expect(page).toHaveURL(new RegExp(`derivation=${derivation.id}`));
		await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '');
		await expect(page.getByTestId(`node-${derivation.nodes[0].id}`)).toBeVisible();
		await expect(page.locator('.katex-error')).toHaveCount(0);
	}
});

test('the URL picks the derivation', async ({ page }) => {
	await open(page, `?paper=${paper.id}&derivation=dark-state`);
	await expect(page.getByTestId('derivation')).toHaveValue('dark-state');
	await expect(page.getByRole('heading', { name: /Dark-state cancellation/ })).toBeVisible();
});

test('a node shows its details, correction and the facts around it', async ({ page }) => {
	await open(page, '?derivation=dark-state');
	const detail = page.getByTestId('detail');
	await page.getByTestId('node-unitary').click();
	await expect(page.getByTestId('node-unitary')).toHaveAttribute('aria-pressed', 'true');
	await expect(detail).toContainText('Paper: Eqs. (13)–(14)');
	await expect(detail).toContainText('Correction.');

	// "Follows from" lists the premises and the fact used for each.
	await detail.getByRole('button', { name: 'Tune the coupling' }).click();
	await expect(page.getByTestId('node-tune')).toHaveAttribute('aria-pressed', 'true');
	await detail.getByRole('button', { name: 'set the rate to zero' }).click();
	await expect(page.getByTestId('edge-rate->tune')).toHaveAttribute('aria-pressed', 'true');
	await expect(detail).toContainText('Residual dephasing for any α');
});

test('an edge label selects the fact; clicking again clears it', async ({ page }) => {
	await open(page);
	const edge = page.getByTestId('edge-gksl->lindblad');
	await edge.click();
	await expect(page.getByTestId('detail')).toContainText('diagonalise Λ');
	await edge.click();
	await expect(page.getByTestId('detail')).toHaveCount(0);
});

test('an imported result links to the derivation it comes from', async ({ page }) => {
	await open(page, '?derivation=master-equation');
	await page.getByTestId('node-gksl-import').click();
	await page.getByRole('button', { name: /Derived in 1\./ }).click();
	await expect(page.getByTestId('derivation')).toHaveValue('gksl-from-stochastic');
	await expect(page).toHaveURL(/derivation=gksl-from-stochastic/);
});

test('fit to width shrinks a wide graph; 100% restores it', async ({ page }) => {
	await page.setViewportSize({ width: 1000, height: 900 });
	await open(page, '?derivation=dark-state');
	const canvas = page.locator('.dg-canvas');
	await expect(canvas).toHaveAttribute('style', /scale\(/);
	await page.getByText('100%').click();
	await expect(canvas).not.toHaveAttribute('style', /scale\(/);
});

test('fit to width fits the widest graph on a phone, with fact labels at least 24 px tall', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, '?derivation=dark-state');
	const graph = page.getByTestId('graph');
	const box = (await graph.boundingBox())!;
	const canvas = (await page.locator('.dg-size').boundingBox())!;
	expect(canvas.width).toBeLessThanOrEqual(box.width);
	expect(await graph.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	// At 100% the graph scrolls, and the label targets keep their full size
	await page.getByText('100%').click();
	expect(await graph.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
	await expect(page.locator('.ui-scroll-edges')).toHaveClass(/more-right/);
	const heights = await page
		.locator('.dg-label')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
	expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
});

test('the details drawer takes focus and returns it to its opener', async ({ page }) => {
	await open(page);
	const node = page.getByTestId('node-gksl');
	await node.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('complementary', { name: 'Details' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('detail')).toHaveCount(0);
	await expect(node).toBeFocused();
});

test('the details drawer closes with its button and with Escape', async ({ page }) => {
	await open(page);
	await page.getByTestId('node-gksl').click();
	await page.getByRole('button', { name: 'Close details' }).click();
	await expect(page.getByTestId('detail')).toHaveCount(0);
	await page.getByTestId('node-gksl').click();
	await expect(page.getByTestId('detail')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('detail')).toHaveCount(0);
});

test('the second paper opens with its own derivations', async ({ page }) => {
	await open(page);
	await page.getByTestId('paper').selectOption('shannon-communication');
	await expect(page.getByTestId('derivation')).toHaveValue('noiseless-capacity');
	await expect(page).toHaveURL(/paper=shannon-communication/);
	await expect(page.getByTestId('node-telegraph')).toBeVisible();
});
