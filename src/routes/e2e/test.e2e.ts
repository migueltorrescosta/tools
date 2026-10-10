import { expect, test } from '@playwright/test';
import { routes } from '../../lib/routes';

test('Index - every tool card is a real link to its route', async ({ page }) => {
	await page.goto('/');
	const cards = page.locator('.route-card');
	await expect(cards).toHaveCount(routes.length);
	for (const route of routes) {
		const link = page.locator(`a.route-card[href="${route.path}"]`);
		await expect(link).toHaveCount(1);
		await expect(link.locator('h2')).toHaveText(route.name);
	}
	await expect(page.locator('button.route-card')).toHaveCount(0);
});

test('Index - clicking a card navigates to the tool', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('link', { name: /JWT Parser/ }).click();
	await expect(page).toHaveURL(/\/jwt$/);
});
