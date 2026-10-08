import { expect, test } from '@playwright/test';

test('Volt GA - favoriting a session persists in the URL and across reloads', async ({ page }) => {
	await page.goto('/volt-ga');
	await expect(page.locator('h1')).toHaveText('VOLT GA BRATISLAVA 2026');

	const card = page.locator('#session-registration-and-speed-dating');
	const star = card.locator('.fav-btn');
	await expect(star).toHaveAttribute('aria-label', 'Add to favorites');

	await star.click();
	await expect(star).toHaveAttribute('aria-label', 'Remove from favorites');
	await expect(page).toHaveURL(/[?&]sessions=registration-and-speed-dating(&|$)/);

	await page.reload();
	await expect(card.locator('.fav-btn')).toHaveAttribute('aria-label', 'Remove from favorites');

	// Stored favorites also survive a visit without the URL param
	await page.goto('/volt-ga');
	await expect(card.locator('.fav-btn')).toHaveAttribute('aria-label', 'Remove from favorites');
});
