import { expect, test, type Page } from '@playwright/test';
import { CONTEXTS } from '../../../lib/institutions';

async function open(page: Page, query = '') {
	await page.goto(`/institutions${query}`);
	// The first visit on a cold dev server waits for Vite to optimise ELK.
	await expect(page.getByRole('main').locator('[data-hydrated]')).toBeVisible({ timeout: 15000 });
	await laidOut(page);
}

/** A 70-box map takes seconds to lay out on a slow runner. */
async function laidOut(page: Page) {
	await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '', { timeout: 15000 });
}

test('opens the first part of the first context', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('context')).toHaveValue(CONTEXTS[0].id);
	await expect(page.getByTestId('part')).toHaveValue(CONTEXTS[0].parts[0].id);
	await expect(page.getByTestId('node-european-commission')).toBeVisible();
	// Only the part is drawn.
	await expect(page.getByTestId('node-unesco')).toHaveCount(0);
});

test('every part and every situation lays out', async ({ page }) => {
	await open(page);
	for (const context of CONTEXTS) {
		await page.getByTestId('context').selectOption(context.id);
		await expect(page).toHaveURL(new RegExp(`context=${context.id}`));
		for (const part of context.parts) {
			await page.getByTestId('part').selectOption(part.id);
			await expect(page).toHaveURL(new RegExp(`part=${part.id}`));
			await laidOut(page);
			await expect(page.getByTestId(`node-${part.ids[0]}`)).toBeVisible();
		}
		for (const route of context.routes) {
			await page.getByTestId('route').selectOption(route.id);
			await laidOut(page);
			await expect(page.getByTestId('steps').getByRole('listitem')).toHaveCount(route.steps.length);
			for (const step of route.steps)
				await expect(page.getByTestId(`node-${step.id}`)).toBeVisible();
		}
	}
});

test('the whole map is still on offer', async ({ page }) => {
	await open(page, '?context=ai-industry&part=all');
	await expect(page.getByTestId('part')).toHaveValue('');
	await expect(page.getByTestId('node-asml')).toBeVisible();
	await expect(page.getByTestId('node-frontier-model-forum')).toBeVisible();
});

test('a situation opens its part and lights its institutions', async ({ page }) => {
	await open(page, '?context=portugal&route=lost-job');
	await expect(page.getByTestId('route')).toHaveValue('lost-job');
	await expect(page.getByTestId('part')).toHaveValue('work');
	await expect(page.getByTestId('node-iefp')).not.toHaveClass(/dim/);
	await expect(page.getByTestId('node-igfss')).toHaveClass(/dim/);
	// Its relations carry labels without a selection.
	await expect(page.getByTestId('edge-iefp-partners-iss')).toBeVisible();
});

test('a node shows its details, and links to its relations and overlaps', async ({ page }) => {
	await open(page, '?context=portugal&part=work');
	await page.getByTestId('node-iefp').click();
	await expect(page.getByTestId('node-iefp')).toHaveAttribute('aria-pressed', 'true');
	const detail = page.getByTestId('detail');
	await expect(detail).toContainText('Instituto do Emprego e Formação Profissional');
	await expect(detail.getByRole('heading', { name: 'Responsibilities' })).toBeVisible();
	await expect(detail.getByRole('heading', { name: 'Sources' })).toBeVisible();

	// An overlap selects the other institution.
	await detail.getByRole('button', { name: 'ISS', exact: true }).first().click();
	await expect(page.getByTestId('node-iss')).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');
	await expect(detail).toHaveCount(0);
});

test('a link to a body outside the part moves to a part that holds it', async ({ page }) => {
	await open(page, '?context=portugal&part=work');
	await page.getByTestId('node-aima').click();
	await page
		.getByTestId('detail')
		.getByRole('button', { name: 'UNEF', exact: true })
		.first()
		.click();
	await expect(page.getByTestId('part')).toHaveValue('borders');
	await laidOut(page);
	await expect(page.getByTestId('node-psp-unef')).toHaveAttribute('aria-pressed', 'true');
});

test('a shared institution switches context', async ({ page }) => {
	await open(page, '?context=ai-industry&part=governments');
	await page.getByTestId('node-european-commission').click();
	await page.getByTestId('detail').getByRole('button', { name: 'EU and international' }).click();
	await expect(page.getByTestId('context')).toHaveValue('eu-international');
	await expect(page.getByTestId('node-european-commission')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('a relation family can be hidden', async ({ page }) => {
	await open(page, '?context=portugal&route=lost-job');
	const family = page.getByTestId('family-ties');
	await family.click();
	await expect(family).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByTestId('edge-iefp-partners-iss')).toHaveCount(0);
});

test('a kind of institution hides in place, without a new layout', async ({ page }) => {
	await open(page, '?context=portugal&part=justice');
	const at = await page.getByTestId('node-at').boundingBox();
	const kind = page.getByTestId('kind-court');
	await kind.click();
	await expect(kind).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByTestId('node-constitutional-court')).toBeHidden();
	expect(await page.getByTestId('node-at').boundingBox()).toEqual(at);
	await kind.click();
	await expect(page.getByTestId('node-constitutional-court')).toBeVisible();
});
