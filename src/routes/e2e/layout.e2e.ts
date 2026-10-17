import { expect, test } from '@playwright/test';

const LIGHT_BG = 'rgb(246, 247, 249)';
const DARK_BG = 'rgb(17, 19, 24)';
const bodyBg = (page: import('@playwright/test').Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('Layout - follows the OS theme until toggled', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await page.locator('nav[data-hydrated]').waitFor();
	expect(await bodyBg(page)).toBe(DARK_BG);

	await page.emulateMedia({ colorScheme: 'light' });
	expect(await bodyBg(page)).toBe(LIGHT_BG);
	await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('Layout - a toggled theme survives reloads and OS changes', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await page.locator('nav[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Switch to light theme' }).click();
	expect(await bodyBg(page)).toBe(LIGHT_BG);

	await page.reload({ waitUntil: 'networkidle' });
	await page.emulateMedia({ colorScheme: 'dark' });
	expect(await bodyBg(page)).toBe(LIGHT_BG);
	await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('Layout - the saved theme applies before any app script runs', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.addInitScript(() => localStorage.setItem('theme', 'light'));
	// Block every external script: only the inline one in app.html can set the theme.
	await page.route('**/*', (route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue()
	);
	await page.goto('/');
	expect(await bodyBg(page)).toBe(LIGHT_BG);
});

test('Layout - skip link moves focus to the main content', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.keyboard.press('Tab');
	const skip = page.getByRole('link', { name: 'Skip to content' });
	await expect(skip).toBeFocused();
	await skip.press('Enter');
	await expect(page).toHaveURL(/#main$/);
	await expect(page.getByRole('main')).toBeFocused();
});

test('Layout - the tool switcher and home link navigate', async ({ page }) => {
	await page.goto('/');
	await page.locator('nav[data-hydrated]').waitFor();
	await page.getByRole('combobox', { name: 'Jump to tool' }).selectOption({ label: 'JWT Parser' });
	await expect(page).toHaveURL(/\/jwt$/);
	await expect(page.getByRole('combobox', { name: 'Jump to tool' })).toHaveValue('/jwt');

	await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Tools' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('Layout - no request goes to Google Fonts', async ({ page }) => {
	const hosts: string[] = [];
	page.on('request', (request) => hosts.push(new URL(request.url()).host));
	await page.goto('/', { waitUntil: 'networkidle' });
	expect(hosts.filter((h) => h.includes('fonts.g'))).toEqual([]);
});
