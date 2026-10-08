import { expect, test, type Page } from '@playwright/test';

/** Navigate (or reload) and wait until the page has hydrated and loaded favorites */
async function ready(page: Page, url?: string) {
	if (url) await page.goto(url);
	else await page.reload();
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

test('Volt GA - favoriting a session persists in the URL and across reloads', async ({ page }) => {
	await ready(page, '/volt-ga');
	await expect(page.locator('h1')).toHaveText('VOLT GA BRATISLAVA 2026');

	const card = page.locator('#session-registration-and-speed-dating');
	const star = card.locator('.fav-btn');
	await expect(star).toHaveAttribute('aria-label', 'Add to favorites');

	await star.click();
	await expect(star).toHaveAttribute('aria-label', 'Remove from favorites');
	await expect(page).toHaveURL(/[?&]sessions=registration-and-speed-dating(&|$)/);

	await ready(page);
	await expect(card.locator('.fav-btn')).toHaveAttribute('aria-label', 'Remove from favorites');

	// Stored favorites also survive a visit without the URL param
	await ready(page, '/volt-ga');
	await expect(card.locator('.fav-btn')).toHaveAttribute('aria-label', 'Remove from favorites');
});

test('Volt GA - Escape closes the detail and share dialogs and returns focus', async ({ page }) => {
	await ready(page, '/volt-ga');

	const open = page.locator('#session-a-new-world-order .card-open');
	await open.click();
	const detail = page.getByRole('dialog', { name: 'A New World Order' });
	await expect(detail).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(detail).toBeHidden();
	await expect(open).toBeFocused();

	// Space activates the card's open button like any native button
	await page.keyboard.press('Space');
	await expect(detail).toBeVisible();
	await page.keyboard.press('Escape');

	const shareBtn = page.getByRole('button', { name: 'Share' });
	await shareBtn.click();
	const share = page.getByRole('dialog', { name: 'Share schedule' });
	await expect(share).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(share).toBeHidden();
	await expect(shareBtn).toBeFocused();
});

test('Volt GA - a shared link does not overwrite stored favorites', async ({ page }) => {
	await ready(page, '/volt-ga');
	await page.locator('#session-registration-and-speed-dating .fav-btn').click();
	await expect(page).toHaveURL(/[?&]sessions=registration-and-speed-dating(&|$)/);

	await ready(page, '/volt-ga?sessions=a-new-world-order,not-a-session');
	await expect(page.getByText(/This link shares 1 session/)).toBeVisible();
	await expect(page.locator('#session-registration-and-speed-dating .fav-btn')).toHaveAttribute(
		'aria-label',
		'Remove from favorites'
	);

	await page.getByRole('button', { name: 'Add to mine' }).click();
	await expect(page.locator('#session-a-new-world-order .fav-btn')).toHaveAttribute(
		'aria-label',
		'Remove from favorites'
	);
	await expect(page).toHaveURL(
		/sessions=registration-and-speed-dating%2Ca-new-world-order|sessions=registration-and-speed-dating,a-new-world-order/
	);
});
