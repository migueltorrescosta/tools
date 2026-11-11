import { expect, test } from '@playwright/test';
import { routes, TOOL_GROUPS } from '../../lib/routes';

test('Index - every tool is a real link to its route', async ({ page }) => {
	await page.goto('/');
	const main = page.getByRole('main');
	await expect(main.getByRole('listitem')).toHaveCount(routes.length);
	for (const route of routes) {
		await expect(
			main.getByRole('link', { name: new RegExp(`^${route.name}`) }).first()
		).toHaveAttribute('href', route.path);
	}
	await expect(main.getByRole('button')).toHaveCount(0);
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

test('Index - the filter lists matches in one list; Enter opens the first', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.locator('nav[data-hydrated]').waitFor();
	await page.keyboard.press('/');
	const filter = page.getByRole('searchbox', { name: 'Filter tools' });
	await expect(filter).toBeFocused();
	await filter.fill('vote');
	await expect(page.getByRole('status')).toHaveText(`1 of ${routes.length}`);
	await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(0);
	await filter.press('Enter');
	await expect(page).toHaveURL(/\/rank-vote$/);
});

test('Index - Escape clears the filter; no match says so', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	const filter = page.getByRole('searchbox', { name: 'Filter tools' });
	await filter.fill('zzzz');
	await expect(page.getByText('No tool matches “zzzz”. Try a shorter word.')).toBeVisible();
	await filter.press('Escape');
	await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(routes.length);
});

test('Index - tapping a tool navigates to it', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page
		.getByRole('main')
		.getByRole('link', { name: /^JWT Parser/ })
		.click();
	await expect(page).toHaveURL(/\/jwt$/);
});
