import { expect, test } from '@playwright/test';
import { routes, TOOL_GROUPS } from '../../lib/routes';

test('Index - every tool card is a real link to its route', async ({ page }) => {
	await page.goto('/');
	const cards = page.getByRole('main').getByRole('listitem');
	await expect(cards).toHaveCount(routes.length);
	for (const route of routes) {
		const heading = page.getByRole('heading', { level: 3, name: route.name, exact: true });
		const link = page.getByRole('main').getByRole('link').filter({ has: heading });
		await expect(link).toHaveAttribute('href', route.path);
	}
	await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('Index - tools are grouped by kind, in the order of TOOL_GROUPS', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
		...TOOL_GROUPS
	]);
	for (const group of TOOL_GROUPS) {
		const section = page.getByRole('region', { name: group });
		await expect(section.getByRole('listitem')).toHaveCount(
			routes.filter((r) => r.group === group).length
		);
	}
});

test('Index - clicking a card navigates to the tool', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page
		.getByRole('main')
		.getByRole('link', { name: /JWT Parser/ })
		.click();
	await expect(page).toHaveURL(/\/jwt$/);
});
