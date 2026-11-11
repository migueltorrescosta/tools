import { expect, test } from '@playwright/test';

// --bg in tokens.css, as the browser reports it.
const LIGHT_BG = 'oklch(0.925 0.03 75)';
const DARK_BG = 'oklch(0.25 0.07 258)';
const bodyBg = (page: import('@playwright/test').Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('Layout - matches the device until a theme is picked', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await page.locator('nav[data-hydrated]').waitFor();
	expect(await bodyBg(page)).toBe(DARK_BG);

	await page.emulateMedia({ colorScheme: 'light' });
	expect(await bodyBg(page)).toBe(LIGHT_BG);
	await expect(page.getByRole('button', { name: 'Match device theme' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('Layout - a picked theme survives reloads and OS changes, until Match device', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await page.locator('nav[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Light theme' }).click();
	expect(await bodyBg(page)).toBe(LIGHT_BG);
	await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
		'content',
		'#f2e4d1'
	);

	await page.reload({ waitUntil: 'networkidle' });
	await page.emulateMedia({ colorScheme: 'dark' });
	expect(await bodyBg(page)).toBe(LIGHT_BG);
	await expect(page.getByRole('button', { name: 'Light theme' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: 'Match device theme' }).click();
	expect(await bodyBg(page)).toBe(DARK_BG);
});

test('Layout - on a phone the theme is one button that opens the three choices', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/rank-vote');
	await page.locator('nav[data-hydrated]').waitFor();
	const toggle = page.getByRole('button', { name: 'Theme: Match device' });
	const box = await toggle.boundingBox();
	expect(box && box.x + box.width).toBeLessThanOrEqual(320);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
	await expect(page.getByRole('link', { name: 'Tools' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Site' })).toContainText('Rank Vote');

	await toggle.click();
	await page.getByRole('button', { name: 'Dark' }).click();
	expect(await bodyBg(page)).toBe(DARK_BG);
	await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveCount(0);
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

test('Layout - the breadcrumb names the tool and links home', async ({ page }) => {
	await page.goto('/jwt');
	const nav = page.getByRole('navigation', { name: 'Site' });
	await expect(nav).toContainText('JWT Parser');
	await expect(page.getByRole('heading', { level: 1, name: 'JWT Parser' })).toBeAttached();
	await nav.getByRole('link', { name: 'Tools' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('Layout - no request goes to Google Fonts', async ({ page }) => {
	const hosts: string[] = [];
	page.on('request', (request) => hosts.push(new URL(request.url()).host));
	await page.goto('/', { waitUntil: 'networkidle' });
	expect(hosts.filter((h) => h.includes('fonts.g'))).toEqual([]);
});
