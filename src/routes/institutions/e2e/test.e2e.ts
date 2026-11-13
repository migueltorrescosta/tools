import { expect, test, type Page } from '@playwright/test';
import { CONTEXTS } from '../../../lib/institutions';

async function open(page: Page, query = '') {
	await page.goto(`/institutions${query}`);
	// The first visit on a cold dev server waits for Vite to optimise ELK.
	await expect(page.getByRole('main').locator('[data-hydrated]')).toBeVisible({ timeout: 15000 });
	await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '', { timeout: 15000 });
}

test('opens the first context', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('context')).toHaveValue(CONTEXTS[0].id);
	await expect(page.getByTestId('node-european-commission')).toBeVisible();
});

test('every context and every situation lays out', async ({ page }) => {
	await open(page);
	for (const context of CONTEXTS) {
		await page.getByTestId('context').selectOption(context.id);
		await expect(page).toHaveURL(new RegExp(`context=${context.id}`));
		await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '');
		await expect(page.getByTestId(`node-${context.institutions[0].id}`)).toBeVisible();
		for (const route of context.routes) {
			await page.getByTestId('route').selectOption(route.id);
			await expect(page.getByTestId('graph')).toHaveAttribute('data-ready', '');
			await expect(page.getByTestId('steps').getByRole('listitem')).toHaveCount(route.steps.length);
			for (const step of route.steps)
				await expect(page.getByTestId(`node-${step.id}`)).toBeVisible();
		}
	}
});

test('a situation draws only its institutions', async ({ page }) => {
	await open(page, '?context=portugal&route=lost-job');
	await expect(page.getByTestId('route')).toHaveValue('lost-job');
	await expect(page.getByTestId('node-iefp')).toBeVisible();
	await expect(page.getByTestId('node-assembleia-da-republica')).toHaveCount(0);
	// Its relations carry labels without a selection.
	await expect(page.getByTestId('edge-iefp-partners-iss')).toBeVisible();
});

test('a node shows its details, and links to its relations and overlaps', async ({ page }) => {
	await open(page, '?context=portugal');
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

test('a shared institution switches context', async ({ page }) => {
	await open(page, '?context=ai-industry');
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
