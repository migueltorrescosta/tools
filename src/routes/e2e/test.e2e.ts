import { expect, test } from '@playwright/test';
import { routes } from '../../lib/routes';

test('Index - every tool card is a real link to its route', async ({ page }) => {
	await page.goto('/');
	const cards = page.getByRole('main').getByRole('listitem');
	await expect(cards).toHaveCount(routes.length);
	for (const route of routes) {
		const heading = page.getByRole('heading', { level: 2, name: route.name, exact: true });
		const link = page.getByRole('main').getByRole('link').filter({ has: heading });
		await expect(link).toHaveAttribute('href', route.path);
	}
	await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('Index - clicking a card navigates to the tool', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page
		.getByRole('main')
		.getByRole('link', { name: /JWT Parser/ })
		.click();
	await expect(page).toHaveURL(/\/jwt$/);
});
